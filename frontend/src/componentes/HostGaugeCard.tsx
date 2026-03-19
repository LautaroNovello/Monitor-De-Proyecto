import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Cpu } from 'lucide-react';
import { getHostHealth, getProjectHealth, HostHealth } from '../api/hostService';

interface Props {
    instanceName?: string;
    projectId?: number;
}

const STATUS_CONFIG = {
    critical: { color: '#fb7185', glow: 'rgba(251,113,133,0.25)', label: 'CRÍTICO',    icon: '🔴' },
    warn:     { color: '#f59e0b', glow: 'rgba(245,158,11,0.2)',   label: 'PRECAUCIÓN', icon: '🟡' },
    ok:       { color: '#00f5d4', glow: 'rgba(0,245,212,0.15)',   label: 'SALUDABLE',  icon: '🟢' },
} as const;

// ── SVG Gauge math ───────────────────────────────────────────────────────
// SVG coord system: 0° = right (3 o'clock), increases clockwise.
// The gauge arc spans 240° starting at 150° (8 o'clock) → through top → 30° (4 o'clock).
// The 120° gap sits at the bottom, giving a clean speedometer look.
const GCX = 80, GCY = 82, GR = 56, GSTROKE = 12;
const G_FROM  = 150;   // start angle (SVG coords)
const G_SWEEP = 240;   // total arc span

function degXY(deg: number): string {
    const r = (deg * Math.PI) / 180;
    return `${(GCX + GR * Math.cos(r)).toFixed(2)},${(GCY + GR * Math.sin(r)).toFixed(2)}`;
}

// Background track: full 240° arc (largeArc=1, clockwise=1)
// Uses -0.01 to avoid degenerate case when start ≈ end
const BG_ARC = `M ${degXY(G_FROM)} A ${GR},${GR} 0 1,1 ${degXY(G_FROM + G_SWEEP - 0.01)}`;

// Filled arc proportional to pct (0–100)
function fgArc(pct: number): string {
    const clamped = Math.min(Math.max(pct, 0), 99.99);
    if (clamped <= 0) return '';
    const sweep = (clamped / 100) * G_SWEEP;
    const large = sweep > 180 ? 1 : 0;
    return `M ${degXY(G_FROM)} A ${GR},${GR} 0 ${large},1 ${degXY(G_FROM + sweep)}`;
}
// ────────────────────────────────────────────────────────────────────────

const HostGaugeCard: React.FC<Props> = ({ instanceName = 'Instancia AWS', projectId }) => {
    const [health, setHealth] = useState<HostHealth | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchHealth = useCallback(async () => {
        try {
            const data = projectId !== undefined
                ? await getProjectHealth(projectId)
                : await getHostHealth();
            setHealth(data);
        } catch { /* ignora errores de red */ } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchHealth();
        const iv = setInterval(fetchHealth, 15_000);
        return () => clearInterval(iv);
    }, [fetchHealth]);

    // ── States de carga / error ───────────────────────────────────────
    if (loading || !health) {
        return (
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', minWidth: 190 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    {loading
                        ? <RefreshCw size={20} className="spinner" style={{ color: 'var(--text-muted)' }} />
                        : <Cpu size={20} style={{ color: 'var(--danger)' }} />
                    }
                    <p className="text-xs text-muted">
                        {loading ? 'Midiendo capacidad...' : 'Sin conexión con backend'}
                    </p>
                </div>
            </div>
        );
    }

    if (!health.hasData) {
        return (
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', minWidth: 190 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCw size={20} className="spinner" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-xs text-muted">Primer ciclo de scraping...</p>
                </div>
            </div>
        );
    }

    const cfg = STATUS_CONFIG[health.status] ?? STATUS_CONFIG.ok;
    const pct    = Math.min(health.usagePercent, 100);
    const usedGb = (health.totalUsedMb / 1024).toFixed(1);
    const maxGb  = (health.maxMb  / 1024).toFixed(1);

    const displayName = instanceName.length > 34
        ? `${instanceName.slice(0, 31)}…`
        : instanceName;

    return (
        <div
            className="card"
            style={{
                padding: '1.25rem 1rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.4rem',
                border: `1px solid ${cfg.color}33`,
                boxShadow: `0 0 22px ${cfg.glow}`,
                minWidth: 190,
                maxWidth: 230,
            }}
        >
            {/* ── SVG Gauge ─────────────────────────────────────────── */}
            <svg width="160" height="148" viewBox="0 0 160 148" aria-label={`RAM: ${pct}%`}>
                {/* Background track */}
                <path
                    d={BG_ARC}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={GSTROKE}
                    strokeLinecap="round"
                />

                {/* Filled arc */}
                {pct > 0 && (
                    <path
                        d={fgArc(pct)}
                        fill="none"
                        stroke={cfg.color}
                        strokeWidth={GSTROKE}
                        strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 6px ${cfg.color}90)` }}
                    />
                )}

                {/* Percentage */}
                <text
                    x={GCX} y={GCY - 2}
                    textAnchor="middle"
                    fontSize="24"
                    fontWeight="800"
                    fill={cfg.color}
                    fontFamily="system-ui, -apple-system, sans-serif"
                >
                    {pct}%
                </text>

                {/* GB detail */}
                <text
                    x={GCX} y={GCY + 18}
                    textAnchor="middle"
                    fontSize="10.5"
                    fill="#6b7280"
                    fontFamily="system-ui, -apple-system, sans-serif"
                >
                    {usedGb} / {maxGb} GB
                </text>

                {/* Bottom label: RAM */}
                <text
                    x={GCX} y={138}
                    textAnchor="middle"
                    fontSize="9.5"
                    fill="#4b5563"
                    letterSpacing="0.08em"
                    fontFamily="system-ui, -apple-system, sans-serif"
                >
                    RAM USADA
                </text>
            </svg>

            {/* Status badge */}
            <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.07em',
                padding: '0.15rem 0.5rem',
                borderRadius: 4,
                background: `${cfg.color}20`,
                color: cfg.color,
            }}>
                {cfg.icon} {cfg.label}
            </span>

            {/* Instance name */}
            <p
                className="text-xs"
                title={instanceName}
                style={{
                    color: '#6b7280',
                    textAlign: 'center',
                    maxWidth: 170,
                    wordBreak: 'break-all',
                    lineHeight: 1.3,
                    marginTop: '0.1rem',
                }}
            >
                {displayName}
            </p>
        </div>
    );
};

export default HostGaugeCard;
