import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IngestCloudReadingDto {
  @Type(() => Number)
  @IsNumber()
  scaleId: number;

  @IsString()
  @MaxLength(100)
  scaleName: string;

  @IsString()
  @MaxLength(100)
  username: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  stationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  eventId?: string;

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
  localReadingId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  localSessionId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  packageUid?: string;

  @IsOptional()
  @IsString()
  vendorCloudId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  vendorSnapshot?: string;

  @IsOptional()
  @IsString()
  packagingCloudId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  packagingSnapshot?: string;

  @IsOptional()
  @IsString()
  rmCodeCloudId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  rmCodeSnapshot?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  labelMetadata?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  odooLogId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  odooPackageId?: number;

  @IsIn(['incoming', 'intrans'])
  flowType: 'incoming' | 'intrans';

  @IsIn(['odoo', 'internal'])
  weighingMethod: 'odoo' | 'internal';

  @Type(() => Number)
  @IsNumber()
  weight: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  grossWeight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tareWeight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  netWeight?: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  weightStatus?: string;

  @IsDateString()
  capturedAt: string;
}
