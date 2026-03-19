import api from './axiosConfig';

export interface HostHealth {
    totalUsedMb: number;
    maxMb: number;
    usagePercent: number;
    status: 'ok' | 'warn' | 'critical';
    lastUpdated: string;
    hasData: boolean;
    projects: { name: string; usedMb: number; usagePct: number }[];
}

export const getHostHealth = async (): Promise<HostHealth> => {
    const { data } = await api.get<HostHealth>('/host/health');
    return data;
};

export const getProjectHealth = async (projectId: number): Promise<HostHealth> => {
    const { data } = await api.get<HostHealth>(`/host/health/${projectId}`);
    return data;
};
