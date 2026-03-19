import React, { useState, useEffect } from 'react';
import { PlusCircle, RefreshCw, Activity, Server, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getProjects } from '../../api/projectService';
import { Project } from '../../types/project';
import ProjectList from '../projects/ProjectList';
import HostGaugeCard from '../../componentes/HostGaugeCard';

const GlobalDashboard: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const fetchProjects = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getProjects();
            setProjects(data);
        } catch {
            setError('No se pudo conectar con el backend. Verificá que esté corriendo en puerto 3001.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProjects(); }, []);

    const activeCount = projects.filter(p => p.isActive).length;
    const totalContainers = projects.reduce(
        (acc, p) => acc + Object.keys(p.containerMap || {}).length, 0
    );

    return (
        <div>
            {/* Header */}
            <div className="section-header">
                <div>
                    <h2>Dashboard Global</h2>
                    <p className="text-sm text-muted" style={{ marginTop: '0.2rem' }}>
                        Vista general de todos los sistemas monitoreados
                    </p>
                </div>
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    <button className="btn-ghost" onClick={fetchProjects} disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'spinner' : ''} />
                        Actualizar
                    </button>
                    <button className="btn-primary" onClick={() => navigate('/projects/new')}>
                        <PlusCircle size={15} />
                        Nuevo Proyecto
                    </button>
                </div>
            </div>

            {/* Stats rápidas */}
            {!loading && projects.length > 0 && (
                <div className="grid-3" style={{ marginBottom: '1.75rem' }}>
                    <div className="card">
                        <div className="card-title">Total Proyectos</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
                            {projects.length}
                        </div>
                        <div className="text-xs text-muted" style={{ marginTop: '0.35rem' }}>
                            sistemas registrados
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-title">Proyectos Activos</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)', lineHeight: 1 }}>
                            {activeCount}
                        </div>
                        <div className="flex items-center gap-1" style={{ marginTop: '0.35rem' }}>
                            <Activity size={12} style={{ color: 'var(--success)' }} />
                            <span className="text-xs" style={{ color: 'var(--success)' }}>online ahora</span>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-title">Total Contenedores</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                            {totalContainers}
                        </div>
                        <div className="flex items-center gap-1" style={{ marginTop: '0.35rem' }}>
                            <Server size={12} style={{ color: 'var(--text-muted)' }} />
                            <span className="text-xs text-muted">en todos los sistemas</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Gauge de capacidad por proyecto */}
            {!loading && projects.length > 0 && (
                <div style={{ marginBottom: '1.75rem' }}>
                    <div className="section-header" style={{ marginBottom: '0.75rem' }}>
                        <h3>Capacidad de la Instancia</h3>
                        <span className="text-xs text-muted">actualiza cada 15 s</span>
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                        gap: '1rem',
                    }}>
                        {projects.map(p => (
                            <HostGaugeCard
                                key={p.id}
                                projectId={p.id}
                                instanceName={p.name}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div
                    className="card"
                    style={{ borderColor: 'var(--danger)', background: 'var(--danger-dim)', marginBottom: '1.5rem' }}
                >
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                        <span style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</span>
                    </div>
                </div>
            )}

            {/* Lista de proyectos */}
            {loading ? (
                <div className="empty-state">
                    <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                    <p>Cargando proyectos...</p>
                </div>
            ) : (
                <>
                    {projects.length > 0 && (
                        <div className="section-header" style={{ marginBottom: '0.75rem' }}>
                            <h3>Proyectos</h3>
                            <span className="text-xs text-muted">{projects.length} sistemas</span>
                        </div>
                    )}
                    <ProjectList
                        projects={projects}
                        onProjectDeleted={id => setProjects(prev => prev.filter(p => p.id !== id))}
                    />
                </>
            )}
        </div>
    );
};

export default GlobalDashboard;
