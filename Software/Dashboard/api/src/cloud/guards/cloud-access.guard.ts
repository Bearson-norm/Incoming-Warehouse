import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CloudSettingsService } from '../cloud-settings.service';

@Injectable()
export class CloudAccessGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private cloudSettings: CloudSettingsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const headerKey =
      request.headers['x-cloud-sync-key'] ||
      request.headers['x-cloud-api-key'];

    const expected = this.cloudSettings.getSyncApiKeyForValidation();
    if (expected && headerKey === expected) {
      request.cloudSyncAuthorized = true;
      return true;
    }

    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const payload = this.jwtService.verify(token);
        request.user = {
          userId: payload.sub,
          username: payload.username,
          role: payload.role,
        };
        return true;
      } catch {
        throw new UnauthorizedException('Invalid or expired token');
      }
    }

    throw new UnauthorizedException('Cloud access requires JWT or sync API key');
  }
}
