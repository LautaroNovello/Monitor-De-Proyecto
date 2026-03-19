import { Controller, Post, Get, Body, Delete, Param, Query, ParseIntPipe, Patch, HttpCode, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';
import { CreateProjectDto } from './dto/create-project.dto';
import { Project } from './entitties/proyectos.entity';
import { OracleService } from '../oracle/oracle.service';

@Controller('projects')
export class ProjectsController {
    constructor(
        @InjectRepository(Project)
        private readonly projectRepository: Repository<Project>,
        private readonly httpService: HttpService,
        private readonly oracleService: OracleService,
    ) { }

    // POST /api/projects
    @Post()
    async create(@Body() dto: CreateProjectDto): Promise<Project> {
        const project = this.projectRepository.create({
            ...dto,
            isActive: dto.isActive ?? true,
        });
        const saved = await this.projectRepository.save(project);
        if (saved.isActive) this.oracleService.replanificarProyecto(saved);
        return saved;
    }

    // GET /api/projects
    @Get()
    async findAll(): Promise<Project[]> {
        return await this.projectRepository.find();
    }

    // GET /api/projects/test-connection?url=...
    // ⚠️ Debe ir ANTES de :id para que NestJS no lo interprete como un ID
    @Get('test-connection')
    @HttpCode(HttpStatus.OK)
    async testConnection(@Query('url') url: string): Promise<{ ok: boolean; message: string }> {
        if (!url) return { ok: false, message: 'URL no proporcionada' };
        try {
            await firstValueFrom(
                this.httpService.get(url).pipe(
                    timeout(5000),
                    catchError(() => { throw new Error('Sin respuesta'); }),
                ),
            );
            return { ok: true, message: 'Conexión exitosa' };
        } catch {
            return { ok: false, message: 'No se pudo conectar al endpoint' };
        }
    }

    // GET /api/projects/:id
    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number): Promise<Project> {
        return await this.projectRepository.findOneOrFail({ where: { id } });
    }

    // PATCH /api/projects/:id
    @Patch(':id')
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: Partial<CreateProjectDto>,
    ): Promise<Project> {
        await this.projectRepository.update(id, dto);
        const updated = await this.projectRepository.findOneOrFail({ where: { id } });
        if (updated.isActive) {
            this.oracleService.replanificarProyecto(updated);
        } else {
            this.oracleService.cancelarProyecto(id);
        }
        return updated;
    }

    // DELETE /api/projects/:id
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
        this.oracleService.cancelarProyecto(id);
        await this.projectRepository.delete(id);
    }
}