import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connected');
    } catch (error) {
      this.logger.warn(
        `Database not reachable on startup (${(error as Error).message}). API will start; DB queries may fail until the database is available.`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
