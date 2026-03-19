import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlusCircle, Trash2, ArrowLeft, CheckCircle, XCircle, Loader, Wifi, Clock, Server } from 'lucide-react';
import { createProject, updateProject, getProjectById, testEndpoint } from '../../api/projectService';
import { ContainerEntry } from '../../types/project';

type TestStatus = 'idle' | 'loading' | 'ok' | 'fail';

const AddProjectsForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEdit = !!id;

    // Campos básicos
    const [name, setName] = useState('');
    const [ec2Url, setEc2Url] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [sshUser, setSshUser] = useState('');
    const [sshKey, setSshKey] = useState('');
    const [scrapingInterval, setScrapingInterval] = useState(10);
    const [maxRamMb, setMaxRamMb] = useState(2048);

    // Container mapper dinámico
    const [containers, setContainers] = useState<ContainerEntry[]>([
        { containerId: '', alias: '' },
    ]);

    // Estado UI
    const [testStatus, setTestStatus] = useState<TestStatus>('idle');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(isEdit);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Cargar datos si es edición
    useEffect(() => {
        if (isEdit) {
            const fetchProject = async () => {
                try {
                    const project = await getProjectById(Number(id));
                    setName(project.name);
                    setEc2Url(project.ec2Url);
                    setIsActive(project.isActive);
                    setSshUser(project.sshUser || '');
                    setSshKey(project.sshKey || '');
                    setScrapingInterval(project.scrapingInterval ?? 10);
                    setMaxRamMb(project.maxRamMb ?? 2048);

                    // Convertir Record<string, string> a ContainerEntry[]
                    const entries: ContainerEntry[] = Object.entries(project.containerMap).map(
                        ([cid, alias]) => ({ containerId: cid, alias })
                    );
                    setContainers(entries.length > 0 ? entries : [{ containerId: '', alias: '' }]);
                } catch {
                    setErrors({ form: 'No se pudo cargar la información del proyecto.' });
                } finally {
                    setLoading(false);
                }
            };
            fetchProject();
        }
    }, [id, isEdit]);

    /* ── Container mapper helpers ── */
    const addContainer = () =>
        setContainers(prev => [...prev, { containerId: '', alias: '' }]);

    const removeContainer = (i: number) =>
        setContainers(prev => prev.filter((_, idx) => idx !== i));

    const updateContainer = (i: number, field: keyof ContainerEntry, value: string) =>
        setContainers(prev =>
            prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c))
        );

    /* ── Test de conexión ── */
    const handleTest = async () => {
        if (!ec2Url.startsWith('http')) {
            setErrors(e => ({ ...e, ec2Url: 'La URL debe empezar con http:// o https://' }));
            return;
        }
        setErrors(e => ({ ...e, ec2Url: '' }));
        setTestStatus('loading');
        const ok = await testEndpoint(ec2Url);
        setTestStatus(ok ? 'ok' : 'fail');
    };

    /* ── Validación ── */
    const validate = () => {
        const errs: Record<string, string> = {};
        if (!name.trim()) errs.name = 'El nombre es requerido.';
        if (!ec2Url.startsWith('http'))
            errs.ec2Url = 'La URL debe empezar con http:// o https://';
        const filledContainers = containers.filter(c => c.containerId || c.alias);
        filledContainers.forEach((c, i) => {
            if (!c.containerId) errs[`container_id_${i}`] = 'Requerido.';
            if (!c.alias) errs[`container_alias_${i}`] = 'Requerido.';
        });
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    /* ── Submit ── */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        const cleanedContainers = containers.map(c => ({
            containerId: c.containerId.trim(),
            alias: c.alias.trim()
        }));
        try {
            if (isEdit) {
                await updateProject(Number(id), { name, ec2Url, containers: cleanedContainers, isActive, scrapingInterval, maxRamMb, sshUser, sshKey });
            } else {
                await createProject({ name, ec2Url, containers: cleanedContainers, isActive, scrapingInterval, maxRamMb, sshUser, sshKey });
            }
            navigate(isEdit ? `/projects/${id}` : '/');
        } catch {
            setErrors(prev => ({ ...prev, form: 'Error al guardar. Verificá que el backend esté activo.' }));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-2" style={{ marginBottom: '1.5rem' }}>
                <button className="btn-icon" onClick={() => navigate(-1)}>
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <h2>{isEdit ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h2>
                    <p className="text-sm text-muted">
                        {isEdit ? `Modificando configuración de ${name}` : 'Configurá un nuevo sistema para monitorear'}
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="empty-state" style={{ padding: '4rem' }}>
                    <Loader className="spinner" size={32} />
                    <p>Cargando datos del proyecto...</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit}>
                    <div className="project-form-grid">
                        {/* ── Columna izquierda: Datos Básicos + SSH ── */}
                        <div className="project-form-left">

                            {/* ── Sección 1: Datos básicos ── */}
                            <div className="card" style={{ marginBottom: '1rem' }}>
                                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{
                                        width: 22, height: 22, borderRadius: 6,
                                        background: 'var(--accent)', color: '#000',
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.72rem', fontWeight: 700,
                                    }}>1</span>
                                    Datos Básicos
                                </h3>

                                <div className="flex-col gap-3">
                                    <div className="form-group">
                                        <label className="form-label">Nombre del Proyecto</label>
                                        <input
                                            className={`input-dark ${errors.name ? 'error' : ''}`}
                                            placeholder="Ej: Almaroja, CanchasBalta..."
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                        />
                                        {errors.name && <span className="form-error">{errors.name}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">URL o IP de la Instancia</label>
                                        <div className="flex gap-2 form-row-wrap">
                                            <input
                                                className={`input-dark ${errors.ec2Url ? 'error' : ''}`}
                                                placeholder="http://18.188.151.206"
                                                value={ec2Url}
                                                onChange={e => { setEc2Url(e.target.value); setTestStatus('idle'); }}
                                            />
                                            <button
                                                type="button"
                                                className="btn-ghost"
                                                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                                                onClick={handleTest}
                                                disabled={testStatus === 'loading'}
                                            >
                                                {testStatus === 'loading' ? (
                                                    <><span className="spinner" /> Probando...</>
                                                ) : (
                                                    <><Wifi size={14} /> Test</>
                                                )}
                                            </button>
                                        </div>
                                        {errors.ec2Url && <span className="form-error">{errors.ec2Url}</span>}

                                        {/* Resultado del test */}
                                        {testStatus === 'ok' && (
                                            <div className="flex items-center gap-1 mt-1" style={{ color: 'var(--success)' }}>
                                                <CheckCircle size={14} />
                                                <span className="text-sm">Conexión exitosa</span>
                                            </div>
                                        )}
                                        {testStatus === 'fail' && (
                                            <div className="flex items-center gap-1 mt-1" style={{ color: 'var(--danger)' }}>
                                                <XCircle size={14} />
                                                <span className="text-sm">Sin respuesta — revisá la URL o el firewall</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
                                        <input
                                            id="isActive"
                                            type="checkbox"
                                            checked={isActive}
                                            onChange={e => setIsActive(e.target.checked)}
                                            style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }}
                                        />
                                        <label htmlFor="isActive" style={{ cursor: 'pointer', color: 'var(--text)', margin: 0 }}>
                                            Activar monitoreo al guardar
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* ── Sección 1b: Acceso SSH ── */}
                            <div className="card" style={{ marginBottom: '1rem' }}>
                                <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{
                                        width: 22, height: 22, borderRadius: 6,
                                        background: 'rgba(129,140,248,0.2)', color: '#818cf8',
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.65rem', fontWeight: 700,
                                    }}>SSH</span>
                                    Acceso SSH
                                    <span className="text-xs text-muted" style={{ fontWeight: 400 }}>— opcional, para Logs y Acciones</span>
                                </h3>
                                <div className="flex-col gap-3">
                                    <div className="form-group">
                                        <label className="form-label">Usuario SSH</label>
                                        <input
                                            className="input-dark font-mono"
                                            placeholder="ec2-user, ubuntu, admin..."
                                            value={sshUser}
                                            onChange={e => setSshUser(e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Clave privada (.pem) — pegá el contenido</label>
                                        <textarea
                                            className="input-dark font-mono"
                                            style={{ height: 110, resize: 'vertical', fontSize: '0.7rem', lineHeight: 1.5 }}
                                            placeholder={"-----BEGIN RSA PRIVATE KEY-----\nMIIEo...\n-----END RSA PRIVATE KEY-----"}
                                            value={sshKey}
                                            onChange={e => setSshKey(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ── Sección 1c: Monitoreo ── */}
                            <div className="card" style={{ marginBottom: '1rem' }}>
                                <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{
                                        width: 22, height: 22, borderRadius: 6,
                                        background: 'rgba(52,211,153,0.15)', color: '#34d399',
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <Clock size={13} />
                                    </span>
                                    Monitoreo
                                </h3>
                                <div className="flex-col gap-3">
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                            <Clock size={12} /> Frecuencia de scraping (seg)
                                        </label>
                                        <input
                                            type="number"
                                            min={5}
                                            className="input-dark"
                                            value={scrapingInterval}
                                            onChange={e => setScrapingInterval(Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                            <Server size={12} /> RAM máxima de la instancia (MB)
                                        </label>
                                        <input
                                            type="number"
                                            min={256}
                                            className="input-dark"
                                            value={maxRamMb}
                                            onChange={e => setMaxRamMb(Number(e.target.value))}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ── Sección 2: Container Mapper ── */}
                        </div>{/* /project-form-left */}

                        {/* ── Columna derecha: Container Mapper ── */}
                        <div className="project-form-right">
                            <div className="card" style={{ height: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{
                                            width: 22, height: 22, borderRadius: 6,
                                            background: 'var(--accent)', color: '#000',
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.72rem', fontWeight: 700,
                                        }}>2</span>
                                        Container Mapper
                                    </h3>
                                    <button type="button" className="btn-ghost" onClick={addContainer} style={{ fontSize: '0.8rem' }}>
                                        <PlusCircle size={14} /> Añadir contenedor
                                    </button>
                                </div>

                                <p className="text-sm text-muted" style={{ marginBottom: '1rem' }}>
                                    Mapeá el **Nombre** (name en docker-compose) o ID del contenedor a un alias legible.
                                </p>

                                {/* Header de columnas */}
                                <div className="container-grid-header" style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr 36px',
                                    gap: '0.5rem',
                                    marginBottom: '0.5rem',
                                }}>
                                    <span className="form-label">Nombre o ID del Contenedor</span>
                                    <span className="form-label">Alias (nombre en gráfico)</span>
                                    <span />
                                </div>

                                <div className="flex-col gap-2">
                                    {containers.map((c, i) => (
                                        <div key={i} className="container-grid-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 36px', gap: '0.5rem', alignItems: 'flex-start' }}>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <input
                                                    className={`input-dark font-mono ${errors[`container_id_${i}`] ? 'error' : ''}`}
                                                    placeholder="ej: almaroja-backend"
                                                    value={c.containerId}
                                                    onChange={e => updateContainer(i, 'containerId', e.target.value)}
                                                />
                                                {errors[`container_id_${i}`] && (
                                                    <span className="form-error">{errors[`container_id_${i}`]}</span>
                                                )}
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <input
                                                    className={`input-dark ${errors[`container_alias_${i}`] ? 'error' : ''}`}
                                                    placeholder="nestjs, postgres, nginx..."
                                                    value={c.alias}
                                                    onChange={e => updateContainer(i, 'alias', e.target.value)}
                                                />
                                                {errors[`container_alias_${i}`] && (
                                                    <span className="form-error">{errors[`container_alias_${i}`]}</span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                className="btn-icon"
                                                onClick={() => removeContainer(i)}
                                                disabled={containers.length === 1}
                                                style={{ marginTop: '2px' }}
                                            >
                                                <Trash2 size={15} style={{ color: containers.length === 1 ? 'var(--text-subtle)' : 'var(--danger)' }} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>{/* /project-form-right */}
                    </div>{/* /project-form-grid */}

                    {/* Error general */}
                    {errors.form && (
                        <div className="card" style={{ borderColor: 'var(--danger)', background: 'var(--danger-dim)', marginBottom: '1rem', marginTop: '1rem' }}>
                            <span style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{errors.form}</span>
                        </div>
                    )}

                    {/* Submit */}
                    <div className="flex gap-2" style={{ marginTop: '1rem' }}>
                        <button type="submit" className="btn-primary" disabled={saving}>
                            {saving ? <><Loader size={15} className="spinner" /> Guardando...</> : 'Guardar Proyecto'}
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>
                            Cancelar
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default AddProjectsForm;
