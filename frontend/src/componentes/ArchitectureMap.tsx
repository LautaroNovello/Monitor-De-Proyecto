import React, { useCallback } from 'react';
import ReactFlow, {
    Background, Controls, MiniMap,
    Node, Edge, useNodesState, useEdgesState,
    MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Project } from '../types/project';

interface Props { project: Project; containerRamData: Record<string, number> }

const NODE_COLORS = ['#00f5d4', '#818cf8', '#f59e0b', '#fb7185', '#34d399', '#60a5fa'];

const ArchitectureMap: React.FC<Props> = ({ project, containerRamData }) => {
    const entries = Object.entries(project.containerMap);

    const initialNodes: Node[] = entries.map(([cid, alias], i) => {
        const ramMB = containerRamData[alias];
        const isUp = ramMB !== undefined && ramMB > 0;
        const color = NODE_COLORS[i % NODE_COLORS.length];
        const cols = Math.ceil(Math.sqrt(entries.length));

        return {
            id: cid,
            position: { x: (i % cols) * 220, y: Math.floor(i / cols) * 160 },
            data: {
                label: (
                    <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                        <div style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: isUp ? color : '#64748b',
                            margin: '0 auto 6px',
                            boxShadow: isUp ? `0 0 8px ${color}` : 'none',
                        }} />
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#e2e8f0' }}>{alias}</div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2 }}>
                            {isUp ? `${ramMB} MB` : 'DOWN'}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#334155', marginTop: 2 }}>{cid}</div>
                    </div>
                ),
            },
            style: {
                background: '#161b22',
                border: `1px solid ${isUp ? color : '#ef4444'}`,
                borderRadius: 10,
                width: 160,
                boxShadow: isUp ? `0 0 12px ${color}22` : '0 0 8px #ef444422',
            },
        };
    });

    // Edges simples entre nodos consecutivos (topología en cadena por defecto)
    const initialEdges: Edge[] = entries.slice(0, -1).map(([cid], i) => ({
        id: `e${i}`,
        source: cid,
        target: entries[i + 1][0],
        style: { stroke: '#334155', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#334155' },
        animated: containerRamData[entries[i][1]] > 0,
    }));

    const [nodes] = useNodesState(initialNodes);
    const [edges] = useEdgesState(initialEdges);

    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1rem 0.5rem', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '0.9rem' }}>🔗 Mapa de Arquitectura</h3>
                <p className="text-xs text-muted">Nodos brillantes = activos · grises = caídos</p>
            </div>
            <div style={{ height: 320, background: '#0b0e14' }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    fitView
                    attributionPosition="bottom-right"
                >
                    <Background color="#1e293b" gap={24} />
                    <Controls style={{ background: '#161b22', border: '1px solid var(--border)' }} />
                    <MiniMap
                        nodeColor={(n) => (n.style?.border as string)?.includes('#ef') ? '#ef4444' : '#00f5d4'}
                        style={{ background: '#0d1117', border: '1px solid var(--border)' }}
                    />
                </ReactFlow>
            </div>
        </div>
    );
};

export default ArchitectureMap;
