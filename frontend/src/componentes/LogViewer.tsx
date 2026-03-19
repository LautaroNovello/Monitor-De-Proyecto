import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { X, StopCircle, AlignJustify } from 'lucide-react';
import 'xterm/css/xterm.css';

interface Props {
    projectId: number;
    containerId: string;
    containerAlias: string;
    onClose: () => void;
}

const LogViewer: React.FC<Props> = ({ projectId, containerId, containerAlias, onClose }) => {
    const termRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lines, setLines] = useState<string[]>([]);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [lines, autoScroll]);

    useEffect(() => {
        const socketUrl = process.env.REACT_APP_SOCKET_URL || window.location.origin;
        const socket = io(socketUrl + '/logs', { transports: ['websocket'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            setLines(prev => [...prev, '\x1b[32m● Conectando al contenedor...\x1b[0m']);
            socket.emit('subscribe-logs', { projectId, containerId });
        });

        socket.on('log-connected', () => {
            setLines(prev => [...prev, `\x1b[36m● Stream de logs activo: ${containerAlias}\x1b[0m`]);
        });

        socket.on('log-line', (line: string) => {
            setLines(prev => [...prev, ...line.split('\n').filter(Boolean)]);
        });

        socket.on('log-error', (msg: string) => {
            setError(msg);
            setLines(prev => [...prev, `\x1b[31m✖ ${msg}\x1b[0m`]);
        });

        socket.on('disconnect', () => setConnected(false));

        return () => {
            socket.emit('unsubscribe-logs');
            socket.disconnect();
        };
    }, [projectId, containerId, containerAlias]);

    const clearLogs = () => setLines([]);

    // Función para convertir escape codes ANSI a colores CSS básicos
    /* eslint-disable no-control-regex */
    const ansiToHtml = (line: string) => {
        return line
            .replace(/\x1b\[32m/g, '<span style="color:#34d399">')
            .replace(/\x1b\[36m/g, '<span style="color:#00f5d4">')
            .replace(/\x1b\[31m/g, '<span style="color:#fb7185">')
            .replace(/\x1b\[33m/g, '<span style="color:#f59e0b">')
            .replace(/\x1b\[0m/g, '</span>')
            .replace(/\x1b\[[0-9;]*m/g, ''); // limpiar otros escape codes
    };
    /* eslint-enable no-control-regex */

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                width: '85vw', maxWidth: 900,
                background: '#0b0e14',
                border: '1px solid #00f5d4',
                borderRadius: 10,
                boxShadow: '0 0 40px rgba(0,245,212,0.12)',
                overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.6rem 1rem',
                    borderBottom: '1px solid #1e293b',
                    background: '#0d1117',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: connected ? '#00f5d4' : '#64748b',
                            display: 'inline-block',
                        }} />
                        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#e2e8f0' }}>
                            logs — {containerAlias}
                        </span>
                        {error && <span style={{ color: '#fb7185', fontSize: '0.75rem' }}>{error}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                            onClick={() => setAutoScroll(v => !v)}
                            style={{
                                background: autoScroll ? 'rgba(0,245,212,0.1)' : 'transparent',
                                border: '1px solid', borderColor: autoScroll ? '#00f5d4' : '#30363d',
                                borderRadius: 5, padding: '0.2rem 0.6rem',
                                color: autoScroll ? '#00f5d4' : '#64748b',
                                fontSize: '0.72rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4,
                            }}
                        >
                            <AlignJustify size={11} /> Auto-scroll
                        </button>
                        <button
                            onClick={clearLogs}
                            style={{
                                background: 'transparent', border: '1px solid #30363d',
                                borderRadius: 5, padding: '0.2rem 0.6rem',
                                color: '#64748b', fontSize: '0.72rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4,
                            }}
                        >
                            <StopCircle size={11} /> Limpiar
                        </button>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Log area — div scrolleable con texto monospace, sin xterm */}
                <div
                    ref={termRef}
                    style={{
                        height: 420, overflowY: 'auto', padding: '0.75rem 1rem',
                        background: '#000000', fontFamily: 'Courier New, monospace',
                        fontSize: '0.75rem', lineHeight: 1.5, color: '#e2e8f0',
                    }}
                >
                    {lines.length === 0 && (
                        <span style={{ color: '#334155' }}>Esperando logs...</span>
                    )}
                    {lines.map((line, i) => (
                        <div
                            key={i}
                            dangerouslySetInnerHTML={{ __html: ansiToHtml(line) }}
                            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                        />
                    ))}
                    <div ref={bottomRef} />
                </div>
            </div>
        </div>
    );
};

export default LogViewer;
