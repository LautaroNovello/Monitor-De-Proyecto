import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './entities/contact.entity';
import { Project } from '../projects/entitties/proyectos.entity';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ContactsService {
    constructor(
        @InjectRepository(Contact)
        private readonly contactRepo: Repository<Contact>,
        @InjectRepository(Project)
        private readonly projectRepo: Repository<Project>,
        private readonly httpService: HttpService,
        private readonly config: ConfigService,
    ) { }

    findAll(): Promise<Contact[]> {
        return this.contactRepo.find({ relations: ['subscribedProjects'] });
    }

    async create(dto: { name: string; phoneNumber: string }): Promise<Contact> {
        const contact = this.contactRepo.create({ ...dto, isActive: true, subscribedProjects: [] });
        return this.contactRepo.save(contact);
    }

    async remove(id: number): Promise<void> {
        const contact = await this.contactRepo.findOne({ where: { id }, relations: ['subscribedProjects'] });
        if (contact) {
            contact.subscribedProjects = [];
            await this.contactRepo.save(contact);
            await this.contactRepo.delete(id);
        }
    }

    async subscribe(contactId: number, projectId: number): Promise<Contact> {
        const contact = await this.contactRepo.findOne({ where: { id: contactId }, relations: ['subscribedProjects'] });
        if (!contact) throw new NotFoundException('Contacto no encontrado');
        const project = await this.projectRepo.findOne({ where: { id: projectId } });
        if (!project) throw new NotFoundException('Proyecto no encontrado');

        const alreadySub = contact.subscribedProjects.some(p => p.id === projectId);
        if (!alreadySub) contact.subscribedProjects.push(project);
        return this.contactRepo.save(contact);
    }

    async unsubscribe(contactId: number, projectId: number): Promise<Contact> {
        const contact = await this.contactRepo.findOne({ where: { id: contactId }, relations: ['subscribedProjects'] });
        if (!contact) throw new NotFoundException('Contacto no encontrado');
        contact.subscribedProjects = contact.subscribedProjects.filter(p => p.id !== projectId);
        return this.contactRepo.save(contact);
    }

    async sendTestMessage(contactId: number): Promise<{ status: string }> {
        const contact = await this.contactRepo.findOne({ where: { id: contactId } });
        if (!contact) throw new NotFoundException('Contacto no encontrado');
        await this.sendWhatsApp(contact.phoneNumber, `🔔 ORACLE TEST | Hola ${contact.name}, las notificaciones de ORACLE están activas.`);
        return { status: 'sent' };
    }

    async notifyContactsForProject(projectName: string, containerName: string): Promise<void> {
        const contacts = await this.contactRepo
            .createQueryBuilder('contact')
            .innerJoin('contact.subscribedProjects', 'project', 'project.name = :name', { name: projectName })
            .where('contact.isActive = true')
            .getMany();

        const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        await Promise.all(contacts.map(c =>
            this.sendWhatsApp(c.phoneNumber,
                `⚠️ ORACLE ALERT | Hola ${c.name}, se ha detectado una caída en el contenedor *${containerName}* del proyecto *${projectName}*. Estado actual: DOWN. Hora: ${time}.`
            )
        ));
    }

    private async sendWhatsApp(to: string, message: string): Promise<void> {
        const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
        const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
        const rawFrom = this.config.get<string>('TWILIO_WHATSAPP_FROM') || '+14155238886';
        const from = rawFrom.startsWith('whatsapp:') ? rawFrom : `whatsapp:${rawFrom}`;

        if (!accountSid || !authToken) {
            console.warn('[Twilio] Credenciales no configuradas. Notificación omitida.');
            return;
        }

        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const body = new URLSearchParams({ To: `whatsapp:${to}`, From: from, Body: message });

        await firstValueFrom(
            this.httpService.post(url, body.toString(), {
                auth: { username: accountSid, password: authToken },
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            })
        ).catch(err => console.error('[Twilio] Error enviando WhatsApp:', err.message));
    }
}
