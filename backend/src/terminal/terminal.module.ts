import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminalGateway } from './terminal.gateway';
import { Project } from '../projects/entitties/proyectos.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Project])],
    providers: [TerminalGateway],
})
export class TerminalModule { }
