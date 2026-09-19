import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    return {
      message: 'Incoming Warehouse API',
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth/login',
        vendors: '/api/vendors',
        packagings: '/api/packagings',
        sessions: '/api/sessions',
        readings: '/api/readings',
        cloud: '/api/cloud',
        settings: '/api/settings',
      },
      documentation: 'All API endpoints are prefixed with /api',
    };
  }

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
