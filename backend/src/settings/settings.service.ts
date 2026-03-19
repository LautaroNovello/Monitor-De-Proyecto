import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Setting } from './entities/setting.entity';

@Injectable()
export class SettingsService {
    private readonly logger = new Logger(SettingsService.name);

    constructor(
        @InjectRepository(Setting)
        private readonly settingRepository: Repository<Setting>,
        private readonly httpService: HttpService,
    ) { }

    async onModuleInit() {
        await this.seedSettings();
    }

    private async seedSettings() {
        const defaultSettings = [
            { key: 'INFLUX_URL', value: 'http://monitoreo-influx-db:8086' },
            { key: 'INFLUX_TOKEN', value: 'my_super_secret_default_token_123' },
            { key: 'INFLUX_ORG', value: 'MI_ORG' },
            { key: 'INFLUX_BUCKET', value: 'oracle_metrics' },
        ];

        for (const setting of defaultSettings) {
            const exists = await this.settingRepository.findOne({ where: { key: setting.key } });
            if (!exists) {
                this.logger.log(`[Seed] Configurando valor inicial para ${setting.key}`);
                await this.settingRepository.save(this.settingRepository.create(setting));
            }
        }
    }

    async getConfigStatus() {
        const settings = await this.settingRepository.find();
        const hasUrl = !!settings.find(s => s.key === 'INFLUX_URL')?.value;
        const hasToken = !!settings.find(s => s.key === 'INFLUX_TOKEN')?.value;
        const hasOrg = !!settings.find(s => s.key === 'INFLUX_ORG')?.value;

        return {
            isConfigured: hasUrl && hasToken && hasOrg,
            details: {
                hasUrl,
                hasToken,
                hasOrg
            }
        };
    }

    async testTwilio(phoneNumber: string): Promise<{ ok: boolean; message: string }> {
        const settings = await this.settingRepository.find();
        const accountSid = settings.find(s => s.key === 'TWILIO_ACCOUNT_SID')?.value;
        const authToken = settings.find(s => s.key === 'TWILIO_AUTH_TOKEN')?.value;
        const rawFrom = settings.find(s => s.key === 'TWILIO_WHATSAPP_FROM')?.value || '+14155238886';
        const from = rawFrom.startsWith('whatsapp:') ? rawFrom : `whatsapp:${rawFrom}`;

        if (!accountSid || !authToken) {
            return { ok: false, message: 'Faltan credenciales de Twilio (Account SID o Auth Token).' };
        }

        try {
            const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
            const body = new URLSearchParams({
                To: `whatsapp:${phoneNumber}`,
                From: from,
                Body: '✅ ORACLE TEST | Twilio configurado correctamente. Las notificaciones por WhatsApp están activas.',
            });

            await firstValueFrom(
                this.httpService.post(url, body.toString(), {
                    auth: { username: accountSid, password: authToken },
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                }),
            );

            this.logger.log(`[Twilio Test] Mensaje enviado a ${phoneNumber}`);
            return { ok: true, message: 'Mensaje de prueba enviado correctamente.' };
        } catch (err) {
            this.logger.error(`[Twilio Test] Error: ${err.message}`);
            return { ok: false, message: `Error de Twilio: ${err?.response?.data?.message || err.message}` };
        }
    }
}
