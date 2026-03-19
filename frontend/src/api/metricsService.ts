import api from './axiosConfig';
import { MetricPoint } from '../types/project';

type RangeOption = '5m' | '1h' | '24h' | '7d';

const rangeToMinutes = (range: RangeOption): number => {
    const map: Record<RangeOption, number> = { '5m': 5, '1h': 60, '24h': 1440, '7d': 10080 };
    return map[range] ?? 60;
};

export const getRamMetrics = async (projectId: number, range: RangeOption | number = '1h'): Promise<MetricPoint[]> => {
    const minutes = typeof range === 'number' ? range : rangeToMinutes(range);
    const { data } = await api.get<MetricPoint[]>(`/metrics/${projectId}/ram`, { params: { minutes } });
    return data;
};

export const getCpuMetrics = async (projectId: number, range: RangeOption | number = '1h'): Promise<MetricPoint[]> => {
    const minutes = typeof range === 'number' ? range : rangeToMinutes(range);
    const { data } = await api.get<MetricPoint[]>(`/metrics/${projectId}/cpu`, { params: { minutes } });
    return data;
};

export const getNetworkMetrics = async (projectId: number, range: RangeOption | number = '1h'): Promise<MetricPoint[]> => {
    const minutes = typeof range === 'number' ? range : rangeToMinutes(range);
    const { data } = await api.get<MetricPoint[]>(`/metrics/${projectId}/network`, { params: { minutes } });
    return data;
};

export const getNetworkTotal = async (projectId: number): Promise<Record<string, { rx_total_mb: number; tx_total_mb: number }>> => {
    const { data } = await api.get<Record<string, { rx_total_mb: number; tx_total_mb: number }>>(`/metrics/${projectId}/network-total`);
    return data;
};

export const getNetworkHistoryTotal = async (projectId: number, range: RangeOption | number = '1h'): Promise<MetricPoint[]> => {
    const minutes = typeof range === 'number' ? range : rangeToMinutes(range);
    const { data } = await api.get<MetricPoint[]>(`/metrics/${projectId}/network-history-total`, { params: { minutes } });
    return data;
};

export const getDiskIo = async (projectId: number, range: RangeOption | number = '1h'): Promise<MetricPoint[]> => {
    const minutes = typeof range === 'number' ? range : rangeToMinutes(range);
    const { data } = await api.get<MetricPoint[]>(`/metrics/${projectId}/disk`, { params: { minutes } });
    return data;
};

export const getDiskHistoryTotal = async (projectId: number, range: RangeOption | number = '1h'): Promise<MetricPoint[]> => {
    const minutes = typeof range === 'number' ? range : rangeToMinutes(range);
    const { data } = await api.get<MetricPoint[]>(`/metrics/${projectId}/disk-history-total`, { params: { minutes } });
    return data;
};

export interface ContainerStatusInfo {
    restarts: number;
    throttlePct: number;
    limitMb: number;
    pids: number;
}

export const getContainerStatus = async (projectId: number): Promise<Record<string, ContainerStatusInfo>> => {
    const { data } = await api.get<Record<string, ContainerStatusInfo>>(`/metrics/${projectId}/status`);
    return data;
};

export const getUnifiedMetrics = async (projectId: number, range: RangeOption | number = '1h'): Promise<any[]> => {
    const minutes = typeof range === 'number' ? range : rangeToMinutes(range);
    const { data } = await api.get<any[]>(`/metrics/${projectId}/unified`, { params: { minutes } });
    return data;
};


