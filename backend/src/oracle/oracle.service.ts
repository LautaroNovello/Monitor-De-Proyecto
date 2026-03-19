import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { InfluxDB, Point, WriteApi } from '@influxdata/influxdb-client';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { NodeSSH } from 'node-ssh';
import { Setting } from '../settings/entities/setting.entity';
import { Project } from '../projects/entitties/proyectos.entity';
import { Contact } from '../contacts/entities/contact.entity';

// Definición del estado de salud del host
export interface HostHealthDto {
  totalUsedMb: number;
  maxMb: number;
  usagePercent: number;
  status: 'ok' | 'warn' | 'critical';
  lastUpdated: string;
  /** true si al menos un scrape completó exitosamente (aunque RAM sea 0) */
  hasData: boolean;
  /** Desglose de RAM por proyecto */
  projects: { name: string; usedMb: number; usagePct: number }[];
}

@Injectable()
export class OracleService implements OnModuleInit {
  private readonly logger = new Logger(OracleService.name);

  // Caché en memoria con el uso de RAM más reciente por proyecto
  private hostRamCache: Record<string, number> = {};
  // Indica si al menos un ciclo de scraping se completó (aunque falle el cAdvisor remoto)
  private firstScrapeCompleted = false;
  // Anti-spam: solo alertar una vez por hora
  private lastAlertSentAt: number | null = null;

  private restartCounts: Record<string, Record<string, number>> = {};
  private manualRestartCounts: Record<string, Record<string, number>> = {};
  private limitMbCache: Record<string, Record<string, number>> = {};
  private pidsCache: Record<string, Record<string, number>> = {};
  // Proyectos donde docker inspect via SSH ya proveyó el RestartCount real
  private sshRestartsFetched = new Set<string>();

  constructor(
    private readonly httpService: HttpService,
    private schedulerRegistry: SchedulerRegistry,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    private readonly config: ConfigService,
  ) { }

  async onModuleInit() {
    this.logger.log('Oracle Service inicializado. Configurando tareas...');
    await this.replanificarMonitoreo();
    // Primer scrape inmediato para no esperar el primer intervalo
    this.handleScrape().catch(e => this.logger.error('[INIT] Error en scrape inicial:', e.message));
  }

  /** Recrea todos los intervalos de scrape leyendo los proyectos activos desde la BD. */
  async replanificarMonitoreo() {
    // Cancelar todos los intervalos de scrape existentes
    const names = this.schedulerRegistry.getIntervals();
    for (const name of names) {
      if (name.startsWith('oracle_scrape_')) {
        try { this.schedulerRegistry.deleteInterval(name); } catch { }
      }
    }

    const projects = await this.projectRepository.find({ where: { isActive: true } });
    for (const project of projects) {
      this.replanificarProyecto(project);
    }
    this.logger.log(`Monitoreo configurado para ${projects.length} proyecto(s) activo(s).`);
  }

  /** Crea o reemplaza el intervalo de scrape de un único proyecto. */
  replanificarProyecto(project: Project) {
    const name = `oracle_scrape_${project.id}`;
    try { this.schedulerRegistry.deleteInterval(name); } catch { }
    if (!project.isActive) return;
    const seconds = project.scrapingInterval ?? 10;
    const interval = setInterval(
      () => this.handleScrapeForProject(project.id).catch(e =>
        this.logger.error(`[SCRAPE] Error en proyecto ${project.id}: ${e.message}`)
      ),
      seconds * 1000,
    );
    this.schedulerRegistry.addInterval(name, interval);
    this.logger.log(`Scrape para "${project.name}" cada ${seconds}s.`);
  }

  /** Detiene el intervalo de scrape de un proyecto (al borrar o desactivar). */
  cancelarProyecto(projectId: number) {
    const name = `oracle_scrape_${projectId}`;
    try { this.schedulerRegistry.deleteInterval(name); } catch { }
  }

  /** Scrape de un proyecto concreto por ID (llamado por su propio intervalo). */
  private async handleScrapeForProject(projectId: number) {
    const project = await this.projectRepository.findOne({ where: { id: projectId, isActive: true } });
    if (!project) return;
    const influxApi = await this.getWriteApi();
    await this.scrapeProject(project, influxApi);
    if (influxApi) await influxApi.close();
    this.firstScrapeCompleted = true;
    await this.checkHostCapacityAlert();
  }

  // ── API pública: estado de salud del host ────────────────────────────
  async getHostHealth(): Promise<HostHealthDto> {
    const projects = await this.projectRepository.find();
    const maxMb = projects.reduce((sum, p) => sum + (p.maxRamMb ?? 2048), 0) || 2048;

    const totalUsedMb = Math.round(
      Object.values(this.hostRamCache).reduce((acc, v) => acc + v, 0) * 100
    ) / 100;

    const usagePercent = Math.round((totalUsedMb / maxMb) * 100 * 10) / 10;

    let status: 'ok' | 'warn' | 'critical';
    if (usagePercent >= 85) status = 'critical';
    else if (usagePercent >= 70) status = 'warn';
    else status = 'ok';

    const hasData = this.firstScrapeCompleted;
    return { totalUsedMb, maxMb, usagePercent, status, lastUpdated: new Date().toISOString(), hasData, projects: [] };
  }

  // ── Salud de instancia para UN proyecto específico ────────────────────
  async getProjectHealth(projectId: number): Promise<HostHealthDto> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) {
      return { totalUsedMb: 0, maxMb: 2048, usagePercent: 0, status: 'ok', lastUpdated: new Date().toISOString(), hasData: false, projects: [] };
    }

    const maxMb = project.maxRamMb ?? 2048;

    const usedMb = Math.round((this.hostRamCache[project.name] ?? 0) * 100) / 100;
    const usagePercent = Math.round((usedMb / maxMb) * 100 * 10) / 10;

    let status: 'ok' | 'warn' | 'critical';
    if (usagePercent >= 85) status = 'critical';
    else if (usagePercent >= 70) status = 'warn';
    else status = 'ok';

    return {
      totalUsedMb: usedMb,
      maxMb,
      usagePercent,
      status,
      lastUpdated: new Date().toISOString(),
      hasData: this.firstScrapeCompleted,
      projects: [],
    };
  }

  // ── API pública: estado de contenedores (restarts, throttle, límites) ────
  getContainerStatuses(projectName: string): Record<string, { restarts: number; throttlePct: number; limitMb: number; pids: number }> {
    const out: Record<string, { restarts: number; throttlePct: number; limitMb: number; pids: number }> = {};
    const restarts = this.restartCounts[projectName] ?? {};
    const manualRestarts = this.manualRestartCounts[projectName] ?? {};
    const limits = this.limitMbCache[projectName] ?? {};
    const keys = new Set([...Object.keys(restarts), ...Object.keys(limits), ...Object.keys(manualRestarts)]);
    for (const alias of keys) {
      const trimmedAlias = alias.trim();
      out[trimmedAlias] = {
        restarts: (restarts[alias] ?? 0) + (manualRestarts[alias] ?? 0),
        throttlePct: 0, // Throttle ya no se calcula sin cAdvisor por ahora
        limitMb: limits[alias] ?? 0,
        pids: this.pidsCache[projectName]?.[alias] ?? 0,
      };
    }
    return out;
  }

  incrementManualRestart(projectName: string, containerAlias: string) {
    if (!this.manualRestartCounts[projectName]) this.manualRestartCounts[projectName] = {};
    const current = this.manualRestartCounts[projectName][containerAlias] ?? 0;
    this.manualRestartCounts[projectName][containerAlias] = current + 1;
    this.logger.log(`[ACTION] Incrementando reinicio manual para ${projectName}:${containerAlias} -> ${current + 1}`);
  }

  // EL TRABAJADOR (SCRAPER)
  async handleScrape() {
    const influxApi = await this.getWriteApi();
    this.logger.log(`[SCRAPE] Inicio. InfluxDB: ${influxApi ? 'conectado' : 'sin configurar'}`);

    const projects = await this.projectRepository.find({ where: { isActive: true } });
    this.logger.log(`[SCRAPE] Proyectos activos: ${projects.length}`);

    if (projects.length === 0) {
      this.logger.warn('[SCRAPE] No hay proyectos activos.');
      this.firstScrapeCompleted = true;
      return;
    }

    this.sshRestartsFetched.clear();

    for (const project of projects) {
      await this.scrapeProject(project, influxApi);
    }

    if (influxApi) await influxApi.close();
    this.firstScrapeCompleted = true;
    await this.checkHostCapacityAlert();
  }

  /** Lógica de scrape para un único proyecto. Reutilizado por handleScrape y handleScrapeForProject. */
  private async scrapeProject(project: Project, influxApi: WriteApi | null) {
    this.logger.log(`[SCRAPE] → "${project.name}"`);
    try {
      const projectRamTotal = await this.fetchMetricsViaSSH(project, influxApi);
      this.hostRamCache[project.name] = projectRamTotal;
      this.logger.log(`[SCRAPE]   ✓ RAM total: ${projectRamTotal.toFixed(1)} MB.`);
    } catch (error) {
      this.logger.error(`[SCRAPE]   ✗ Error en "${project.name}": ${error.message}`);
    }
  }

  /**
   * Obtiene TODAS las métricas vía SSH ejecutando `docker stats --no-stream`.
   * Estrategia robusta: mapea IDs a Nombres usando docker ps.
   */
  private async fetchMetricsViaSSH(project: Project, influxApi: WriteApi | null): Promise<number> {
    if (!project.sshUser || !project.sshKey) {
      throw new Error('Sin credenciales SSH para este proyecto');
    }

    const ssh = new NodeSSH();
    const host = new URL(project.ec2Url).hostname;
    await ssh.connect({ host, username: project.sshUser, privateKey: project.sshKey });

    const psResult = await ssh.execCommand('docker ps --no-trunc --format "{{.ID}}\t{{.Names}}"');
    const inspectResult = await ssh.execCommand("docker inspect --format '{{.Id}} {{.Name}} {{.HostConfig.Memory}} {{.RestartCount}}' $(docker ps -q) 2>/dev/null || true");

    // Normalizar el mapa de contenedores del proyecto (trimear espacios accidentales)
    const normalizedMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(project.containerMap || {})) {
      normalizedMap[k.trim()] = v.trim();
    }

    const idToName = new Map<string, string>();
    for (const line of psResult.stdout.split('\n')) {
      const [fullId, names] = line.trim().split('\t');
      if (!fullId || !names) continue;
      // names puede ser "name1,name2", tomamos el primero
      const primaryName = names.split(',')[0].replace(/^\//, '');
      idToName.set(fullId, primaryName);
    }

    const pName = project.name;
    if (!this.restartCounts[pName]) this.restartCounts[pName] = {};
    if (!this.limitMbCache[pName]) this.limitMbCache[pName] = {};
    if (!this.pidsCache[pName]) this.pidsCache[pName] = {};

    for (const inspLine of inspectResult.stdout.split('\n')) {
      const parts = inspLine.trim().split(' ');
      if (parts.length < 3) continue;
      const fullId = parts[0];
      const rawName = parts[1];
      const name = rawName.replace(/^\//, '');
      const memBytes = parseInt(parts[2], 10);
      const restartCount = parseInt(parts[3] ?? '0', 10);

      const cAlias = normalizedMap[name] || normalizedMap[fullId.substring(0, 12)] || normalizedMap[fullId];
      if (cAlias) {
        this.limitMbCache[pName][cAlias] = (memBytes > 0 && memBytes < 2 * 1024 * 1024 * 1024 * 1024)
          ? Math.round(memBytes / (1024 * 1024))
          : 0;
        this.restartCounts[pName][cAlias] = isNaN(restartCount) ? 0 : restartCount;
      }
    }

    // 2. Obtener estadísticas usando IDs completos para correlación única
    const statsResult = await ssh.execCommand('docker stats --no-stream --no-trunc --format "{{.ID}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}\t{{.PIDs}}"');
    ssh.dispose();

    this.logger.log(`[SCRAPE]   (SSH) Respuesta stats recibida (${statsResult.stdout.split('\n').length} líneas)`);

    let totalMb = 0;
    const scrapeTimestamp = new Date(); // Compartir timestamp para pivot correcto
    this.logger.log('[SCRAPE]   (SSH) Resumen visual de contenedores mapeados:');
    this.logger.log('Alias\tCPU%\tMem Usage\tNet I/O\tBlock I/O\tPIDs');

    for (const line of statsResult.stdout.split('\n')) {
      const parts = line.trim().split('\t');
      if (parts.length < 6) continue;

      const fullId = parts[0].trim();
      const shortId = fullId.substring(0, 12);
      const name = idToName.get(fullId) || '';

      // Resolver el alias usando Nombre (prioridad) o ID (fallback)
      const containerAlias = normalizedMap[name] || normalizedMap[shortId] || normalizedMap[fullId];

      if (!containerAlias) continue;

      // Imprimir fila con el alias configurado
      this.logger.log(`${containerAlias}\t${parts[1]}\t${parts[2]}\t${parts[3]}\t${parts[4]}\t${parts[5]}`);

      // Parsear métricas
      const cpuPerc = parseFloat(parts[1].replace('%', '').trim());
      const usedStr = parts[2].split('/')[0].trim();
      const mb = this.parseMemoryToMB(usedStr);
      totalMb += mb;

      if (this.restartCounts[pName][containerAlias] === undefined) {
        this.restartCounts[pName][containerAlias] = 0;
      }

      // Guardar PIDs en caché para el endpoint de status
      const pids = parseInt(parts[5].trim(), 10);
      if (!isNaN(pids)) {
        this.pidsCache[pName][containerAlias] = pids;
      }

      if (influxApi) {
        // RAM Usage
        influxApi.writePoint(
          new Point('ram_usage').tag('project_name', pName).tag('container_name', containerAlias)
            .floatField('mb', mb)
            .timestamp(scrapeTimestamp)
        );
        // CPU Usage
        influxApi.writePoint(
          new Point('cpu_usage').tag('project_name', pName).tag('container_name', containerAlias)
            .floatField('percent', cpuPerc)
            .timestamp(scrapeTimestamp)
        );
        // RAM Limit
        const limitMb = this.limitMbCache[pName][containerAlias] || 0;
        if (limitMb > 0) {
          influxApi.writePoint(
            new Point('ram_limit').tag('project_name', pName).tag('container_name', containerAlias)
              .floatField('bytes', limitMb * 1024 * 1024)
              .timestamp(scrapeTimestamp)
          );
        }
        // Network IO
        if (parts[3]) {
          const netParts = parts[3].split('/');
          if (netParts.length === 2) {
            influxApi.writePoint(
              new Point('network_io').tag('project_name', pName).tag('container_name', containerAlias)
                .floatField('rx_mb', this.parseMemoryToMB(netParts[0].trim()))
                .floatField('tx_mb', this.parseMemoryToMB(netParts[1].trim()))
                .timestamp(scrapeTimestamp)
            );
          }
        }
        // Disk IO
        if (parts[4]) {
          const ioParts = parts[4].split('/');
          if (ioParts.length === 2) {
            influxApi.writePoint(
              new Point('disk_io').tag('project_name', pName).tag('container_name', containerAlias)
                .floatField('read_bytes', this.parseMemoryToMB(ioParts[0].trim()) * 1048576)
                .floatField('write_bytes', this.parseMemoryToMB(ioParts[1].trim()) * 1048576)
                .timestamp(scrapeTimestamp)
            );
          }
        }
        // PIDs
        if (parts[5]) {
          const pids = parseInt(parts[5].trim(), 10);
          if (!isNaN(pids)) {
            influxApi.writePoint(
              new Point('processes').tag('project_name', pName).tag('container_name', containerAlias)
                .intField('pids', pids)
                .timestamp(scrapeTimestamp)
            );
          }
        }
      }
    }
    return totalMb;
  }

  /** Convierte strings como "220.6MiB", "1.2GiB", "512KiB" a MB */
  private parseMemoryToMB(str: string): number {
    const match = str.match(/([\d.]+)\s*(KiB|MiB|GiB|KB|MB|GB|B)/i);
    if (!match) return 0;
    const num = parseFloat(match[1]);
    switch (match[2].toLowerCase()) {
      case 'gib': case 'gb': return Math.round(num * 1024 * 100) / 100;
      case 'mib': case 'mb': return Math.round(num * 100) / 100;
      case 'kib': case 'kb': return Math.round(num / 1024 * 100) / 100;
      case 'b': return Math.round(num / (1024 * 1024) * 100) / 100;
      default: return 0;
    }
  }

  // ── Alerta de capacidad del host ──────────────────────────────────────
  private async checkHostCapacityAlert() {
    const health = await this.getHostHealth();
    if (health.usagePercent < 90) return;

    const now = Date.now();
    if (this.lastAlertSentAt && (now - this.lastAlertSentAt) < 3_600_000) return;

    this.logger.warn(`⚠️ Alerta de capacidad: el host está al ${health.usagePercent}%`);
    this.lastAlertSentAt = now;

    const contacts = await this.contactRepository.find({ where: { isActive: true } });
    const message = `⚠️ Alerta Crítica ORACLE: La instancia está al ${health.usagePercent}% de capacidad (${health.totalUsedMb} MB / ${health.maxMb} MB). Riesgo de caída de servicios.`;
    await Promise.all(contacts.map(c => this.sendWhatsApp(c.phoneNumber, message)));
  }

  // ── WhatsApp helper (Twilio) ──────────────────────────────────────────
  private async sendWhatsApp(to: string, message: string): Promise<void> {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const rawFrom = this.config.get<string>('TWILIO_WHATSAPP_FROM') || '+14155238886';
    const from = rawFrom.startsWith('whatsapp:') ? rawFrom : `whatsapp:${rawFrom}`;

    if (!accountSid || !authToken) {
      this.logger.warn('[Twilio] Credenciales no configuradas. Notificación omitida.');
      return;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({ To: `whatsapp:${to}`, From: from, Body: message });

    await firstValueFrom(
      this.httpService.post(url, body.toString(), {
        auth: { username: accountSid, password: authToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    ).catch(err => this.logger.error('[Twilio] Error enviando WhatsApp:', err.message));
  }

  // CONFIGURACIÓN DINÁMICA DE INFLUX
  private async getWriteApi(): Promise<WriteApi | null> {
    const settings = await this.settingRepository.find();
    const token = settings.find(s => s.key === 'INFLUX_TOKEN')?.value;
    const url = settings.find(s => s.key === 'INFLUX_URL')?.value || 'http://localhost:8086';
    const org = settings.find(s => s.key === 'INFLUX_ORG')?.value || 'UTN';
    const bucket = settings.find(s => s.key === 'INFLUX_BUCKET')?.value || 'oracle_metrics';

    if (!token) {
      this.logger.warn('Esperando Token de InfluxDB...');
      return null;
    }

    const client = new InfluxDB({ url, token });
    this.logger.log(`[SCRAPE]   Usando InfluxDB: URL=${url}, Org=${org}, Bucket=${bucket}`);
    return client.getWriteApi(org, bucket);
  }

  private extractValue(line: string): number {
    const parts = line.trim().split(/\s+/);
    return parseFloat(parts[1] ?? '0');
  }
}