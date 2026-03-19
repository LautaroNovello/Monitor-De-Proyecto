import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { Contact } from './entities/contact.entity';
import { Project } from '../projects/entitties/proyectos.entity';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Contact, Project]),
        HttpModule,
        ConfigModule,
    ],
    controllers: [ContactsController],
    providers: [ContactsService],
    exports: [ContactsService],
})
export class ContactsModule { }
