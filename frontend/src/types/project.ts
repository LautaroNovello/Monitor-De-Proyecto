export interface Project {
    id: number;
    name: string;
    ec2Url: string;
    containerMap: Record<string, string>;
    isActive: boolean;
    scrapingInterval?: number;
    maxRamMb?: number;
    sshUser?: string;
    sshKey?: string;
}

export interface ContainerEntry {
    containerId: string;
    alias: string;
}

export interface ProjectFormData {
    name: string;
    ec2Url: string;
    containers: ContainerEntry[];
    isActive: boolean;
    scrapingInterval?: number;
    maxRamMb?: number;
    sshUser?: string;
    sshKey?: string;
}

export interface MetricPoint {
    time: string;
    [container: string]: number | string;
}

export interface ContainerStatus {
    containerId: string;
    alias: string;
    online: boolean;
    ramBytes: number;
    ramPeakBytes: number;
}
