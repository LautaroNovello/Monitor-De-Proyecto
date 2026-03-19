import { Module } from '@nestjs/common';
import { HostController } from './host.controller';
import { OracleModule } from '../oracle/oracle.module';

@Module({
    imports: [OracleModule],
    controllers: [HostController],
})
export class HostModule { }
