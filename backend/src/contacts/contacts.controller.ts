import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { ContactsService } from './contacts.service';

@Controller('contacts')
export class ContactsController {
    constructor(private readonly svc: ContactsService) { }

    @Get()
    findAll() { return this.svc.findAll(); }

    @Post()
    create(@Body() dto: { name: string; phoneNumber: string }) {
        return this.svc.create(dto);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.svc.remove(id);
    }

    @Post(':id/subscribe/:projectId')
    subscribe(
        @Param('id', ParseIntPipe) id: number,
        @Param('projectId', ParseIntPipe) projectId: number,
    ) { return this.svc.subscribe(id, projectId); }

    @Delete(':id/subscribe/:projectId')
    unsubscribe(
        @Param('id', ParseIntPipe) id: number,
        @Param('projectId', ParseIntPipe) projectId: number,
    ) { return this.svc.unsubscribe(id, projectId); }

    @Post(':id/test')
    test(@Param('id', ParseIntPipe) id: number) {
        return this.svc.sendTestMessage(id);
    }
}
