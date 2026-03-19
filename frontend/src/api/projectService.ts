import api from './axiosConfig';
import { Project, ProjectFormData } from '../types/project';

export const getProjects = async (): Promise<Project[]> => {
    const { data } = await api.get<Project[]>('/projects');
    return data;
};

export const getProjectById = async (id: number): Promise<Project> => {
    const { data } = await api.get<Project>(`/projects/${id}`);
    return data;
};

export const createProject = async (formData: ProjectFormData): Promise<Project> => {
    const containerMap: Record<string, string> = {};
    formData.containers.forEach(c => {
        if (c.containerId && c.alias) containerMap[c.containerId] = c.alias;
    });

    const { data } = await api.post<Project>('/projects', {
        name: formData.name,
        ec2Url: formData.ec2Url,
        containerMap,
        isActive: formData.isActive,
        scrapingInterval: formData.scrapingInterval,
        maxRamMb: formData.maxRamMb,
        sshUser: formData.sshUser,
        sshKey: formData.sshKey,
    });
    return data;
};

export const updateProject = async (id: number, formData: ProjectFormData): Promise<Project> => {
    const containerMap: Record<string, string> = {};
    formData.containers.forEach(c => {
        if (c.containerId && c.alias) containerMap[c.containerId] = c.alias;
    });

    const { data } = await api.patch<Project>(`/projects/${id}`, {
        name: formData.name,
        ec2Url: formData.ec2Url,
        containerMap,
        isActive: formData.isActive,
        scrapingInterval: formData.scrapingInterval,
        maxRamMb: formData.maxRamMb,
        sshUser: formData.sshUser,
        sshKey: formData.sshKey,
    });
    return data;
};

export const deleteProject = async (id: number): Promise<void> => {
    await api.delete(`/projects/${id}`);
};

export const testEndpoint = async (url: string): Promise<boolean> => {
    try {
        await api.get('/projects/test-connection', { params: { url } });
        return true;
    } catch {
        return false;
    }
};
// Alias para compatibilidad
export const getAllProjects = getProjects;
