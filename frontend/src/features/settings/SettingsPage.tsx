import React, { useState, useEffect } from 'react';
import {
    Save, RefreshCw, CheckCircle, AlertTriangle,
    Database, Key, Link, FlaskConical, MessageSquare,
    Send, Phone,
} from 'lucide-react';
import { getSettings, upsertSetting, testTwilio } from '../../api/settingsService';
import NotificationManager from './NotificationManager';

// Definición de los settings que maneja el sistema
const SETTING_FIELDS = [
    {
        section: 'InfluxDB',
        icon: Database,
        color: '#818cf8',
        fields: [
            {
                key: 'INFLUX_URL',
                label: 'URL de InfluxDB',
                placeholder: 'http://influxdb:8086',
                icon: Link,
                hint: 'En Docker usa "http://influxdb:8086". Si es externo, usa la IP/Host real.',
            },
            {
                key: 'INFLUX_TOKEN',
                label: 'Token de acceso',
                placeholder: 'Tu token de InfluxDB...',
                icon: Key,
                type: 'password',
                hint: 'Encontralo en InfluxDB → Data → Tokens.',
            },
            {
                key: 'INFLUX_ORG',
                label: 'Organización',
                placeholder: 'UTN',
                icon: FlaskConical,
                hint: 'Nombre de la Organización en InfluxDB.',
            },
            {
                key: 'INFLUX_BUCKET',
                label: 'Bucket de InfluxDB',
                placeholder: 'oracle_metrics',
                icon: Link,
                hint: 'El nombre del bucket que creaste para las métricas.',
            },
        ],
    },
    {
        section: 'Twilio / WhatsApp',
        icon: MessageSquare,
        color: '#25D366',
        fields: [
            {
                key: 'TWILIO_ACCOUNT_SID',
                label: 'Account SID',
                placeholder: 'ACxxxxxxxxxxxxxxx',
                icon: Key,
                hint: 'Empieza con "AC". Encontralo en tu consola de Twilio.',
            },
            {
                key: 'TWILIO_AUTH_TOKEN',
                label: 'Auth Token',
                placeholder: 'Tu auth token...',
                icon: Key,
                type: 'password',
                hint: 'Token de autenticación de tu cuenta Twilio.',
            },
            {
                key: 'TWILIO_WHATSAPP_FROM',
                label: 'Número WhatsApp (From)',
                placeholder: '+14155238886',
                icon: MessageSquare,
                hint: 'Solo el número con código de país. El prefijo "whatsapp:" se agrega automáticamente.',
            },
        ],
    },
];

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SectionCardProps {
    section: typeof SETTING_FIELDS[0];
    values: Record<string, string>;
    saveStatus: Record<string, SaveStatus>;
    onChangeValue: (key: string, value: string) => void;
    onSave: (key: string) => void;
}

const SectionCard: React.FC<SectionCardProps> = ({ section, values, saveStatus, onChangeValue, onSave }) => {
    const SectionIcon = section.icon;
    return (
        <div className="card" style={{ height: '100%' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '1.25rem' }}>
                <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: `${section.color}18`,
                    border: `1px solid ${section.color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    <SectionIcon size={16} style={{ color: section.color }} />
                </div>
                <h3 style={{ color: 'var(--text)', margin: 0 }}>{section.section}</h3>
            </div>

            <div className="flex-col gap-3">
                {section.fields.map(field => {
                    const status = saveStatus[field.key] ?? 'idle';
                    const FieldIcon = field.icon;
                    return (
                        <div key={field.key} className="form-group">
                            <label className="form-label">{field.label}</label>
                            <div className="flex gap-2 form-row-wrap">
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <div style={{
                                        position: 'absolute', left: '0.7rem', top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--text-muted)', pointerEvents: 'none',
                                    }}>
                                        <FieldIcon size={14} />
                                    </div>
                                    <input
                                        className="input-dark font-mono"
                                        style={{ paddingLeft: '2.2rem' }}
                                        type={field.type === 'password' ? 'password' : (field.type === 'number' ? 'number' : 'text')}
                                        placeholder={field.placeholder}
                                        value={values[field.key] ?? ''}
                                        onChange={e => onChangeValue(field.key, e.target.value)}
                                    />
                                </div>
                                <button
                                    className="btn-ghost"
                                    style={{ flexShrink: 0, minWidth: 84 }}
                                    onClick={() => onSave(field.key)}
                                    disabled={status === 'saving'}
                                >
                                    {status === 'saving' && <span className="spinner" />}
                                    {status === 'saved' && <CheckCircle size={14} style={{ color: 'var(--success)' }} />}
                                    {status === 'error' && <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />}
                                    {status === 'idle' && <Save size={14} />}
                                    {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Guardado' : status === 'error' ? 'Error' : 'Guardar'}
                                </button>
                            </div>
                            <span className="text-xs text-muted">{field.hint}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const SettingsPage: React.FC = () => {
    const [values, setValues] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
    const [loadError, setLoadError] = useState<string | null>(null);

    // Twilio test state
    const [testPhone, setTestPhone] = useState('');
    const [twilioTestStatus, setTwilioTestStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
    const [twilioTestMsg, setTwilioTestMsg] = useState('');

    useEffect(() => {
        const defaults: Record<string, string> = {};
        SETTING_FIELDS.forEach(s => s.fields.forEach(f => (defaults[f.key] = '')));
        setValues(defaults);
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const data = await getSettings();
            const loaded: Record<string, string> = {};
            data.forEach(s => (loaded[s.key] = s.value));
            setValues(prev => ({ ...prev, ...loaded }));
        } catch {
            setLoadError('No se pudo conectar con el backend para cargar la configuración.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadSettings(); }, []);

    const handleSave = async (key: string) => {
        setSaveStatus(prev => ({ ...prev, [key]: 'saving' }));
        try {
            await upsertSetting(key, values[key] ?? '');
            setSaveStatus(prev => ({ ...prev, [key]: 'saved' }));
            setTimeout(() => setSaveStatus(prev => ({ ...prev, [key]: 'idle' })), 2500);
        } catch {
            setSaveStatus(prev => ({ ...prev, [key]: 'error' }));
            setTimeout(() => setSaveStatus(prev => ({ ...prev, [key]: 'idle' })), 3000);
        }
    };

    const handleSaveAll = async () => {
        const keys = SETTING_FIELDS.flatMap(s => s.fields.map(f => f.key));
        await Promise.all(keys.map(k => handleSave(k)));
    };

    const handleChangeValue = (key: string, value: string) =>
        setValues(prev => ({ ...prev, [key]: value }));

    return (
        <div>
            {/* Header */}
            <div className="section-header" style={{ marginBottom: '1.5rem' }}>
                <div>
                    <h2>Configuración</h2>
                    <p className="text-sm text-muted" style={{ marginTop: '0.2rem' }}>
                        Credenciales, conexiones y parámetros del sistema
                    </p>
                </div>
                <div className="flex gap-2">
                    <button className="btn-ghost" onClick={loadSettings} disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'spinner' : ''} />
                        Recargar
                    </button>
                    <button className="btn-primary" onClick={handleSaveAll} disabled={loading}>
                        <Save size={14} />
                        Guardar todo
                    </button>
                </div>
            </div>

            {/* Error */}
            {loadError && (
                <div className="card" style={{ borderColor: 'var(--danger)', background: 'var(--danger-dim)', marginBottom: '1.25rem' }}>
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                        <span style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{loadError}</span>
                    </div>
                </div>
            )}

            {/* Loader */}
            {loading && (
                <div className="empty-state" style={{ padding: '2rem' }}>
                    <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                    <p>Cargando configuración...</p>
                </div>
            )}

            {!loading && (
                <>
                    {/* ── Fila 1: InfluxDB ── */}
                    <div style={{ marginBottom: '1rem' }}>
                        <SectionCard section={SETTING_FIELDS[0]} values={values} saveStatus={saveStatus} onChangeValue={handleChangeValue} onSave={handleSave} />
                    </div>

                    {/* ── Fila 2: Twilio (izq) + Contactos y Alertas (der) ── */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                        gap: '1rem',
                        marginBottom: '1rem',
                        alignItems: 'start',
                    }}>
                        <div>
                            <SectionCard section={SETTING_FIELDS[1]} values={values} saveStatus={saveStatus} onChangeValue={handleChangeValue} onSave={handleSave} />
                        </div>
                        <div>
                            <NotificationManager />

                            {/* ── Test Twilio ── */}
                            <div className="card" style={{ marginTop: '1rem' }}>
                                <div className="flex items-center gap-2" style={{ marginBottom: '0.75rem' }}>
                                    <div style={{
                                        width: 30, height: 30, borderRadius: 8,
                                        background: 'rgba(37,211,102,0.1)',
                                        border: '1px solid rgba(37,211,102,0.3)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <Send size={14} style={{ color: '#25D366' }} />
                                    </div>
                                    <div>
                                        <h3 style={{ color: 'var(--text)', margin: 0, fontSize: '0.9rem' }}>Probar Twilio</h3>
                                        <span className="text-xs text-muted">Enviá un mensaje de prueba para verificar la configuración</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 form-row-wrap">
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <div style={{
                                            position: 'absolute', left: '0.7rem', top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: 'var(--text-muted)', pointerEvents: 'none',
                                        }}>
                                            <Phone size={14} />
                                        </div>
                                        <input
                                            className="input-dark font-mono"
                                            style={{ paddingLeft: '2.2rem' }}
                                            placeholder="+5491112345678"
                                            value={testPhone}
                                            onChange={e => setTestPhone(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        className="btn-ghost"
                                        style={{ flexShrink: 0, minWidth: 120 }}
                                        disabled={twilioTestStatus === 'sending' || !testPhone.trim()}
                                        onClick={async () => {
                                            setTwilioTestStatus('sending');
                                            setTwilioTestMsg('');
                                            try {
                                                const res = await testTwilio(testPhone.trim());
                                                setTwilioTestStatus(res.ok ? 'ok' : 'error');
                                                setTwilioTestMsg(res.message);
                                            } catch {
                                                setTwilioTestStatus('error');
                                                setTwilioTestMsg('No se pudo conectar con el backend.');
                                            }
                                            setTimeout(() => setTwilioTestStatus('idle'), 5000);
                                        }}
                                    >
                                        {twilioTestStatus === 'sending' && <span className="spinner" />}
                                        {twilioTestStatus === 'ok' && <CheckCircle size={14} style={{ color: 'var(--success)' }} />}
                                        {twilioTestStatus === 'error' && <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />}
                                        {twilioTestStatus === 'idle' && <Send size={14} />}
                                        {twilioTestStatus === 'sending' ? 'Enviando...' : twilioTestStatus === 'ok' ? 'Enviado' : twilioTestStatus === 'error' ? 'Error' : 'Enviar Test'}
                                    </button>
                                </div>
                                {twilioTestMsg && (
                                    <div className="flex items-center gap-1" style={{
                                        marginTop: '0.5rem',
                                        color: twilioTestStatus === 'ok' ? 'var(--success)' : 'var(--danger)',
                                        fontSize: '0.8rem',
                                    }}>
                                        {twilioTestStatus === 'ok' ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
                                        <span>{twilioTestMsg}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Nota al pie ── */}
                    <div className="card" style={{ background: 'transparent', borderStyle: 'dashed' }}>
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                            <p className="text-xs text-muted">
                                El <strong style={{ color: 'var(--text)' }}>INFLUX_TOKEN</strong> se usa automáticamente en el próximo ciclo de scraping.
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default SettingsPage;
