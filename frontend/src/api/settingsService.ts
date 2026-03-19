import api from './axiosConfig';

export interface Setting {
    key: string;
    value: string;
}

export const getSettings = async (): Promise<Setting[]> => {
    const { data } = await api.get<Setting[]>('/settings');
    return data;
};

export const upsertSetting = async (key: string, value: string): Promise<Setting> => {
    const { data } = await api.post<Setting>('/settings', { key, value });
    return data;
};

export interface ConfigStatus {
    isConfigured: boolean;
    details: {
        hasUrl: boolean;
        hasToken: boolean;
        hasOrg: boolean;
    };
}

export const getSettingsStatus = async (): Promise<ConfigStatus> => {
    const { data } = await api.get<ConfigStatus>('/settings/status');
    return data;
};

export const testTwilio = async (phoneNumber: string): Promise<{ ok: boolean; message: string }> => {
    const { data } = await api.post<{ ok: boolean; message: string }>('/settings/test-twilio', { phoneNumber });
    return data;
};
