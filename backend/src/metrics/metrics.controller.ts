import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { OracleService } from '../oracle/oracle.service';

@Controller('metrics')
export class MetricsController {
    constructor(
        private readonly metricsService: MetricsService,
        private readonly oracleService: OracleService,
    ) { }

    // GET /api/metrics/:id/ram?minutes=30
    @Get(':id/ram')
    async getRam(
        @Param('id', ParseIntPipe) id: number,
        @Query('minutes') minutes = '30',
    ) {
        return this.metricsService.getRam(id, parseInt(minutes));
    }

    // GET /api/metrics/:id/cpu?minutes=30
    @Get(':id/cpu')
    async getCpu(
        @Param('id', ParseIntPipe) id: number,
        @Query('minutes') minutes = '30',
    ) {
        return this.metricsService.getCpu(id, parseInt(minutes));
    }

    // GET /api/metrics/:id/network?minutes=30
    @Get(':id/network')
    async getNetwork(
        @Param('id', ParseIntPipe) id: number,
        @Query('minutes') minutes = '30',
    ) {
        return this.metricsService.getNetwork(id, parseInt(minutes));
    }

    // GET /api/metrics/:id/network-total
    @Get(':id/network-total')
    async getNetworkTotal(@Param('id', ParseIntPipe) id: number) {
        return this.metricsService.getNetworkTotal(id);
    }

    // GET /api/metrics/:id/network-history-total?minutes=30
    @Get(':id/network-history-total')
    async getNetworkHistoryTotal(
        @Param('id', ParseIntPipe) id: number,
        @Query('minutes') minutes = '30',
    ) {
        return this.metricsService.getNetworkHistoryTotal(id, parseInt(minutes));
    }

    // GET /api/metrics/:id/disk?minutes=30
    @Get(':id/disk')
    async getDiskIo(
        @Param('id', ParseIntPipe) id: number,
        @Query('minutes') minutes = '30',
    ) {
        return this.metricsService.getDiskIo(id, parseInt(minutes));
    }

    // GET /api/metrics/:id/status  — restarts, throttling, memory limits
    @Get(':id/status')
    async getStatus(@Param('id', ParseIntPipe) id: number) {
        const project = await this.metricsService.findProject(id);
        if (!project) return {};
        return this.oracleService.getContainerStatuses(project.name);
    }

    // GET /api/metrics/:id/unified?minutes=30
    @Get(':id/unified')
    async getUnified(
        @Param('id', ParseIntPipe) id: number,
        @Query('minutes') minutes = '30',
    ) {
        return this.metricsService.getUnifiedMetrics(id, parseInt(minutes));
    }

    // GET /api/metrics/:id/disk-history-total?minutes=30
    @Get(':id/disk-history-total')
    async getDiskHistoryTotal(
        @Param('id', ParseIntPipe) id: number,
        @Query('minutes') minutes = '30',
    ) {
        return this.metricsService.getDiskHistoryTotal(id, parseInt(minutes));
    }
}
