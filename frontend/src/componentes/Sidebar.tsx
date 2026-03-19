import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    Eye, LayoutDashboard, Server, Settings, ChevronRight,
} from 'lucide-react';
import { getProjects } from '../api/projectService';
import { Project } from '../types/project';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
    mobileOpen: boolean;
    onMobileClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectsOpen, setProjectsOpen] = useState(true);
    const location = useLocation();

    const fetchProjects = useCallback(() => {
        getProjects().then(setProjects).catch(() => setProjects([]));
    }, []);

    useEffect(() => { fetchProjects(); }, [fetchProjects]);

    // Re-fetch al navegar (para que aparezcan proyectos nuevos)
    useEffect(() => { fetchProjects(); }, [location, fetchProjects]);

    // En móvil, cerrar sidebar al navegar
    useEffect(() => { onMobileClose(); }, [location]); // eslint-disable-line

    // En modo mobile-open siempre mostramos labels aunque esté colapsado
    const showLabel = !collapsed || mobileOpen;

    return (
        <>
            {/* Overlay móvil */}
            {mobileOpen && (
                <div className="sidebar-overlay" onClick={onMobileClose} />
            )}

            <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
                {/* Logo + toggle */}
                <div className="sidebar-logo">
                    <div
                        className="sidebar-logo-icon"
                        onClick={onToggle}
                        title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
                        style={{ cursor: 'pointer' }}
                    >
                        <Eye size={18} />
                    </div>
                    <div className="sidebar-logo-text-wrap">
                        <div className="sidebar-logo-text">ORACLE</div>
                        <div className="sidebar-logo-subtitle">Monitor v1.0</div>
                    </div>
                </div>

                {/* Nav principal (grow para empujar config al fondo) */}
                <nav className="sidebar-nav">

                    {showLabel && <div className="sidebar-section-label">General</div>}

                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
                        title="Dashboard Global"
                    >
                        <LayoutDashboard size={16} />
                        {showLabel && <span>Dashboard Global</span>}
                    </NavLink>

                    {showLabel && <div className="sidebar-section-label">Proyectos</div>}

                    {/* Botón toggle de proyectos: solo en modo expandido */}
                    {showLabel && (
                        <button
                            className="sidebar-item sidebar-projects-toggle"
                            onClick={() => setProjectsOpen(o => !o)}
                            title="Mis Proyectos"
                        >
                            <Server size={16} />
                            <span style={{ flex: 1, textAlign: 'left' }}>Mis Proyectos</span>
                            <ChevronRight
                                size={14}
                                className={`sidebar-chevron ${projectsOpen ? 'open' : ''}`}
                            />
                        </button>
                    )}

                    {/* Lista proyectos: solo visible cuando no está colapsado */}
                    {showLabel && (
                        <div className={`sidebar-projects-list ${projectsOpen ? 'open' : ''}`}>
                            {projects.length === 0 ? (
                                <div className="sidebar-item sidebar-sub-item text-muted text-sm" style={{ cursor: 'default' }}>
                                    Sin proyectos
                                </div>
                            ) : (
                                projects.map(p => (
                                    <NavLink
                                        key={p.id}
                                        to={`/projects/${p.id}`}
                                        className={({ isActive }) =>
                                            `sidebar-item sidebar-sub-item ${isActive ? 'active' : ''}`
                                        }
                                    >
                                        <span style={{
                                            width: 7, height: 7, borderRadius: '50%',
                                            background: p.isActive ? 'var(--success)' : 'var(--danger)',
                                            flexShrink: 0,
                                        }} />
                                        <span className="truncate">{p.name}</span>
                                    </NavLink>
                                ))
                            )}
                        </div>
                    )}

                    {/* En modo colapsado: solo el ícono de Server para «Proyectos» — sin puntos */}
                    {!showLabel && projects.length > 0 && (
                        <NavLink
                            to={`/projects/${projects[0].id}`}
                            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
                            title={`Proyectos (${projects.length})`}
                        >
                            <Server size={16} />
                        </NavLink>
                    )}
                </nav>

                {/* Configuración anclada al fondo */}
                <div className="sidebar-footer">
                    {showLabel && <div className="sidebar-section-label">Config</div>}
                    <NavLink
                        to="/settings"
                        className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
                        title="Configuración"
                    >
                        <Settings size={16} />
                        {showLabel && <span>Configuración</span>}
                    </NavLink>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
