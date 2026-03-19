import React, { useState, useEffect } from 'react';
import {
    UserPlus, Trash2, MessageCircle, ChevronRight,
    CheckSquare, Square, Phone, User, AlertTriangle,
} from 'lucide-react';
import {
    getContacts, createContact, deleteContact,
    subscribeContact, unsubscribeContact, testWhatsApp, Contact,
} from '../../api/contactsService';
import { getAllProjects } from '../../api/projectService';
import { Project } from '../../types/project';

const NotificationManager: React.FC = () => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [selected, setSelected] = useState<Contact | null>(null);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [adding, setAdding] = useState(false);
    const [testStatus, setTestStatus] = useState<Record<number, 'idle' | 'loading' | 'done' | 'error'>>({});

    const reload = async () => {
        setLoading(true);
        const [c, p] = await Promise.all([getContacts(), getAllProjects()]);
        setContacts(c);
        setProjects(p);
        setLoading(false);
    };

    useEffect(() => { reload(); }, []);

    const handleAdd = async () => {
        if (!newName.trim() || !newPhone.trim()) return;
        setAdding(true);
        await createContact({ name: newName.trim(), phoneNumber: newPhone.trim() });
        setNewName(''); setNewPhone(''); setAdding(false);
        reload();
    };

    const handleDelete = async (id: number) => {
        await deleteContact(id);
        if (selected?.id === id) setSelected(null);
        reload();
    };

    const toggleProject = async (contact: Contact, project: Project) => {
        const isSub = contact.subscribedProjects.some(p => p.id === project.id);
        if (isSub) await unsubscribeContact(contact.id, project.id);
        else await subscribeContact(contact.id, project.id);
        const fresh = await getContacts();
        setContacts(fresh);
        setSelected(fresh.find(c => c.id === contact.id) ?? null);
    };

    const handleTest = async (id: number) => {
        setTestStatus(prev => ({ ...prev, [id]: 'loading' }));
        try {
            await testWhatsApp(id);
            setTestStatus(prev => ({ ...prev, [id]: 'done' }));
        } catch {
            setTestStatus(prev => ({ ...prev, [id]: 'error' }));
        }
        setTimeout(() => setTestStatus(prev => ({ ...prev, [id]: 'idle' })), 3000);
    };

    return (
        <div className="card">
            <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
                <div>
                    <h3>Gestión de Alertas</h3>
                    <p className="text-xs text-muted">Contactos con notificaciones WhatsApp por proyecto</p>
                </div>
            </div>

            {/* Formulario nuevo contacto */}
            <div className="flex gap-2" style={{ marginBottom: '1rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <User size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input className="input-dark" style={{ paddingLeft: '1.8rem' }} placeholder="Nombre" value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Phone size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input className="input-dark font-mono" style={{ paddingLeft: '1.8rem' }} placeholder="+549111234567" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
                </div>
                <button className="btn-primary" onClick={handleAdd} disabled={adding}>
                    <UserPlus size={14} /> Agregar
                </button>
            </div>

            {loading && <div className="empty-state"><div className="spinner" /></div>}

            {!loading && (
                <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                    {/* Lista de contactos */}
                    <div>
                        {contacts.length === 0 && (
                            <div className="empty-state" style={{ padding: '2rem' }}>
                                <AlertTriangle size={28} style={{ color: 'var(--text-muted)' }} />
                                <p>No hay contactos</p>
                            </div>
                        )}
                        {contacts.map(c => {
                            const ts = testStatus[c.id] ?? 'idle';
                            return (
                                <div
                                    key={c.id}
                                    className="card"
                                    style={{
                                        marginBottom: '0.5rem', cursor: 'pointer', padding: '0.75rem',
                                        border: selected?.id === c.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                                        transition: 'border 0.15s',
                                    }}
                                    onClick={() => setSelected(selected?.id === c.id ? null : c)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span style={{
                                                width: 8, height: 8, borderRadius: '50%',
                                                background: c.subscribedProjects.length > 0 ? '#00f5d4' : '#64748b',
                                                flexShrink: 0,
                                            }} />
                                            <div>
                                                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.name}</span>
                                                <span className="font-mono text-xs text-muted" style={{ marginLeft: 8 }}>{c.phoneNumber}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {/* Chips de proyectos */}
                                            <div className="flex gap-1">
                                                {c.subscribedProjects.map(p => (
                                                    <span key={p.id} style={{
                                                        fontSize: '0.65rem', padding: '0.1rem 0.4rem',
                                                        background: 'rgba(0,245,212,0.1)', color: 'var(--accent)',
                                                        border: '1px solid rgba(0,245,212,0.3)', borderRadius: 4,
                                                    }}>{p.name}</span>
                                                ))}
                                            </div>
                                            {/* Test WhatsApp */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleTest(c.id); }}
                                                title="Enviar mensaje de prueba"
                                                style={{
                                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                                    color: ts === 'done' ? '#34d399' : ts === 'error' ? '#fb7185' : '#25D366',
                                                    padding: '0.2rem',
                                                }}
                                            >
                                                <MessageCircle size={15} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.2rem' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            <ChevronRight size={14} style={{ color: 'var(--text-muted)', transform: selected?.id === c.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Panel lateral de proyectos */}
                    {selected && (
                        <div className="card" style={{ padding: '1rem', alignSelf: 'start' }}>
                            <h3 style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>Proyectos de {selected.name}</h3>
                            {projects.map(p => {
                                const subscribed = selected.subscribedProjects.some(sp => sp.id === p.id);
                                return (
                                    <div
                                        key={p.id}
                                        className="flex items-center gap-2"
                                        style={{ padding: '0.5rem', cursor: 'pointer', borderRadius: 6 }}
                                        onClick={() => toggleProject(selected, p)}
                                    >
                                        {subscribed
                                            ? <CheckSquare size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                            : <Square size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                        }
                                        <span style={{ fontSize: '0.85rem' }}>{p.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationManager;
