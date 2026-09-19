import {
  IsDateString,
  IsIn,
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
  @Type(() => Number)
  @IsNumber()
  localReadingId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  packageUid?: string;

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
