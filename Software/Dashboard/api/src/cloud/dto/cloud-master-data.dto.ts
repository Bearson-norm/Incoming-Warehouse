import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const MASTER_ENTITY_TYPES = ['vendor', 'packaging', 'rmCode'] as const;
export type MasterEntityType = (typeof MASTER_ENTITY_TYPES)[number];

export class CreateCloudMasterDataDto {
  @IsIn(MASTER_ENTITY_TYPES)
  entityType: MasterEntityType;

  @IsString()
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  code?: string;

  @IsOptional()
  @IsString()
  vendorCloudId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tareWeight?: number;

  @IsOptional()
  metadata?: unknown;

  @IsOptional()
  @IsDateString()
  issuedAt?: string;
}

export class UpdateCloudMasterDataDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision: number;

  @IsString()
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  code?: string;

  @IsOptional()
  @IsString()
  vendorCloudId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tareWeight?: number;

  @IsOptional()
  metadata?: unknown;

  @IsOptional()
  @IsDateString()
  issuedAt?: string;
}

export class DeleteCloudMasterDataDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision: number;

  @IsString()
  @MaxLength(500)
  reason: string;
}
