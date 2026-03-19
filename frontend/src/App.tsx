import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import './App.css';

import Sidebar from './componentes/Sidebar';
import NavBar from './componentes/NavBar';
import GlobalDashboard from './features/dashboard/GlobalDashboard';
import AddProjectsForm from './features/projects/AddProjectsForm';
import ProjectDetail from './features/projects/ProjectDetail';
import SettingsPage from './features/settings/SettingsPage';
import { getSettingsStatus } from './api/settingsService';

const App: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const checkConfig = async () => {
      try {
        const status = await getSettingsStatus();
        setIsConfigured(status.isConfigured);
      } catch {
        setIsConfigured(false);
      }
    };
    checkConfig();
    // Re-check every 30 seconds or when navigation might have updated settings
    const interval = setInterval(checkConfig, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <BrowserRouter>
      <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(c => !c)}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="main-area">
          <NavBar onMobileMenuClick={() => setMobileOpen(o => !o)} />

          {isConfigured === false && (
            <div className="setup-banner">
              <div className="setup-banner-content">
                <AlertTriangle size={16} />
                <span>InfluxDB no está configurado. El monitoreo no funcionará hasta que completes la configuración.</span>
              </div>
              <Link to="/settings" className="btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }}>
                Configurar ahora <ArrowRight size={14} style={{ marginLeft: '4px' }} />
              </Link>
            </div>
          )}

          <main className="main-content">
            <Routes>
              <Route path="/" element={<GlobalDashboard />} />
              <Route path="/projects/new" element={<AddProjectsForm />} />
              <Route path="/projects/:id/edit" element={<AddProjectsForm />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
};

export default App;
