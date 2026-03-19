import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { OracleService } from './oracle.service';
import { Project } from '../projects/entitties/proyectos.entity';
import { Setting } from '../settings/entities/setting.entity';
import { Contact } from '../contacts/entities/contact.entity';

@Module({
    imports: [
        HttpModule,
        ConfigModule,
        TypeOrmModule.forFeature([Project, Setting, Contact]),
    ],
    providers: [OracleService],
    exports: [OracleService],
})
export class OracleModule { }
