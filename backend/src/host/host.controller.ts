import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { OracleService } from '../oracle/oracle.service';

@Controller('host')
export class HostController {
    constructor(private readonly oracleService: OracleService) { }

    // GET /api/host/health → estado global (legacy)
    @Get('health')
    getHostHealth() {
        return this.oracleService.getHostHealth();
    }

    // GET /api/host/health/:projectId → estado de la instancia de un proyecto
    @Get('health/:projectId')
    getProjectHealth(@Param('projectId', ParseIntPipe) projectId: number) {
        return this.oracleService.getProjectHealth(projectId);
    }
}
