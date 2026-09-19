import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { OdooSettingsService } from './odoo-settings.service';

export interface OdooWeightSuccess {
  success: true;
  log_id: number;
  package_id: number;
  gross_weight: number;
  tare_weight: number;
  net_weight: number;
  weight_status: string;
  message: string;
}

export interface OdooWeightError {
  success: false;
  error: string;
}

@Injectable()
export class OdooWeighingService {
  private readonly logger = new Logger(OdooWeighingService.name);

  constructor(private odooSettings: OdooSettingsService) {}

  private getBaseUrl(): string {
    const base = this.odooSettings.getBaseUrl();
    if (!base) {
      throw new InternalServerErrorException(
        'Odoo Base URL belum dikonfigurasi. Atur di Pengaturan → Konfigurasi API Odoo WMS.',
      );
    }
    return base;
  }

  private getApiKey(): string {
    const key = this.odooSettings.getApiKey();
    if (!key) {
      throw new InternalServerErrorException(
        'Odoo IoT API Key belum dikonfigurasi. Atur di Pengaturan → Konfigurasi API Odoo WMS.',
      );
    }
    return key;
  }

  /** Convert scale reading to kilograms for Odoo contract. */
  toGrossWeightKg(weight: number, unit: string): number {
    const u = (unit || 'kg').toLowerCase();
    if (u === 'g') {
      return weight / 1000;
    }
    return weight;
  }

  async submitWeight(
    packageUid: string,
    grossWeightKg: number,
  ): Promise<OdooWeightSuccess> {
    if (!packageUid?.trim()) {
      throw new BadRequestException('package_uid is required');
    }
    if (!(grossWeightKg > 0)) {
      throw new BadRequestException('gross_weight must be greater than 0');
    }

    const url = `${this.getBaseUrl()}/api/wms/iot/weight`;
    const body = {
      package_uid: packageUid.trim(),
      gross_weight: Math.round(grossWeightKg * 100) / 100,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-FOOM-IoT-Key': this.getApiKey(),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      this.logger.error(`Odoo request failed: ${(err as Error).message}`);
      throw new InternalServerErrorException(
        'Failed to reach Odoo WMS server. Check ODOO_BASE_URL and network.',
      );
    }

    let data: OdooWeightSuccess | OdooWeightError;
    try {
      data = (await response.json()) as OdooWeightSuccess | OdooWeightError;
    } catch {
      throw new InternalServerErrorException(
        `Invalid response from Odoo (HTTP ${response.status})`,
      );
    }

    if (response.ok && 'success' in data && data.success) {
      return data;
    }

    const message =
      'error' in data && data.error
        ? data.error
        : `Odoo returned HTTP ${response.status}`;

    switch (response.status) {
      case 401:
        throw new UnauthorizedException(message);
      case 404:
        throw new NotFoundException(message);
      case 409:
        throw new ConflictException(message);
      case 400:
        throw new BadRequestException(message);
      default:
        throw new HttpException(message, response.status || 502);
    }
  }
}
