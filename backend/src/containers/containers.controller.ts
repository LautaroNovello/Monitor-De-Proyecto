import { Controller, Post, Param, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/entitties/proyectos.entity';
import { NodeSSH } from 'node-ssh';
import { OracleService } from '../oracle/oracle.service';

@Controller('projects/:id/containers/:containerId')
export class ContainersController {
    constructor(
        @InjectRepository(Project)
        private readonly projectRepo: Repository<Project>,
        private readonly oracleService: OracleService,
    ) { }

    @Post('restart')
    exec(
        @Param('id', ParseIntPipe) id: number,
        @Param('containerId') containerId: string,
    ) { return this.runDockerCmd(id, containerId, 'restart'); }

    @Post('stop')
    stop(
        @Param('id', ParseIntPipe) id: number,
        @Param('containerId') containerId: string,
    ) { return this.runDockerCmd(id, containerId, 'stop'); }

    @Post('start')
    start(
        @Param('id', ParseIntPipe) id: number,
        @Param('containerId') containerId: string,
    ) { return this.runDockerCmd(id, containerId, 'start'); }

    private async runDockerCmd(projectId: number, containerId: string, action: string) {
        const project = await this.projectRepo.findOne({ where: { id: projectId } });
        if (!project) throw new NotFoundException('Proyecto no encontrado');
        if (!project.sshUser || !project.sshKey) {
            return { ok: false, message: 'Credenciales SSH no configuradas' };
        }

        const ssh = new NodeSSH();
        const host = new URL(project.ec2Url).hostname;
        await ssh.connect({ host, username: project.sshUser, privateKey: project.sshKey });
        const result = await ssh.execCommand(`docker ${action} ${containerId}`);
        ssh.dispose();

        const ok = !result.code;
        if (ok && (action === 'restart' || action === 'start')) {
            // Buscar el alias correpondiente a este ID en el mapa
            // containerId puede ser el ID corto o largo
            const alias = project.containerMap[containerId] ||
                Object.entries(project.containerMap).find(([id]) => id.startsWith(containerId))?.[1];

            if (alias) {
                this.oracleService.incrementManualRestart(project.name, alias.trim());
            }
        }

        return { ok, stdout: result.stdout, stderr: result.stderr };
    }
}
