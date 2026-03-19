import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ProjectsController } from './projects.controller';
import { Project } from './entitties/proyectos.entity';
import { OracleModule } from '../oracle/oracle.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Project]),
        HttpModule,
        OracleModule,
    ],
    controllers: [ProjectsController],
    exports: [TypeOrmModule],
})
export class ProjectsModule { }