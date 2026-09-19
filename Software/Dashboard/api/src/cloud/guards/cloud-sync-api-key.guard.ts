import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CloudSettingsService } from '../cloud-settings.service';

@Injectable()
export class CloudSyncApiKeyGuard implements CanActivate {
  constructor(private cloudSettings: CloudSettingsService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const headerKey =
      request.headers['x-cloud-sync-key'] ||
      request.headers['x-cloud-api-key'] ||
      request.headers['authorization']?.replace(/^Bearer\s+/i, '');

    const expected = this.cloudSettings.getSyncApiKeyForValidation();
    if (!expected) {
      throw new UnauthorizedException('Cloud sync API key is not configured on server');
    }
    if (!headerKey || headerKey !== expected) {
      throw new UnauthorizedException('Invalid cloud sync API key');
    }
    return true;
  }
}
