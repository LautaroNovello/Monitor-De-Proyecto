import React, { useState } from 'react';
import { Square, RefreshCw, Play } from 'lucide-react';
import api from '../api/axiosConfig';

interface Props {
    projectId: number;
    containerId: string;
    alias: string;
    onActionDone?: () => void;
}

type ActionStatus = 'idle' | 'loading' | 'done' | 'error';

const ContainerActions: React.FC<Props> = ({ projectId, containerId, alias, onActionDone }) => {
    const [status, setStatus] = useState<ActionStatus>('idle');

    const doAction = async (action: 'restart' | 'stop' | 'start') => {
        setStatus('loading');
        try {
            await api.post(`/projects/${projectId}/containers/${containerId}/${action}`);
            setStatus('done');
            setTimeout(() => { setStatus('idle'); onActionDone?.(); }, 1500);
        } catch {
            setStatus('error');
            setTimeout(() => setStatus('idle'), 2000);
        }
    };

    const btnBase: React.CSSProperties = {
        border: 'none', borderRadius: 5, padding: '0.25rem 0.45rem',
        cursor: status === 'loading' ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s, color 0.15s',
        background: 'transparent',
        opacity: status === 'loading' ? 0.5 : 1,
        display: 'inline-flex', alignItems: 'center',
    };

    return (
        <div className="flex items-center gap-1">
            <button
                title={`Restart ${alias}`}
                style={{ ...btnBase, color: '#f59e0b' }}
                onClick={() => doAction('restart')}
                disabled={status === 'loading'}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.15)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
                <RefreshCw size={13} />
            </button>
            <button
                title={`Stop ${alias}`}
                style={{ ...btnBase, color: '#fb7185' }}
                onClick={() => doAction('stop')}
                disabled={status === 'loading'}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(251,113,133,0.15)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
                <Square size={13} />
            </button>
            <button
                title={`Start ${alias}`}
                style={{ ...btnBase, color: '#34d399' }}
                onClick={() => doAction('start')}
                disabled={status === 'loading'}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(52,211,153,0.15)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
                <Play size={13} />
            </button>
        </div>
    );
};

export default ContainerActions;
