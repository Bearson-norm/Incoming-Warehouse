import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error';

    switch (exception.code) {
      case 'P1001':
      case 'P1002':
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message =
          'Database tidak dapat dijangkau. Periksa file SQLite (perangkat lokal) atau koneksi PostgreSQL (VPS).';
        break;
      case 'P2021':
      case 'P2022':
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message =
          'Skema database belum lengkap. Jalankan: npx prisma migrate deploy (di folder Dashboard/api).';
        break;
      case 'P2002':
        status = HttpStatus.CONFLICT;
        message = 'Data duplikat: record sudah ada.';
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Record tidak ditemukan.';
        break;
      default:
        message = exception.message;
    }

    this.logger.error(`Prisma ${exception.code}: ${exception.message}`);

    response.status(status).json({
      statusCode: status,
      message,
      error: exception.code,
    });
  }
}
