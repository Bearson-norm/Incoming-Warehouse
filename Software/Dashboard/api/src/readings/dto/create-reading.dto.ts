import { IsNumber, IsString, IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class CreateReadingDto {
  @IsNumber()
  sessionId: number;

  @IsNumber()
  weight: number;

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
