import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OdooSettingsService } from './odoo-settings.service';
import { IncomingOdooProcess } from './incoming-odoo-process';
import { roundGrams, toGrams } from '../common/weight-unit';

export interface OdooWeightSuccess {
  success: true;
  log_id: number;
  package_id?: number;
  gross_weight: number;
  tare_weight: number;
  net_weight: number;
  weight_status?: string;
  weighing_type?: string;
  qc_reference?: string;
  qc_record?: string;
  message: string;
}

export interface OdooWeightError {
  success: false;
  error: string;
}

/** Explicit E-01 contract for incoming Odoo. Omit it to keep the INTRANS body. */
export interface IncomingOdooContract {
  weighingType: IncomingOdooProcess;
  deviceUid: string;
  qcRecord?: string | null;
  tareWeightG?: number | null;
}

@Injectable()
export class OdooWeighingService {
  private readonly logger = new Logger(OdooWeighingService.name);
  private retryDelaysMs = [1000, 3000, 9000];

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

  /** Convert a scale reading to grams for storage and the Odoo payload. */
  toGrossWeightG(weight: number, unit: string): number {
    return toGrams(weight, unit);
  }

  async submitWeight(
    packageUid: string,
    grossWeightG: number,
    contract?: IncomingOdooContract,
  ): Promise<OdooWeightSuccess> {
    const body = contract
      ? this.buildIncomingBody(packageUid, grossWeightG, contract)
      : this.buildLegacyBody(packageUid, grossWeightG);
    return this.postWeight(body);
  }

  private buildLegacyBody(packageUid: string, grossWeightG: number) {
    const uid = packageUid?.trim();
    if (!uid) {
      throw new BadRequestException('package_uid is required');
    }
    if (!(grossWeightG > 0)) {
      throw new BadRequestException('gross_weight must be greater than 0');
    }
    return {
      package_uid: uid,
      gross_weight: roundGrams(grossWeightG),
    };
  }

  private buildIncomingBody(
    packageUid: string,
    grossWeightG: number,
    contract: IncomingOdooContract,
  ): Record<string, unknown> {
    if (!(grossWeightG > 0)) {
      throw new BadRequestException('gross_weight must be greater than 0');
    }
    const deviceUid = contract.deviceUid?.trim();
    if (!deviceUid) {
      throw new BadRequestException('device_uid is required');
    }
    const gross = roundGrams(grossWeightG);
    const uid = packageUid?.trim() || '';
    const body: Record<string, unknown> = {
      gross_weight: gross,
      weighing_type: contract.weighingType,
      device_uid: deviceUid,
    };

    if (contract.weighingType === 'qc_sample') {
      const qcRecord = contract.qcRecord?.trim();
      if (!qcRecord) {
        throw new BadRequestException('qc_reference is required');
      }
      const tare = contract.tareWeightG;
      if (tare == null || !Number.isFinite(tare) || tare < 0) {
        throw new BadRequestException('tare_weight must be >= 0');
      }
      const tareG = roundGrams(tare);
      if (!(tareG < gross)) {
        throw new BadRequestException(
          'tare_weight must be less than gross_weight',
        );
      }
      body.qc_reference = qcRecord;
      body.qc_record = qcRecord;
      body.tare_weight = tareG;
      if (uid) {
        body.package_uid = uid;
      }
      return body;
    }

    if (!uid) {
      throw new BadRequestException('package_uid is required');
    }
    body.package_uid = uid;
    return body;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async postWeight(
    body: Record<string, unknown>,
  ): Promise<OdooWeightSuccess> {
    const url = `${this.getBaseUrl()}/api/wms/iot/weight`;
    const apiKey = this.getApiKey();
    const maxAttempts = this.retryDelaysMs.length + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await this.delay(this.retryDelaysMs[attempt - 1]);
      }

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-FOOM-IoT-Key': apiKey,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (err) {
        this.logger.error(`Odoo request failed: ${(err as Error).message}`);
        if (attempt < maxAttempts - 1) {
          continue;
        }
        throw new InternalServerErrorException(
          'Failed to reach Odoo WMS server. Check ODOO_BASE_URL and network.',
        );
      }

      let data: OdooWeightSuccess | OdooWeightError | null = null;
      try {
        data = (await response.json()) as OdooWeightSuccess | OdooWeightError;
      } catch {
        if (response.status >= 500 && attempt < maxAttempts - 1) {
          continue;
        }
        throw new InternalServerErrorException(
          `Invalid response from Odoo (HTTP ${response.status})`,
        );
      }

      if (response.ok && data && 'success' in data && data.success) {
        return data;
      }

      const message =
        data && 'error' in data && data.error
          ? data.error
          : `Odoo returned HTTP ${response.status}`;

      if (response.status >= 500 && attempt < maxAttempts - 1) {
        this.logger.error(`Odoo HTTP ${response.status}: ${message}`);
        continue;
      }

      switch (response.status) {
        case 401:
          throw new UnauthorizedException(message);
        case 404:
          throw new NotFoundException(message);
        case 409:
          throw new ConflictException(message);
        case 400:
          throw new BadRequestException(message);
        case 422:
          throw new UnprocessableEntityException(message);
        default:
          if (response.status >= 500) {
            throw new InternalServerErrorException(message);
          }
          throw new HttpException(message, response.status || 502);
      }
    }

    throw new InternalServerErrorException(
      'Failed to reach Odoo WMS server. Check ODOO_BASE_URL and network.',
    );
  }
}
