import React, { useEffect, useRef, useState } from 'react';
import { X, Maximize2, Minimize2, Terminal as TerminalIcon } from 'lucide-react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { io, Socket } from 'socket.io-client';
import 'xterm/css/xterm.css';

interface TerminalModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
    projectName: string;
}

const TerminalModal: React.FC<TerminalModalProps> = ({ isOpen, onClose, projectId, projectName }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const [isMaximized, setIsMaximized] = useState(false);
    const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'closed'>('connecting');
    const statusRef = useRef(status);

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    useEffect(() => {
        if (!isOpen || !terminalRef.current) return;

        // 1. Inicializar XTerm
        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: '"Cascadia Code", Menlo, Monaco, "Courier New", monospace',
            theme: {
                background: '#0b0e14',
                foreground: '#cdd6f4',
                cursor: '#00f5d4',
                selectionBackground: 'rgba(0, 245, 212, 0.3)',
                black: '#1e1e2e',
                red: '#f38ba8',
                green: '#a6e3a1',
                yellow: '#f9e2af',
                blue: '#89b4fa',
                magenta: '#cba6f7',
                cyan: '#89dceb',
                white: '#bac2de',
            },
            allowProposedApi: true
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // 2. Conectar Socket
        const socket = io('http://localhost:3001/terminal');
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('terminal-connect', { projectId });
        });

        socket.on('terminal-ready', () => {
            setStatus('connected');
            term.focus();
        });

        socket.on('terminal-stdout', (data: string) => {
            term.write(data);
        });

        socket.on('terminal-error', (msg: string) => {
            setStatus('error');
            term.write(`\r\n\x1b[31m[ERROR] ${msg}\x1b[0m\r\n`);
        });

        socket.on('terminal-closed', () => {
            setStatus('closed');
            term.write('\r\n\x1b[33m[Session Closed]\x1b[0m\r\n');
        });

        // Eventos de entrada
        term.onData((data) => {
            // Usamos statusRef para evitar el escape del closure stale
            if (statusRef.current === 'connected') {
                socket.emit('terminal-stdin', data);
            }
        });

        term.onResize((size) => {
            socket.emit('terminal-resize', { cols: size.cols, rows: size.rows });
        });

        // 3. Layout handling
        const safeFit = () => {
            if (fitAddonRef.current && terminalRef.current && terminalRef.current.offsetWidth > 0) {
                try {
                    fitAddonRef.current.fit();
                } catch (e) {
                    // Silently fail if layout不是 ready
                    console.warn('Terminal fit failed:', e);
                }
            }
        };

        const resizeObserver = new ResizeObserver(() => {
            safeFit();
        });

        if (terminalRef.current) {
            resizeObserver.observe(terminalRef.current);
        }

        // Initial fit with slight delay to ensure DOM is ready
        const timer = setTimeout(safeFit, 50);

        return () => {
            clearTimeout(timer);
            resizeObserver.disconnect();
            socket.disconnect();
            term.dispose();
            xtermRef.current = null;
            fitAddonRef.current = null;
            socketRef.current = null;
        };
    }, [isOpen, projectId]);

    useEffect(() => {
        // Re-fit when maximizing changes, check for visibility
        const timer = setTimeout(() => {
            if (fitAddonRef.current && terminalRef.current && terminalRef.current.offsetWidth > 0) {
                try {
                    fitAddonRef.current.fit();
                } catch (e) { }
            }
        }, 150);
        return () => clearTimeout(timer);
    }, [isMaximized]);

    if (!isOpen) return null;

    return (
        <div className={`terminal-overlay ${isMaximized ? 'maximized' : ''}`}>
            <div className="terminal-container card">
                <div className="terminal-header flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TerminalIcon size={16} className="text-accent" />
                        <span className="font-mono text-sm">SSH: {projectName}</span>
                        <div className={`status-dot ${status}`} />
                    </div>
                    <div className="terminal-actions flex items-center gap-2">
                        <button onClick={() => setIsMaximized(!isMaximized)} className="btn-icon">
                            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                        <button onClick={onClose} className="btn-icon close">
                            <X size={16} />
                        </button>
                    </div>
                </div>
                <div className="terminal-body" ref={terminalRef} />
            </div>

            <style>{`
                .terminal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.7);
                    backdrop-filter: blur(4px);
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                }
                .terminal-overlay.maximized {
                    padding: 0;
                }
                .terminal-container {
                    width: 100%;
                    max-width: 900px;
                    height: 600px;
                    background: #0b0e14 !important;
                    border: 1px solid var(--border-color);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                }
                .terminal-overlay.maximized .terminal-container {
                    max-width: 100%;
                    height: 100%;
                    border-radius: 0;
                }
                .terminal-header {
                    padding: 0.75rem 1rem;
                    background: #161b22;
                    border-bottom: 1px solid var(--border-color);
                }
                .terminal-body {
                    flex: 1;
                    padding: 0.5rem;
                    overflow: hidden;
                }
                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }
                .status-dot.connecting { background: #f9e2af; box-shadow: 0 0 8px #f9e2af; }
                .status-dot.connected { background: #a6e3a1; box-shadow: 0 0 8px #a6e3a1; }
                .status-dot.error { background: #f38ba8; box-shadow: 0 0 8px #f38ba8; }
                .status-dot.closed { background: #6c7086; }
                
                .terminal-actions .btn-icon {
                    color: var(--text-muted);
                    padding: 4px;
                    border-radius: 4px;
                    transition: all 0.2s;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                }
                .terminal-actions .btn-icon:hover {
                    color: var(--text-light);
                    background: rgba(255,255,255,0.1);
                }
                .terminal-actions .btn-icon.close:hover {
                    color: white;
                    background: #f38ba8;
                }
                .xterm-viewport::-webkit-scrollbar {
                    width: 8px;
                }
                .xterm-viewport::-webkit-scrollbar-track {
                    background: #0b0e14;
                }
                .xterm-viewport::-webkit-scrollbar-thumb {
                    background: #1e1e2e;
                    border-radius: 4px;
                }
            `}</style>
        </div>
    );
};

export default TerminalModal;
