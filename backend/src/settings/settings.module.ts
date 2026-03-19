import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Setting } from './entities/setting.entity';
import { SettingsController } from './settings.controller';

import { SettingsService } from './settings.service';

@Module({
    imports: [TypeOrmModule.forFeature([Setting]), HttpModule],
    controllers: [SettingsController],
    providers: [SettingsService],
    exports: [TypeOrmModule, SettingsService],
})
export class SettingsModule { }
