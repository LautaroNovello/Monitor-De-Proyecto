import React from 'react';
import { Clock } from 'lucide-react';

export type RangeOption = '5m' | '1h' | '24h' | '7d';

const OPTIONS: { label: string; value: RangeOption }[] = [
    { label: 'Últimos 5 min', value: '5m' },
    { label: 'Última hora', value: '1h' },
    { label: 'Últimas 24 h', value: '24h' },
    { label: '7 días', value: '7d' },
];

interface Props {
    value: RangeOption;
    onChange: (v: RangeOption) => void;
}

const DateRangeSelector: React.FC<Props> = ({ value, onChange }) => (
    <div className="flex items-center gap-2">
        <Clock size={14} style={{ color: 'var(--text-muted)' }} />
        <span className="text-xs text-muted">Rango:</span>
        <div className="flex" style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
        }}>
            {OPTIONS.map(opt => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    style={{
                        padding: '0.3rem 0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: 'none',
                        borderRight: '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'background 0.15s, color 0.15s',
                        background: value === opt.value ? 'var(--accent)' : 'transparent',
                        color: value === opt.value ? '#0b0e14' : 'var(--text-muted)',
                    }}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    </div>
);

export default DateRangeSelector;
