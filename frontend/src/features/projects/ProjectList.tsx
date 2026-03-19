import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, ExternalLink, Trash2, Cpu, Settings } from 'lucide-react';
import { Project } from '../../types/project';
import { deleteProject } from '../../api/projectService';

interface Props {
    projects: Project[];
    onProjectDeleted: (id: number) => void;
}

const ProjectList: React.FC<Props> = ({ projects, onProjectDeleted }) => {
    const navigate = useNavigate();

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (!window.confirm('¿Eliminar este proyecto?')) return;
        try {
            await deleteProject(id);
            onProjectDeleted(id);
        } catch {
            alert('Error al eliminar el proyecto');
        }
    };

    if (projects.length === 0) {
        return (
            <div className="empty-state">
                <Server size={48} />
                <div>
                    <h3>No hay proyectos todavía</h3>
                    <p>Agregá tu primer proyecto para empezar a monitorear.</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {projects.map(p => {
                const containerCount = Object.keys(p.containerMap || {}).length;

                return (
                    <div
                        key={p.id}
                        className="card"
                        onClick={() => navigate(`/projects/${p.id}`)}
                        style={{ cursor: 'pointer' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem' }}>
                            <div className="flex items-center gap-2">
                                <div style={{
                                    width: 36, height: 36,
                                    background: 'var(--surface-raised)',
                                    borderRadius: 8,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: '1px solid var(--border)',
                                    color: 'var(--accent)',
                                }}>
                                    <Cpu size={18} />
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, color: 'var(--text)' }}>{p.name}</h4>
                                    <span className="text-xs text-muted">ID: {p.id}</span>
                                </div>
                            </div>
                            <span className={`badge ${p.isActive ? 'badge-online' : 'badge-offline'}`}>
                                <span className="dot-blink" />
                                {p.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>

                        {/* URL */}
                        <div className="flex items-center gap-1 text-sm" style={{ marginBottom: '0.75rem' }}>
                            <ExternalLink size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <span className="font-mono text-xs text-muted truncate">{p.ec2Url}</span>
                        </div>

                        {/* Contenedores */}
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted">
                                    {containerCount} contenedor{containerCount !== 1 ? 'es' : ''}
                                </span>
                                <div className="flex gap-1">
                                    {Object.values(p.containerMap || {}).slice(0, 3).map((alias, i) => (
                                        <span
                                            key={i}
                                            style={{
                                                fontSize: '0.68rem',
                                                fontWeight: 600,
                                                background: 'var(--surface-raised)',
                                                border: '1px solid var(--border)',
                                                borderRadius: 4,
                                                padding: '0.1rem 0.4rem',
                                                color: 'var(--text-muted)',
                                                fontFamily: 'var(--font-mono)',
                                            }}
                                        >
                                            {alias}
                                        </span>
                                    ))}
                                    {containerCount > 3 && (
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            +{containerCount - 3}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Acciones */}
                        <div className="flex justify-between items-center" style={{ marginTop: '0.75rem' }}>
                            <button
                                className="btn-ghost"
                                style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}
                                onClick={e => { e.stopPropagation(); navigate(`/projects/${p.id}`); }}
                            >
                                Ver métricas
                            </button>
                            <div className="flex gap-1">
                                <button
                                    className="btn-icon"
                                    onClick={e => { e.stopPropagation(); navigate(`/projects/${p.id}/edit`); }}
                                    title="Configurar proyecto"
                                >
                                    <Settings size={15} style={{ color: 'var(--text-muted)' }} />
                                </button>
                                <button
                                    className="btn-icon"
                                    onClick={e => handleDelete(e, p.id)}
                                    title="Eliminar proyecto"
                                >
                                    <Trash2 size={15} style={{ color: 'var(--danger)' }} />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ProjectList;
