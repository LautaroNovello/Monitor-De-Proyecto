import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProjectById } from '../../api/projectService';
import {
    getRamMetrics,
    getCpuMetrics,
    getNetworkMetrics,
    getDiskIo,
    getContainerStatus,
    ContainerStatusInfo,
    getUnifiedMetrics,
    getNetworkTotal,
    getNetworkHistoryTotal,
    getDiskHistoryTotal
} from '../../api/metricsService';
import { Project, MetricPoint } from '../../types/project';
import MetricsChart from '../../componentes/MetricsChart';
import TerminalModal from '../../componentes/TerminalModal';
import DateRangeSelector, { RangeOption } from '../../componentes/DateRangeSelector';
import LogViewer from '../../componentes/LogViewer';
import {
    Activity,
    RefreshCw,
    Play,
    Square,
    Trash2,
    LayoutGrid,
    Terminal as TerminalIcon,
    HardDrive,
    ArrowLeft,
    AlertTriangle,
    Settings
} from 'lucide-react';
import ContainerActions from '../../componentes/ContainerActions';
import HostCapacity from '../../componentes/HostCapacity';

// Paleta de colores para health cards
const LINE_COLORS = ['#00f5d4', '#f59e0b', '#818cf8', '#fb7185', '#34d399', '#60a5fa'];

const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const toFormatted = (data: MetricPoint[]) =>
    data.map(p => ({ ...p, time: formatTime(p.time as string) }));

const ProjectDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [project, setProject] = useState<Project | null>(null);
    const [ramData, setRamData] = useState<MetricPoint[]>([]);
    const [cpuData, setCpuData] = useState<MetricPoint[]>([]);
    const [netData, setNetData] = useState<MetricPoint[]>([]);
    const [diskData, setDiskData] = useState<MetricPoint[]>([]);
    const [containerStatus, setContainerStatus] = useState<Record<string, ContainerStatusInfo>>({});
    const [netTotalHistory, setNetTotalHistory] = useState<MetricPoint[]>([]);
    const [diskTotalHistory, setDiskTotalHistory] = useState<MetricPoint[]>([]);
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [range, setRange] = useState<RangeOption>('1h');
    const [logViewer, setLogViewer] = useState<{ containerId: string; alias: string } | null>(null);

    const containerAliases = project
        ? Object.values(project.containerMap || {})
        : [];

    const fetchAll = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setError(null);

        try {
            const proj = await getProjectById(Number(id));
            setProject(proj);

            // 1. Obtener métricas y estado en paralelo
            const [ram, cpu, net, disk, status, totals, netHistory, diskHistory] = await Promise.all([
                getRamMetrics(Number(id), range),
                getCpuMetrics(Number(id), range),
                getNetworkMetrics(Number(id), range),
                getDiskIo(Number(id), range),
                getContainerStatus(Number(id)),
                getNetworkTotal(Number(id)),
                getNetworkHistoryTotal(Number(id), range),
                getDiskHistoryTotal(Number(id), range)
            ]);

            setContainerStatus(status);
            setNetTotalHistory(toFormatted(netHistory));
            setDiskTotalHistory(toFormatted(diskHistory));

            // 2. LOG VISUAL (Estilo Backend) usando getUnifiedMetrics para los datos más recientes
            getUnifiedMetrics(Number(id), 5).then((unified: any[]) => {
                if (!unified || unified.length === 0) return;

                // Agrupar por contenedor (tomar el más reciente de cada uno)
                const latestByContainer = new Map<string, any>();
                unified.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                unified.forEach(p => {
                    if (!latestByContainer.has(p.container)) latestByContainer.set(p.container, p);
                });

                const now = new Date();
                const timeStr = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

                console.log(`%c[FRONTEND] ${timeStr} LOG [OracleService] [SCRAPE]   (SSH) Resumen visual de contenedores mapeados:`, 'color: #34d399');
                console.log('%cAlias      CPU%    Mem Usage       Net I/O         Block I/O       PIDs', 'color: #6b7280; font-weight: bold');

                Object.values(proj.containerMap).forEach(rawAlias => {
                    const alias = rawAlias.trim();
                    const p = latestByContainer.get(alias);
                    if (!p) return;

                    const { cpu_percent, mem_usage_mib, mem_limit_mib, net_io, block_io, pids } = p.stats;

                    const cpuStr = `${cpu_percent.toFixed(2)}%`.padEnd(8);
                    const memStr = `${mem_usage_mib.toFixed(2)}MB / ${mem_limit_mib}MB`.padEnd(16);
                    const netStr = `${net_io.rx_total_mb.toFixed(1)}MB / ${net_io.tx_total_mb.toFixed(1)}MB`.padEnd(16);
                    const diskStr = `${block_io.read_mb_s.toFixed(1)}MB / ${block_io.write_mb_s.toFixed(1)}MB`.padEnd(16);

                    console.log(`%c${alias.padEnd(10)} ${cpuStr} ${memStr} ${netStr} ${diskStr} ${pids}`, 'color: #cdd6f4');
                });
            }).catch(() => { });

            setRamData(toFormatted(ram));
            setCpuData(toFormatted(cpu));
            setNetData(toFormatted(net));
            setDiskData(toFormatted(disk));

        } catch (err) {
            console.error('[FRONTEND] Error en fetch:', err);
            setError('No se pudo cargar el proyecto.');
        } finally {
            setLoading(false);
        }
    }, [id, range]);

    // Re-fetch cuando cambia el rango o el estado de la terminal
    useEffect(() => {
        if (!isTerminalOpen) {
            fetchAll();
        }

        const interval = setInterval(() => {
            if (!isTerminalOpen) {
                fetchAll();
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [fetchAll, isTerminalOpen]);

    if (loading) {
        return (
            <div className="empty-state">
                <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
                <p>Cargando métricas...</p>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="empty-state">
                <AlertTriangle size={48} />
                <p>{error ?? 'Proyecto no encontrado'}</p>
                <button className="btn-ghost" onClick={() => navigate('/')}>
                    <ArrowLeft size={14} /> Volver
                </button>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="section-header project-detail-header" style={{ marginBottom: '1.5rem' }}>
                <div className="flex items-center gap-2">
                    <button className="btn-icon" onClick={() => navigate(-1)}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                            <h2 style={{ margin: 0 }}>{project.name}</h2>
                            <span className={`badge ${project.isActive ? 'badge-online' : 'badge-offline'} `}>
                                <span className="dot-blink" />
                                {project.isActive ? 'Online' : 'Offline'}
                            </span>
                        </div>
                        <p className="text-sm font-mono text-muted" style={{ marginTop: '0.15rem' }}>
                            {project.ec2Url}
                        </p>
                    </div>
                </div>

                {/* Bloque de acciones: Configurar, Actualizar, Terminal */}
                <div className="project-header-actions">
                    <button
                        className="btn-ghost"
                        onClick={() => navigate(`/projects/${project.id}/edit`)}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', gap: '0.3rem' }}
                    >
                        <Settings size={12} /> Configurar
                    </button>
                    <button
                        className="btn-ghost"
                        onClick={() => fetchAll()}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', gap: '0.3rem' }}
                    >
                        <RefreshCw size={12} /> Actualizar
                    </button>
                    <button
                        className="btn-ghost"
                        onClick={() => setIsTerminalOpen(true)}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', gap: '0.3rem' }}
                    >
                        <TerminalIcon size={12} /> Terminal SSH
                    </button>
                </div>
            </div >

            {/* Capacidad de la instancia — específica de este proyecto */}
            < HostCapacity projectId={project.id} />

            {/* Health Cards */}
            < div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1.75rem' }}>
                {
                    Object.entries(project.containerMap).map(([cid, rawAlias], i) => {
                        const alias = rawAlias.trim();
                        const lastPoint = ramData[ramData.length - 1];
                        const ramMB = lastPoint ? (lastPoint[alias] as number | undefined) : undefined;
                        const isOnline = ramMB !== undefined && ramMB > 0;
                        const status = containerStatus[alias];
                        const quotaPct = (status?.limitMb && ramMB) ? Math.min(Math.round((ramMB / status.limitMb) * 100), 100) : null;
                        const quotaColor = quotaPct !== null ? (quotaPct >= 90 ? '#fb7185' : quotaPct >= 70 ? '#f59e0b' : '#00f5d4') : '#00f5d4';

                        return (
                            <div key={cid} className="card" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {/* 1. Identificación: Título (Alias) y subtítulo (ID) */}
                                <div>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                                        {alias}
                                    </div>
                                    <div className="font-mono text-muted" style={{ fontSize: '0.65rem', opacity: 0.6 }}>
                                        {cid.trim()}
                                    </div>
                                </div>

                                {/* 2. Badges uno al lado del otro */}
                                <div className="flex items-center gap-2" style={{ marginTop: '0.1rem' }}>
                                    {status && (
                                        <span
                                            title={`CPU Throttling: ${status.throttlePct}%`}
                                            style={{
                                                fontSize: '0.6rem', fontWeight: 700,
                                                padding: '0.15rem 0.4rem', borderRadius: 4,
                                                background: status.throttlePct >= 20 ? '#fb718522' : status.throttlePct >= 5 ? '#f59e0b22' : '#ffffff0a',
                                                color: status.throttlePct >= 20 ? '#fb7185' : status.throttlePct >= 5 ? '#f59e0b' : '#6b7280',
                                            }}
                                        >
                                            ⚡ {status.throttlePct}%
                                        </span>
                                    )}
                                    <span className={`badge ${isOnline ? 'badge-online' : 'badge-offline'}`} style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem' }}>
                                        <span className="dot-blink" />
                                        {isOnline ? 'UP' : 'DOWN'}
                                    </span>
                                    {status && (
                                        <span
                                            title={`PIDs: ${status.pids}`}
                                            style={{ fontSize: '0.65rem', fontWeight: 600, padding: '0.15rem 0.4rem', borderRadius: 4, background: '#ffffff0a', color: '#94a3b8' }}
                                        >
                                            🆔 {status.pids}
                                        </span>
                                    )}
                                </div>

                                {/* 3. Consumo de MB */}
                                <div className="flex items-baseline justify-between" style={{ marginTop: '0.1rem' }}>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: LINE_COLORS[i % LINE_COLORS.length] }}>
                                        {ramMB !== undefined ? `${Math.round(ramMB * 100) / 100} MB` : '— MB'}
                                    </span>
                                    {quotaPct !== null && (
                                        <span style={{ fontSize: '0.6rem', color: '#6b7280', fontWeight: 600 }}>
                                            {quotaPct}% de {status!.limitMb} MB
                                        </span>
                                    )}
                                </div>

                                {/* 4. Línea del límite (Barra) */}
                                <div style={{ height: 4, borderRadius: 100, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginTop: '0.1rem' }}>
                                    <div style={{
                                        height: '100%', width: `${quotaPct ?? 0}%`, borderRadius: 100,
                                        background: quotaColor, transition: 'width 0.6s ease',
                                    }} />
                                </div>
                            </div>
                        );
                    })
                }
            </div >

            {/* Selector de rango + Gráficos */}
            < div style={{ marginBottom: '1rem' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <DateRangeSelector value={range} onChange={r => { setRange(r); }} />
                </div>
                <MetricsChart
                    containers={containerAliases}
                    ramData={ramData}
                    cpuData={cpuData}
                    netData={netData}
                    netTotalHistoryData={netTotalHistory}
                    diskData={diskData}
                    diskTotalHistoryData={diskTotalHistory}
                />
            </div >

            {/* Tabla de detalle */}
            < div className="card" >
                <div className="flex items-center gap-2" style={{ marginBottom: '1rem' }}>
                    <HardDrive size={16} style={{ color: 'var(--text-muted)' }} />
                    <h3>Detalle por Contenedor</h3>
                </div>
                <div className="table-scroll-wrap" style={{ overflowX: 'auto' }}>
                    <table className="table-dark">
                        <thead>
                            <tr>
                                <th>Alias</th>
                                <th>Nombre / ID</th>
                                <th>RAM Actual (MB)</th>
                                <th>RAM Pico (MB)</th>
                                <th>Estado</th>
                                <th>Restarts</th>
                                <th>PIDs</th>
                                <th>Logs</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(project.containerMap).map(([cid, rawAlias], i) => {
                                const alias = rawAlias.trim();
                                const lastPoint = ramData[ramData.length - 1];
                                const ramMB = lastPoint ? (lastPoint[alias] as number | undefined) : undefined;
                                const peakMB = ramMB !== undefined
                                    ? Math.max(...ramData.map(p => (p[alias] as number) || 0))
                                    : undefined;
                                const isOnline = ramMB !== undefined && ramMB > 0;

                                return (
                                    <tr key={cid}>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: LINE_COLORS[i % LINE_COLORS.length], flexShrink: 0 }} />
                                                <strong>{alias}</strong>
                                            </div>
                                        </td>
                                        <td><span className="font-mono text-muted text-sm">{cid.trim()}</span></td>
                                        <td style={{ color: 'var(--accent)', fontWeight: 600 }}>
                                            {ramMB !== undefined ? (Math.round(ramMB * 100) / 100) : '—'}
                                        </td>
                                        <td style={{ color: 'var(--text-muted)' }}>
                                            {peakMB !== undefined ? peakMB.toFixed(1) : '—'}
                                        </td>
                                        <td>
                                            <span className={`badge ${isOnline ? 'badge-online' : 'badge-offline'}`}>
                                                <span className="dot-blink" />
                                                {isOnline ? 'Online' : 'Offline'}
                                            </span>
                                        </td>
                                        <td>
                                            {(() => {
                                                const r = containerStatus[alias]?.restarts ?? 0;
                                                const c = r === 0 ? '#34d399' : r <= 3 ? '#f59e0b' : '#fb7185';
                                                return (
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: 4, background: `${c}22`, color: c }}>
                                                        {r}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                                            {containerStatus[alias]?.pids ?? 0}
                                        </td>
                                        <td>
                                            <button
                                                title="Ver logs"
                                                onClick={() => setLogViewer({ containerId: cid, alias })}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem' }}
                                            >
                                                <TerminalIcon size={14} />
                                            </button>
                                        </td>
                                        <td>
                                            <ContainerActions
                                                projectId={Number(id)}
                                                containerId={cid}
                                                alias={alias}
                                                onActionDone={fetchAll}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Log Viewer modal */}
            {
                logViewer && (
                    <LogViewer
                        projectId={Number(id)}
                        containerId={logViewer.containerId}
                        containerAlias={logViewer.alias}
                        onClose={() => setLogViewer(null)}
                    />
                )
            }

            {project && (
                <TerminalModal
                    isOpen={isTerminalOpen}
                    onClose={() => setIsTerminalOpen(false)}
                    projectId={project.id}
                    projectName={project.name}
                />
            )}
        </div>
    );
};

export default ProjectDetail;
