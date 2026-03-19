import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ProjectsModule } from './projects/projects.module';
import { OracleModule } from './oracle/oracle.module';
import { SettingsModule } from './settings/settings.module';
import { MetricsModule } from './metrics/metrics.module';
import { ContactsModule } from './contacts/contacts.module';
import { LogsModule } from './logs/logs.module';
import { TerminalModule } from './terminal/terminal.module';
import { ContainersModule } from './containers/containers.module';
import { HostModule } from './host/host.module';
import { Project } from './projects/entitties/proyectos.entity';
import { Setting } from './settings/entities/setting.entity';
import { Contact } from './contacts/entities/contact.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5434'),
      username: process.env.DB_USERNAME || 'oracle_user',
      password: process.env.DB_PASSWORD || 'oracle_pass',
      database: process.env.DB_NAME || 'oracle_config',
      entities: [Project, Setting, Contact],
      synchronize: true,
    }),
    ProjectsModule,
    OracleModule,
    SettingsModule,
    MetricsModule,
    ContactsModule,
    LogsModule,
    ContainersModule,
    HostModule,
    TerminalModule,
  ],
})
export class AppModule { }
