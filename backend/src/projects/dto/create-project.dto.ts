export class CreateProjectDto {
    name: string;
    ec2Url: string;
    containerMap: Record<string, string>;
    isActive?: boolean;
    scrapingInterval?: number;
    maxRamMb?: number;
    sshUser?: string;
    sshKey?: string;
}