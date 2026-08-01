import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

import { Public } from '../auth/decorators/public.decorator';

import { DatabaseHealthIndicator } from './database.health';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly database: DatabaseHealthIndicator,
  ) {}

  @Get('live')
  live() {
    return {
      status: 'ok',
      service: 'la-comfianza-payroll-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),

      () => this.database.isHealthy('database'),
    ]);
  }
}
