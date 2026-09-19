import { Type } from 'class-transformer';
import { IsOptional, IsNumber, IsDateString, IsString, Max, Min } from 'class-validator';

export class QueryReadingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sessionId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  vendorId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  packagingId?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  userId?: number;

  @IsOptional()
  @IsString()
  gatewayId?: string;

  @IsOptional()
  @IsString()
  packageUid?: string;

  @IsOptional()
  @IsString()
  flowType?: string;

  @IsOptional()
  @IsString()
  weighingMethod?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
