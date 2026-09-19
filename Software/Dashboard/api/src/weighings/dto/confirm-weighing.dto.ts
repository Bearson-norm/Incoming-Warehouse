import {
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConfirmWeighingDto {
  @Type(() => Number)
  @IsNumber()
  sessionId: number;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsBoolean()
  stable?: boolean;

  @IsOptional()
  @IsString()
  rawLine?: string;

  @IsOptional()
  @IsDateString()
  capturedAt?: string;
}
