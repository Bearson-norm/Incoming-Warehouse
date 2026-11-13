import {
  IsOptional,
  IsBoolean,
  IsObject,
  IsString,
  MaxLength,
  Matches,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsIn,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import { parsePackageUidInput } from '../../lpn/parse-package-uid';

export class CreateSessionDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const parsed = parsePackageUidInput(value);
    if (parsed.kind === 'empty') return undefined;
    if (parsed.kind === 'reject') {
      throw new BadRequestException(parsed.message);
    }
    return parsed.uid;
  })
  @ValidateIf((_, v) => v != null && v !== '')
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/, {
    message:
      'packageUid must start with a letter or digit and may contain letters, digits, /, _, or -',
  })
  packageUid?: string;

  @IsOptional()
  @IsIn(['odoo', 'internal'])
  weighingMethod?: 'odoo' | 'internal';

  @IsOptional()
  @IsIn(['incoming', 'intrans'])
  flowType?: 'incoming' | 'intrans';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  vendorId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  packagingId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rmCodeId?: number;

  @IsOptional()
  @IsBoolean()
  autosaveEnabled?: boolean;

  /** Snapshot for label reprint */
  @IsOptional()
  @IsObject()
  labelMetadata?: Record<string, unknown>;

  @Type(() => Number)
  @IsNumber()
  scaleId: number;

  @IsString()
  @MaxLength(100)
  scaleName: string;

  /** Internal incoming only. Omit for a single LPN. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(30)
  batchQuantity?: number;
}
