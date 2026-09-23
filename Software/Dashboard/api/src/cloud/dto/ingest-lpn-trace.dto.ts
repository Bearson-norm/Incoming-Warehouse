import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class IngestLpnTraceDto {
  @IsString()
  @MaxLength(100)
  stationId: string;

  @IsString()
  @MaxLength(160)
  localEventId: string;

  @IsString()
  @MaxLength(64)
  packageUid: string;

  @IsString()
  @MaxLength(64)
  eventType: string;

  @IsString()
  @MaxLength(100)
  username: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  deviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  gatewayId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  scaleId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  scaleName?: string;

  @IsDateString()
  sourceAt: string;

  @IsOptional()
  payload?: Record<string, unknown>;
}
