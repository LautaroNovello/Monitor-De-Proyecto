import React, { useState, useEffect, useCallback } from 'react';
import { Cpu, Zap, RefreshCw } from 'lucide-react';
import { getProjectHealth, HostHealth } from '../api/hostService';

// ── Helpers de color según nivel de uso ─────────────────────────────────────
const getStatusConfig = (status: 'ok' | 'warn' | 'critical') => {
    switch (status) {
        case 'critical': return {
            color: '#fb7185',
            glow: 'rgba(251,113,133,0.3)',
            label: 'CRÍTICO',
            icon: '🔴',
            pulse: true,
        };
        case 'warn': return {
            color: '#f59e0b',
            glow: 'rgba(245,158,11,0.25)',
            label: 'PRECAUCIÓN',
            icon: '🟡',
            pulse: false,
        };
        default: return {
            color: '#00f5d4',
            glow: 'rgba(0,245,212,0.2)',
            label: 'SALUDABLE',
            icon: '🟢',
            pulse: false,
        };
    }
};

interface HostCapacityProps {
    projectId: number;
}

const HostCapacity: React.FC<HostCapacityProps> = ({ projectId }) => {
    const [health, setHealth] = useState<HostHealth | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchHealth = useCallback(async () => {
        try {
            const data = await getProjectHealth(projectId);
            setHealth(data);
        } catch {
            // silencioso
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 15_000);
        return () => clearInterval(interval);
    }, [fetchHealth]);

    if (loading) {
        return (
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
                <div className="flex items-center gap-2">
                    <RefreshCw size={14} className="spinner" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-sm text-muted">Midiendo capacidad de la instancia...</span>
                </div>
            </div>
        );
    }

    if (!health) {
        return (
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
                <div className="flex items-center gap-2">
                    <Cpu size={14} style={{ color: 'var(--danger)' }} />
                    <span className="text-sm" style={{ color: 'var(--danger)' }}>
                        No se pudo conectar con el backend.
                    </span>
                </div>
            </div>
        );
    }

    if (!health.hasData) {
        return (
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
                <div className="flex items-center gap-2">
                    <RefreshCw size={14} className="spinner" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-sm text-muted">Esperando el primer ciclo de scraping...</span>
                </div>
            </div>
        );
    }

    if (health.hasData && health.totalUsedMb === 0) {
        return (
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', borderColor: '#f59e0b' }}>
                <div className="flex items-center gap-2">
                    <Cpu size={14} style={{ color: '#f59e0b' }} />
                    <span className="text-sm" style={{ color: '#f59e0b' }}>
                        Sin uso de RAM detectado — verificá que los IDs de contenedores sean correctos.
                    </span>
                </div>
            </div>
        );
    }

    const cfg = getStatusConfig(health.status);
    const pct = Math.min(health.usagePercent, 100);
    const usedGb = (health.totalUsedMb / 1024).toFixed(2);
    const maxGb  = (health.maxMb / 1024).toFixed(1);

    return (
        <div className="card" style={{
            marginBottom: '1.5rem',
            border: `1px solid ${cfg.color}33`,
            boxShadow: `0 0 20px ${cfg.glow}`,
            background: 'var(--bg-card)',
            padding: '1rem 1.25rem',
        }}>
            {/* Header */}
            <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div className="flex items-center gap-2">
                    <Zap size={15} style={{ color: cfg.color }} />
                    <span className="card-title" style={{ margin: 0, color: 'var(--text)' }}>
                        Capacidad de la Instancia
                    </span>
                    <span style={{
                        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
                        padding: '0.15rem 0.45rem', borderRadius: 4,
                        background: `${cfg.color}22`, color: cfg.color,
                        animation: cfg.pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
                    }}>
                        {cfg.icon} {cfg.label}
                    </span>
                </div>
                <span className="text-xs text-muted">
                    {usedGb} GB / {maxGb} GB · {health.usagePercent}%
                </span>
            </div>

            {/* Barra de progreso */}
            <div style={{ height: 8, borderRadius: 100, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{
                    height: '100%', width: `${pct}%`, borderRadius: 100,
                    background: `linear-gradient(90deg, ${cfg.color}aa, ${cfg.color})`,
                    boxShadow: `0 0 8px ${cfg.glow}`,
                    transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
                }} />
            </div>

            {/* Sub-texto */}
            <p className="text-xs text-muted" style={{ marginTop: '0.5rem', lineHeight: 1.4 }}>
                {health.status === 'critical' && '⚠️ Uso crítico — riesgo de OOM Killer.'}
                {health.status === 'warn'     && '🔔 Consumo elevado — cerca del límite de la instancia.'}
                {health.status === 'ok'       && 'Instancia con margen suficiente de memoria disponible.'}
            </p>
        </div>
    );
};

export default HostCapacity;
