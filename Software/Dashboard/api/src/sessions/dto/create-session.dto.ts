import {
  IsOptional,
  IsBoolean,
  IsObject,
  IsString,
  MaxLength,
  Matches,
  IsNumber,
  IsIn,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateSessionDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
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
}
