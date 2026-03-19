import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InfluxDB } from '@influxdata/influxdb-client';
import { Setting } from '../settings/entities/setting.entity';
import { Project } from '../projects/entitties/proyectos.entity';

export interface MetricPoint {
    time: string;
    [container: string]: number | string;
}

@Injectable()
export class MetricsService {
    constructor(
        @InjectRepository(Setting)
        private readonly settingRepository: Repository<Setting>,
        @InjectRepository(Project)
        private readonly projectRepository: Repository<Project>,
    ) { }

    private async getInflux() {
        const settings = await this.settingRepository.find();
        const token = settings.find(s => s.key === 'INFLUX_TOKEN')?.value;
        const url = settings.find(s => s.key === 'INFLUX_URL')?.value || 'http://localhost:8086';
        const org = settings.find(s => s.key === 'INFLUX_ORG')?.value || 'UTN';
        const bucket = settings.find(s => s.key === 'INFLUX_BUCKET')?.value || 'oracle_metrics';
        if (!token) return null;
        return {
            queryApi: new InfluxDB({ url, token }).getQueryApi(org),
            bucket
        };
    }

    private async runQuery(fluxQuery: string): Promise<MetricPoint[]> {
        const result = await this.getInflux();
        if (!result) return [];
        const { queryApi } = result;
        const points: MetricPoint[] = [];
        const skipKeys = new Set([
            '_start', '_stop', '_time', 'result', 'table',
            '_field', '_measurement', 'project_name', '_value',
        ]);
        await new Promise<void>((resolve, reject) => {
            queryApi.queryRows(fluxQuery, {
                next(row, tableMeta) {
                    const obj = tableMeta.toObject(row);
                    const point: MetricPoint = { time: obj._time };
                    Object.keys(obj).forEach(k => {
                        if (!skipKeys.has(k)) {
                            point[k] = typeof obj[k] === 'number' ? obj[k] : parseFloat(obj[k]) || 0;
                        }
                    });
                    points.push(point);
                },
                error(err) { reject(err); },
                complete() { resolve(); },
            });
        });

        return points;
    }

    // RAM: ya almacenada en MB por el scraper → devolvemos directo
    async getRam(projectId: number, minutes: number): Promise<MetricPoint[]> {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) return [];

        const influx = await this.getInflux();
        if (!influx) return [];

        const query = `
            from(bucket: "${influx.bucket}")
            |> range(start: -${minutes}m)
            |> filter(fn: (r) => r._measurement == "ram_usage" and r._field == "mb")
            |> filter(fn: (r) => r.project_name == "${project.name}")
            |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["container_name"], valueColumn: "_value")
        `;
        try {
            return await this.runQuery(query);
        } catch {
            return [];
        }
    }

    // CPU: derivative de segundos acumulados → % de CPU
    async getCpu(projectId: number, minutes: number): Promise<MetricPoint[]> {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) return [];

        const influx = await this.getInflux();
        if (!influx) return [];

        const query = `
            from(bucket: "${influx.bucket}")
            |> range(start: -${minutes}m)
            |> filter(fn: (r) => r._measurement == "cpu_usage")
            |> filter(fn: (r) => r.project_name == "${project.name}")
            |> map(fn: (r) => {
                // Si es el campo viejo 'seconds', aplicamos derivative. Si es 'percent', lo usamos directo.
                v = if r._field == "seconds" then r._value else r._value
                return { r with _value: v }
            })
            // Nota: Para simplificar y dado que SSH da percent, usaremos mayormente percent.
            // Si detectamos 'percent', evitamos el derivative.
            |> filter(fn: (r) => r._field == "percent")
            |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["container_name"], valueColumn: "_value")
        `;
        try {
            return await this.runQuery(query);
        } catch {
            return [];
        }
    }

    // Network: suma de rx+tx por contenedor → MB total transferido
    async getNetwork(projectId: number, minutes: number): Promise<MetricPoint[]> {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) return [];

        const influx = await this.getInflux();
        if (!influx) return [];

        // Consulta rx y tx por separado, luego unimos por tiempo y alias
        const makeQuery = (field: string) => `
            from(bucket: "${influx.bucket}")
            |> range(start: -${minutes}m)
            |> filter(fn: (r) => r._measurement == "network_io" and r._field == "${field}")
            |> filter(fn: (r) => r.project_name == "${project.name}")
            |> derivative(unit: 1s, nonNegative: true)
            |> aggregateWindow(every: 20s, fn: mean, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["container_name"], valueColumn: "_value")
        `;
        try {
            const [rxData, txData] = await Promise.all([
                this.runQuery(makeQuery('rx_mb')),
                this.runQuery(makeQuery('tx_mb')),
            ]);
            if (rxData.length === 0) return [];

            // Alinear RX y TX por tiempo usando un Map
            const txByTime = new Map(txData.map(p => [p.time as string, p]));
            const containers = Object.values(project.containerMap);

            return rxData.map((rxPoint) => {
                const txPoint = txByTime.get(rxPoint.time as string) ?? {};
                const merged: MetricPoint = { time: rxPoint.time };
                containers.forEach(alias => {
                    const rx = (rxPoint[alias] as number) || 0;
                    const tx = (txPoint[alias] as number) || 0;
                    merged[alias] = Math.round((rx + tx) * 100) / 100;
                });
                return merged;
            });
        } catch {
            return [];
        }
    }

    // Network TOTAL: Acumulado (sin derivative) para mostrar en tarjetas státicas
    async getNetworkTotal(projectId: number): Promise<Record<string, { rx_total_mb: number; tx_total_mb: number }>> {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) return {};

        const influx = await this.getInflux();
        if (!influx) return {};

        const query = `
            from(bucket: "${influx.bucket}")
            |> range(start: -24h)
            |> filter(fn: (r) => r._measurement == "network_io")
            |> filter(fn: (r) => r.project_name == "${project.name}")
            |> last()
            |> pivot(rowKey:["_time", "container_name"], columnKey: ["_field"], valueColumn: "_value")
        `;

        const out: Record<string, { rx_total_mb: number; tx_total_mb: number }> = {};
        try {
            const results = await new Promise<any[]>((resolve, reject) => {
                const res: any[] = [];
                influx.queryApi.queryRows(query, {
                    next(row, tableMeta) { res.push(tableMeta.toObject(row)); },
                    error(err) { reject(err); },
                    complete() { resolve(res); },
                });
            });

            results.forEach(p => {
                out[p.container_name] = {
                    rx_total_mb: Math.round((p.rx_mb || 0) * 100) / 100,
                    tx_total_mb: Math.round((p.tx_mb || 0) * 100) / 100,
                };
            });
        } catch (err) {
            console.error('[MetricsService] Error fetching network totals:', err);
        }
        return out;
    }

    // Disk I/O: suma de read/write bytes/s entre todos los contenedores del proyecto
    async getDiskIo(projectId: number, minutes: number): Promise<MetricPoint[]> {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) return [];

        const influx = await this.getInflux();
        if (!influx) return [];

        const makeQuery = (field: string) => `
            from(bucket: "${influx.bucket}")
            |> range(start: -${minutes}m)
            |> filter(fn: (r) => r._measurement == "disk_io" and r._field == "${field}")
            |> filter(fn: (r) => r.project_name == "${project.name}")
            |> derivative(unit: 1s, nonNegative: true)
            |> map(fn: (r) => ({r with _value: r._value / 1048576.0}))
            |> aggregateWindow(every: 20s, fn: mean, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["container_name"], valueColumn: "_value")
        `;

        try {
            const [readData, writeData] = await Promise.all([
                this.runQuery(makeQuery('read_bytes')),
                this.runQuery(makeQuery('write_bytes')),
            ]);
            if (readData.length === 0) return [];

            const writeByTime = new Map(writeData.map(p => [p.time as string, p]));
            const containers = Object.values(project.containerMap);

            return readData.map(rp => {
                const wp = writeByTime.get(rp.time as string) ?? {};
                const merged: MetricPoint = { time: rp.time };
                containers.forEach(alias => {
                    const r = (rp[alias] as number) || 0;
                    const w = (wp[alias] as number) || 0;
                    merged[alias] = Math.round((r + w) * 100) / 100;
                });
                return merged;
            });
        } catch {
            return [];
        }
    }

    // Unified: Returns the "Professional JSON" format requested
    async getUnifiedMetrics(projectId: number, minutes: number = 60) {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) return [];

        const influx = await this.getInflux();
        if (!influx) return [];

        // Hacemos una consulta masiva de todas las mediciones importantes
        const query = `
            import "experimental"
            
            cpu = from(bucket: "${influx.bucket}")
                |> range(start: -1h)
                |> filter(fn: (r) => r._measurement == "cpu_usage" and r._field == "percent")
                |> filter(fn: (r) => r.project_name == "${project.name}")
                |> last()
                |> map(fn: (r) => ({ r with _field: "cpu_percent" }))

            ram = from(bucket: "${influx.bucket}")
                |> range(start: -1h)
                |> filter(fn: (r) => r._measurement == "ram_usage" and r._field == "mb")
                |> filter(fn: (r) => r.project_name == "${project.name}")
                |> last()
                |> map(fn: (r) => ({ r with _field: "mem_usage_mib" }))

            limit = from(bucket: "${influx.bucket}")
                |> range(start: -1h)
                |> filter(fn: (r) => r._measurement == "ram_limit" and r._field == "bytes")
                |> filter(fn: (r) => r.project_name == "${project.name}")
                |> last()
                |> map(fn: (r) => ({ r with _value: r._value / 1048576.0, _field: "mem_limit_mib" }))

            net_rx_speed = from(bucket: "${influx.bucket}")
                |> range(start: -1h)
                |> filter(fn: (r) => r._measurement == "network_io" and r._field == "rx_mb")
                |> filter(fn: (r) => r.project_name == "${project.name}")
                |> derivative(unit: 1s, nonNegative: true)
                |> last()
                |> map(fn: (r) => ({ r with _field: "rx_speed_mb" }))

            net_tx_speed = from(bucket: "${influx.bucket}")
                |> range(start: -1h)
                |> filter(fn: (r) => r._measurement == "network_io" and r._field == "tx_mb")
                |> filter(fn: (r) => r.project_name == "${project.name}")
                |> derivative(unit: 1s, nonNegative: true)
                |> last()
                |> map(fn: (r) => ({ r with _field: "tx_speed_mb" }))

            net_rx_total = from(bucket: "${influx.bucket}")
                |> range(start: -1h)
                |> filter(fn: (r) => r._measurement == "network_io" and r._field == "rx_mb")
                |> filter(fn: (r) => r.project_name == "${project.name}")
                |> last()
                |> map(fn: (r) => ({ r with _field: "rx_total_mb" }))

            net_tx_total = from(bucket: "${influx.bucket}")
                |> range(start: -1h)
                |> filter(fn: (r) => r._measurement == "network_io" and r._field == "tx_mb")
                |> filter(fn: (r) => r.project_name == "${project.name}")
                |> last()
                |> map(fn: (r) => ({ r with _field: "tx_total_mb" }))

            pids = from(bucket: "${influx.bucket}")
                |> range(start: -1h)
                |> filter(fn: (r) => r._measurement == "processes" and r._field == "pids")
                |> filter(fn: (r) => r.project_name == "${project.name}")
                |> last()
                |> map(fn: (r) => ({ r with _field: "pids" }))

            disk_read = from(bucket: "${influx.bucket}")
                |> range(start: -1h)
                |> filter(fn: (r) => r._measurement == "disk_io" and r._field == "read_bytes")
                |> filter(fn: (r) => r.project_name == "${project.name}")
                |> derivative(unit: 1s, nonNegative: true)
                |> last()
                |> map(fn: (r) => ({ r with _value: r._value / 1048576.0, _field: "read_mb_s" }))

            disk_write = from(bucket: "${influx.bucket}")
                |> range(start: -1h)
                |> filter(fn: (r) => r._measurement == "disk_io" and r._field == "write_bytes")
                |> filter(fn: (r) => r.project_name == "${project.name}")
                |> derivative(unit: 1s, nonNegative: true)
                |> last()
                |> map(fn: (r) => ({ r with _value: r._value / 1048576.0, _field: "write_mb_s" }))

            union(tables: [cpu, ram, limit, net_rx_speed, net_tx_speed, net_rx_total, net_tx_total, pids, disk_read, disk_write])
                |> pivot(rowKey:["_time", "container_name"], columnKey: ["_field"], valueColumn: "_value")
        `;

        const rawPoints = await new Promise<any[]>((resolve, reject) => {
            const results: any[] = [];
            influx.queryApi.queryRows(query, {
                next(row, tableMeta) { results.push(tableMeta.toObject(row)); },
                error(err) { reject(err); },
                complete() { resolve(results); },
            });
        });

        // Mapeamos al formato JSON ideal
        return rawPoints.map(p => ({
            timestamp: p._time,
            container: p.container_name,
            stats: {
                cpu_percent: Math.round((p.cpu_percent || 0) * 100) / 100,
                mem_usage_mib: Math.round((p.mem_usage_mib || 0) * 100) / 100,
                mem_limit_mib: Math.round((p.mem_limit_mib || 0) * 100) / 100,
                mem_percent: p.mem_limit_mib ? Math.round(((p.mem_usage_mib || 0) / p.mem_limit_mib) * 10000) / 100 : 0,
                net_io: {
                    rx_speed_mb_s: Math.round((p.rx_speed_mb || 0) * 1000) / 1000,
                    tx_speed_mb_s: Math.round((p.tx_speed_mb || 0) * 1000) / 1000,
                    rx_total_mb: Math.round((p.rx_total_mb || 0) * 100) / 100,
                    tx_total_mb: Math.round((p.tx_total_mb || 0) * 100) / 100,
                },
                block_io: {
                    read_mb_s: Math.round((p.read_mb_s || 0) * 1000) / 1000,
                    write_mb_s: Math.round((p.write_mb_s || 0) * 1000) / 1000,
                },
                pids: p.pids || 0
            }
        }));
    }

    // Helper para obtener el proyecto por ID (usado por el controller para status)
    // Network History TOTAL: Historial acumulado (sin derivative) para gráfica conmutable
    async getNetworkHistoryTotal(projectId: number, minutes: number): Promise<MetricPoint[]> {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) return [];

        const influx = await this.getInflux();
        if (!influx) return [];

        const makeQuery = (field: string) => `
            from(bucket: "${influx.bucket}")
            |> range(start: -${minutes}m)
            |> filter(fn: (r) => r._measurement == "network_io" and r._field == "${field}")
            |> filter(fn: (r) => r.project_name == "${project.name}")
            |> aggregateWindow(every: 1m, fn: last, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["container_name"], valueColumn: "_value")
        `;

        try {
            const [rxData, txData] = await Promise.all([
                this.runQuery(makeQuery('rx_mb')),
                this.runQuery(makeQuery('tx_mb')),
            ]);
            if (rxData.length === 0) return [];

            const txByTime = new Map(txData.map(p => [p.time as string, p]));
            const containers = Object.values(project.containerMap);

            return rxData.map((rxPoint) => {
                const txPoint = txByTime.get(rxPoint.time as string) ?? {};
                const merged: MetricPoint = { time: rxPoint.time };
                containers.forEach(alias => {
                    const rx = (rxPoint[alias] as number) || 0;
                    const tx = (txPoint[alias] as number) || 0;
                    // Retornar en GB para que la escala sea más limpia
                    merged[alias] = Math.round(((rx + tx) / 1024) * 100) / 100;
                });
                return merged;
            });
        } catch {
            return [];
        }
    }

    // Disk History TOTAL: Historial acumulado (sin derivative) para gráfica conmutable
    async getDiskHistoryTotal(projectId: number, minutes: number): Promise<MetricPoint[]> {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) return [];

        const influx = await this.getInflux();
        if (!influx) return [];

        const makeQuery = (field: string) => `
            from(bucket: "${influx.bucket}")
            |> range(start: -${minutes}m)
            |> filter(fn: (r) => r._measurement == "disk_io" and r._field == "${field}")
            |> filter(fn: (r) => r.project_name == "${project.name}")
            |> aggregateWindow(every: 1m, fn: last, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["container_name"], valueColumn: "_value")
        `;

        try {
            const [readData, writeData] = await Promise.all([
                this.runQuery(makeQuery('read_bytes')),
                this.runQuery(makeQuery('write_bytes')),
            ]);
            if (readData.length === 0) return [];

            const writeByTime = new Map(writeData.map(p => [p.time as string, p]));
            const containers = Object.values(project.containerMap);

            return readData.map(rp => {
                const wp = writeByTime.get(rp.time as string) ?? {};
                const merged: MetricPoint = { time: rp.time };
                containers.forEach(alias => {
                    const r = (rp[alias] as number) || 0;
                    const w = (wp[alias] as number) || 0;
                    // Retornar en GB
                    merged[alias] = Math.round(((r + w) / 1073741824.0) * 100) / 100;
                });
                return merged;
            });
        } catch {
            return [];
        }
    }

    async findProject(id: number) {
        return this.projectRepository.findOne({ where: { id } });
    }
}
