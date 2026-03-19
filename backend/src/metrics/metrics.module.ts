import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { Setting } from '../settings/entities/setting.entity';
import { Project } from '../projects/entitties/proyectos.entity';
import { OracleModule } from '../oracle/oracle.module';

@Module({
    imports: [TypeOrmModule.forFeature([Setting, Project]), OracleModule],
    controllers: [MetricsController],
    providers: [MetricsService],
})
export class MetricsModule { }
