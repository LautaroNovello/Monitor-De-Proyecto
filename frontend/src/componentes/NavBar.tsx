import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';

const ROUTE_TITLES: Record<string, string> = {
    '/': 'Dashboard Global',
    '/projects/new': 'Nuevo Proyecto',
    '/settings': 'Configuración',
};

interface NavBarProps {
    onMobileMenuClick: () => void;
}

const NavBar: React.FC<NavBarProps> = ({ onMobileMenuClick }) => {
    const location = useLocation();

    const projectMatch = location.pathname.match(/^\/projects\/(\d+)/);
    const isEdit = location.pathname.includes('/edit');
    const title = projectMatch
        ? (isEdit ? 'Editar Proyecto' : 'Detalle de Proyecto')
        : (ROUTE_TITLES[location.pathname] ?? 'ORACLE');

    return (
        <header className="topbar">
            <div className="topbar-breadcrumb">
                {/* Botón hamburger — solo visible en móvil */}
                <button
                    className="btn-icon topbar-mobile-menu"
                    onClick={onMobileMenuClick}
                    aria-label="Abrir menú"
                >
                    <Menu size={20} />
                </button>
                <span className="text-muted text-sm">ORACLE</span>
                <span className="text-muted text-sm">/</span>
                <span className="topbar-title">{title}</span>
            </div>

            <div className="topbar-right">
                <span className="badge badge-live">
                    <span className="dot-blink" />
                    En vivo
                </span>
            </div>
        </header>
    );
};

export default NavBar;
