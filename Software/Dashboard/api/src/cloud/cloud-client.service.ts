import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CloudSettingsService } from './cloud-settings.service';
import { CreateCloudScaleDto } from './dto/create-cloud-scale.dto';
import { UpdateCloudScaleDto } from './dto/update-cloud-scale.dto';
import { IngestCloudReadingDto } from './dto/ingest-cloud-reading.dto';
import { QueryCloudReadingsDto } from './dto/query-cloud-readings.dto';

@Injectable()
export class CloudClientService {
  private readonly logger = new Logger(CloudClientService.name);

  constructor(private cloudSettings: CloudSettingsService) {}

  private getBaseUrl(): string {
    const url = this.cloudSettings.getEffective().serverUrl;
    if (!url) {
      throw new ServiceUnavailableException('Cloud server URL is not configured');
    }
    return url.replace(/\/$/, '');
  }

  private getHeaders(authToken?: string, useSyncKey = false): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (useSyncKey) {
      const key = this.cloudSettings.getEffective().syncApiKey;
      if (key) {
        headers['X-Cloud-Sync-Key'] = key;
      }
    }
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      authToken?: string;
      useSyncKey?: boolean;
    },
  ): Promise<T> {
    const url = `${this.getBaseUrl()}/api/cloud${path}`;
    try {
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(options?.authToken, options?.useSyncKey),
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const text = await response.text();
        let message = text;
        try {
          const parsed = JSON.parse(text) as { message?: string | string[] };
          message = Array.isArray(parsed.message)
            ? parsed.message.join(', ')
            : parsed.message || text;
        } catch {
          // keep raw text
        }
        throw new BadGatewayException(
          `Cloud server error (${response.status}): ${message}`,
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      this.logger.error(`Cloud request failed ${method} ${path}: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        `Cannot reach cloud server: ${(error as Error).message}`,
      );
    }
  }

  fetchScales(authToken?: string, includeInactive = false) {
    const qs = includeInactive ? '?includeInactive=true' : '';
    return this.request<unknown[]>('GET', `/scales${qs}`, { authToken, useSyncKey: true });
  }

  createScale(dto: CreateCloudScaleDto, authToken: string) {
    return this.request('POST', '/scales', { body: dto, authToken });
  }

  updateScale(id: number, dto: UpdateCloudScaleDto, authToken: string) {
    return this.request('PATCH', `/scales/${id}`, { body: dto, authToken });
  }

  deactivateScale(id: number, authToken: string) {
    return this.request('DELETE', `/scales/${id}`, { authToken });
  }

  ingestReading(dto: IngestCloudReadingDto) {
    return this.request('POST', '/readings', { body: dto, useSyncKey: true });
  }

  queryReadings(query: QueryCloudReadingsDto, authToken?: string) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value != null && value !== '') {
        params.set(key, String(value));
      }
    });
    const qs = params.toString();
    return this.request<{ items: unknown[]; total: number }>(
      'GET',
      `/readings${qs ? `?${qs}` : ''}`,
      { authToken, useSyncKey: true },
    );
  }

  getStatus(authToken?: string) {
    return this.request<Record<string, unknown>>('GET', '/status', {
      authToken,
      useSyncKey: true,
    });
  }
}
