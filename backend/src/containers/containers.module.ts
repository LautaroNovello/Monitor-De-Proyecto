import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/entitties/proyectos.entity';
import { ContainersController } from './containers.controller';
import { OracleModule } from '../oracle/oracle.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Project]),
        OracleModule
    ],
    controllers: [ContainersController],
})
export class ContainersModule { }
