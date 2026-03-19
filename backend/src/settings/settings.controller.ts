import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';
import { SettingsService } from './settings.service';

class UpsertSettingDto {
    key: string;
    value: string;
}

@Controller('settings')
export class SettingsController {
    constructor(
        @InjectRepository(Setting)
        private readonly settingRepository: Repository<Setting>,
        private readonly settingsService: SettingsService,
    ) { }

    @Get('status')
    async getStatus() {
        return await this.settingsService.getConfigStatus();
    }

    // POST /api/settings/test-twilio
    @Post('test-twilio')
    @HttpCode(HttpStatus.OK)
    async testTwilio(@Body() body: { phoneNumber: string }): Promise<{ ok: boolean; message: string }> {
        return await this.settingsService.testTwilio(body.phoneNumber);
    }

    // GET /api/settings
    @Get()
    async findAll(): Promise<Setting[]> {
        return await this.settingRepository.find();
    }

    // POST /api/settings — Crea o actualiza un setting (upsert por key)
    @Post()
    @HttpCode(HttpStatus.OK)
    async upsert(@Body() dto: UpsertSettingDto): Promise<Setting> {
        const existing = await this.settingRepository.findOne({ where: { key: dto.key } });
        if (existing) {
            existing.value = dto.value;
            return await this.settingRepository.save(existing);
        }
        const setting = this.settingRepository.create(dto);
        return await this.settingRepository.save(setting);
    }
}
