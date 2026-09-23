import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CloudSettingsService } from './cloud-settings.service';
import { CreateCloudScaleDto } from './dto/create-cloud-scale.dto';
import { UpdateCloudScaleDto } from './dto/update-cloud-scale.dto';
import { IngestCloudReadingDto } from './dto/ingest-cloud-reading.dto';
import { QueryCloudReadingsDto } from './dto/query-cloud-readings.dto';
import {
  CreateCloudMasterDataDto,
  MasterEntityType,
  UpdateCloudMasterDataDto,
} from './dto/cloud-master-data.dto';
import { IngestLpnTraceDto } from './dto/ingest-lpn-trace.dto';

@Injectable()
export class CloudClientService {
  private readonly logger = new Logger(CloudClientService.name);

  constructor(private cloudSettings: CloudSettingsService) {}

  private getBaseUrl(): string {
    const url = this.cloudSettings.getEffective().serverUrl;
    if (!url) {
      throw new ServiceUnavailableException(
        'Cloud server URL is not configured',
      );
    }
    return url.replace(/\/$/, '');
  }

  private getHeaders(
    authToken?: string,
    useSyncKey = false,
  ): Record<string, string> {
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
        let responseBody: unknown = text;
        try {
          const parsed = JSON.parse(text) as { message?: string | string[] };
          responseBody = parsed;
          message = Array.isArray(parsed.message)
            ? parsed.message.join(', ')
            : parsed.message || text;
        } catch {
          // keep raw text
        }
        if (response.status === 409) {
          throw new ConflictException(responseBody);
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
      if (
        error instanceof BadGatewayException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      this.logger.error(
        `Cloud request failed ${method} ${path}: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        `Cannot reach cloud server: ${(error as Error).message}`,
      );
    }
  }

  fetchScales(authToken?: string, includeInactive = false) {
    const qs = includeInactive ? '?includeInactive=true' : '';
    return this.request<unknown[]>('GET', `/scales${qs}`, {
      authToken,
      useSyncKey: true,
    });
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

  ingestTraceEvent(dto: IngestLpnTraceDto) {
    return this.request('POST', '/trace-events', {
      body: dto,
      useSyncKey: true,
    });
  }

  queryTrace(
    packageUid: string,
    query: Record<string, string | number | undefined>,
    authToken?: string,
  ) {
    const params = new URLSearchParams({ packageUid });
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });
    return this.request<{
      packageUid: string;
      items: unknown[];
      total: number;
    }>('GET', `/trace?${params.toString()}`, { authToken });
  }

  fetchMasterData(since?: string) {
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    return this.request<{
      vendors: Array<Record<string, any>>;
      packagings: Array<Record<string, any>>;
      rmCodes: Array<Record<string, any>>;
      cursor: string;
      generatedAt: string;
    }>('GET', `/master-data${qs}`, { useSyncKey: true });
  }

  createMasterData(dto: CreateCloudMasterDataDto, authToken: string) {
    return this.request('POST', '/master-data', { body: dto, authToken });
  }

  updateMasterData(
    entityType: MasterEntityType,
    cloudId: string,
    dto: UpdateCloudMasterDataDto,
    authToken: string,
  ) {
    return this.request(
      'PATCH',
      `/master-data/${entityType}/${encodeURIComponent(cloudId)}`,
      {
        body: dto,
        authToken,
      },
    );
  }

  deleteMasterData(
    entityType: MasterEntityType,
    cloudId: string,
    body: { expectedRevision: number; reason: string },
    authToken: string,
  ) {
    return this.request(
      'DELETE',
      `/master-data/${entityType}/${encodeURIComponent(cloudId)}`,
      {
        body,
        authToken,
      },
    );
  }

  getMasterDataHistory(
    entityType: MasterEntityType,
    cloudId: string,
    authToken: string,
  ) {
    return this.request<unknown[]>(
      'GET',
      `/master-data/${entityType}/${encodeURIComponent(cloudId)}/history`,
      { authToken },
    );
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
