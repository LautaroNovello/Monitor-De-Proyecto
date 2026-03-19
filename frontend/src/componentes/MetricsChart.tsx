import React, { useState } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { MetricPoint } from '../types/project';

// ── Paleta de colores ────────────────────────────────────────────────
const COLORS = ['#00f5d4', '#818cf8', '#f59e0b', '#fb7185', '#34d399', '#60a5fa'];

// ── Tooltip Batman ─────────────────────────────────────────────────
const BatmanTooltip = ({ active, payload, label, unit = '' }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#0b0e14',
            border: '1px solid #00f5d4',
            borderRadius: 8,
            padding: '0.6rem 0.9rem',
            fontSize: '0.78rem',
            boxShadow: '0 0 12px rgba(0,245,212,0.15)',
            minWidth: 140,
        }}>
            <p style={{ color: '#00f5d4', fontWeight: 700, marginBottom: '0.4rem', letterSpacing: '0.04em' }}>
                {label}
            </p>
            {payload.map((p: any, i: number) => (
                <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', gap: '1rem',
                    color: '#cdd6f4', marginBottom: '0.15rem',
                }}>
                    <span style={{ color: p.color }}>{p.name}</span>
                    <strong style={{ color: '#e2e8f0' }}>{
                        typeof p.value === 'number' ? p.value.toFixed(2) : p.value
                    }{unit}</strong>
                </div>
            ))}
        </div>
    );
};

// ── Componente de gráfico individual ───────────────────────────────
interface ChartProps {
    title: string;
    icon: React.ReactNode;
    data: MetricPoint[];
    containers: string[];
    unit?: string;
    yDomain?: [number | 'auto', number | 'auto'];
    accentColor?: string;
    customColors?: string[];
    onNext?: () => void;
    onPrev?: () => void;
    pagination?: {
        current: number;
        total: number;
    };
}

const MetricAreaChart: React.FC<ChartProps> = ({
    title, icon, data, containers, unit = '', yDomain = [0, 'auto'], accentColor = '#00f5d4', customColors,
    onNext, onPrev, pagination
}) => {
    const palette = customColors ?? COLORS;
    const [touchStart, setTouchStart] = React.useState<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStart === null) return;
        const touchEnd = e.changedTouches[0].clientX;
        const diff = touchStart - touchEnd;

        if (Math.abs(diff) > 50) { // Umbral de swipe
            if (diff > 0 && onNext) onNext();
            else if (diff < 0 && onPrev) onPrev();
        }
        setTouchStart(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowRight' && onNext) onNext();
        if (e.key === 'ArrowLeft' && onPrev) onPrev();
    };

    return (
        <div
            className="card"
            style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                outline: 'none',
                position: 'relative',
                cursor: (onNext || onPrev) ? 'grab' : 'default',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
            tabIndex={(onNext || onPrev) ? 0 : -1}
            onTouchStart={(onNext || onPrev) ? handleTouchStart : undefined}
            onTouchEnd={(onNext || onPrev) ? handleTouchEnd : undefined}
            onKeyDown={(onNext || onPrev) ? handleKeyDown : undefined}
        >
            <div className="flex items-center justify-between" style={{ marginBottom: '1.1rem' }}>
                <div className="flex items-center gap-2">
                    <span style={{ color: accentColor }}>{icon}</span>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600 }}>{title}</h3>
                </div>
                {/* Flechas eliminadas a petición del usuario para una UI más limpia */}
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                        <defs>
                            {containers.map((alias, i) => (
                                <linearGradient key={alias} id={`grad_${title.replace(/\s+/g, '_')}_${i}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={palette[i % palette.length]} stopOpacity={0.07} />
                                    <stop offset="95%" stopColor={palette[i % palette.length]} stopOpacity={0} />
                                </linearGradient>
                            ))}
                        </defs>

                        {/* Grilla tenue */}
                        <CartesianGrid stroke="#30363d" strokeDasharray="3 3" vertical={false} />

                        <XAxis
                            dataKey="time"
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            domain={yDomain}
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={56}
                            tickFormatter={(v: number) => `${v}${unit}`}
                        />

                        <Tooltip content={<BatmanTooltip unit={unit} />} />

                        <Legend
                            iconType="circle"
                            iconSize={7}
                            wrapperStyle={{ fontSize: '0.75rem', paddingTop: '0.5rem', color: '#64748b' }}
                        />

                        {containers.map((alias, i) => (
                            <Area
                                key={alias}
                                type="monotone"
                                dataKey={alias}
                                name={alias}
                                stroke={palette[i % palette.length]}
                                strokeWidth={2}
                                fill={`url(#grad_${title.replace(/\s+/g, '_')}_${i})`}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0 }}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Puntos de paginación */}
            {pagination && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '0.8rem',
                    paddingBottom: '0.5rem',
                    width: '100%'
                }}>
                    {Array.from({ length: pagination.total }).map((_, i) => (
                        <div
                            key={i}
                            style={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                background: i === pagination.current ? '#00f5d4' : '#30363d',
                                boxShadow: i === pagination.current ? `0 0 12px #00f5d4` : 'none',
                                transition: 'all 0.3s ease',
                                cursor: 'pointer',
                                opacity: i === pagination.current ? 1 : 0.3
                            }}
                            onClick={() => {
                                if (i !== pagination.current) {
                                    if (i > pagination.current && onNext) onNext();
                                    else if (i < pagination.current && onPrev) onPrev();
                                }
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Componente principal exportado ─────────────────────────────────
interface MetricsChartProps {
    containers: string[];
    ramData: MetricPoint[];
    cpuData: MetricPoint[];
    netData: MetricPoint[];
    netTotalHistoryData?: MetricPoint[];
    diskData?: MetricPoint[];
    diskTotalHistoryData?: MetricPoint[];
}

const MetricsChart: React.FC<MetricsChartProps> = ({ containers, ramData, cpuData, netData, netTotalHistoryData = [], diskData, diskTotalHistoryData = [] }) => {
    const [netView, setNetView] = useState<'speed' | 'total'>('speed');
    const [diskView, setDiskView] = useState<'speed' | 'total'>('speed');

    const toggleNetView = () => setNetView(prev => prev === 'speed' ? 'total' : 'speed');
    const toggleDiskView = () => setDiskView(prev => prev === 'speed' ? 'total' : 'speed');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Fila 1: RAM + CPU en 2 columnas */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '1rem',
            }}>
                <MetricAreaChart
                    title="Uso de RAM"
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-4 0v2M12 12v4M8 12v2" /></svg>}
                    data={ramData}
                    containers={containers}
                    unit=" MB"
                    yDomain={[0, 'auto']}
                    accentColor="#00f5d4"
                />
                <MetricAreaChart
                    title="Uso de CPU"
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 4v1M15 4v1M9 19v1M15 19v1M4 9h1M4 15h1M19 9h1M19 15h1" /></svg>}
                    data={cpuData}
                    containers={containers}
                    unit="%"
                    yDomain={[0, 'auto']}
                    accentColor="#818cf8"
                />
            </div>

            {/* Fila 2: Network — ancho completo con toggle */}
            <MetricAreaChart
                title={netView === 'speed' ? "Network Speed" : "Network Total"}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>}
                data={netView === 'speed' ? netData : netTotalHistoryData}
                containers={containers}
                unit={netView === 'speed' ? " MB/s" : " GB"}
                yDomain={[0, 'auto']}
                accentColor="#fb7185"
                onNext={toggleNetView}
                onPrev={toggleNetView}
                pagination={{ current: netView === 'speed' ? 0 : 1, total: 2 }}
            />

            {/* Fila 3: Disk I/O — ancho completo con toggle */}
            <MetricAreaChart
                title={diskView === 'speed' ? "Disk Speed" : "Disk Total"}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>}
                data={diskView === 'speed' ? (diskData || []) : diskTotalHistoryData}
                containers={containers}
                unit={diskView === 'speed' ? " MB/s" : " GB"}
                yDomain={[0, 'auto']}
                accentColor="#94a3b8"
                onNext={toggleDiskView}
                onPrev={toggleDiskView}
                pagination={{ current: diskView === 'speed' ? 0 : 1, total: 2 }}
            />
        </div>
    );
};

export default MetricsChart;
