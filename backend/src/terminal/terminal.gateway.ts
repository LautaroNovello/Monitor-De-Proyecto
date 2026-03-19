import {
    WebSocketGateway, WebSocketServer,
    SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/entitties/proyectos.entity';
import { NodeSSH } from 'node-ssh';

@WebSocketGateway({
    cors: { origin: '*' },
    namespace: '/terminal'
})
export class TerminalGateway implements OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private sessions = new Map<string, { ssh: NodeSSH; stream: any }>();

    constructor(
        @InjectRepository(Project)
        private readonly projectRepo: Repository<Project>,
    ) { }

    handleDisconnect(client: Socket) {
        const session = this.sessions.get(client.id);
        if (session) {
            session.ssh.dispose();
            this.sessions.delete(client.id);
        }
    }

    @SubscribeMessage('terminal-connect')
    async handleConnect(
        @MessageBody() data: { projectId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const project = await this.projectRepo.findOne({ where: { id: data.projectId } });
        if (!project?.sshUser || !project?.sshKey) {
            client.emit('terminal-error', 'Credenciales SSH no configuradas.');
            return;
        }

        const ssh = new NodeSSH();
        try {
            await ssh.connect({
                host: this.extractHost(project.ec2Url),
                username: project.sshUser,
                privateKey: project.sshKey,
            });

            // Iniciar shell interactiva
            const stream = await ssh.requestShell({
                term: 'xterm-256color',
            });

            this.sessions.set(client.id, { ssh, stream });

            stream.on('data', (chunk: Buffer) => {
                client.emit('terminal-stdout', chunk.toString());
            });

            stream.stderr.on('data', (chunk: Buffer) => {
                client.emit('terminal-stdout', chunk.toString());
            });

            stream.on('close', () => {
                client.emit('terminal-closed');
                this.handleDisconnect(client);
            });

            client.emit('terminal-ready');

        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error SSH desconocido';
            client.emit('terminal-error', `Error SSH: ${msg}`);
            ssh.dispose();
        }
    }

    @SubscribeMessage('terminal-stdin')
    handleStdin(
        @MessageBody() data: string,
        @ConnectedSocket() client: Socket,
    ) {
        const session = this.sessions.get(client.id);
        if (session?.stream) {
            session.stream.write(data);
        }
    }

    @SubscribeMessage('terminal-resize')
    handleResize(
        @MessageBody() data: { cols: number; rows: number },
        @ConnectedSocket() client: Socket,
    ) {
        const session = this.sessions.get(client.id);
        if (session?.stream) {
            // Nota: node-ssh wrapper a veces no expone setWindow directamente en el stream
            // pero el stream de ssh2 sí lo tiene.
            if (typeof session.stream.setWindow === 'function') {
                session.stream.setWindow(data.rows, data.cols, 0, 0);
            }
        }
    }

    private extractHost(ec2Url: string): string {
        try { return new URL(ec2Url).hostname; }
        catch { return ec2Url.split(':')[0]; }
    }
}
