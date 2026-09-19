import { IsString, IsNumber, IsBoolean, IsOptional, IsEnum } from 'class-validator';

export class WeightUpdateDto {
  @IsString()
  gatewayId: string;

  @IsString()
  readingId: string;

  @IsNumber()
  weight: number;

  @IsString()
  unit: string;

  @IsBoolean()
  stable: boolean;

  @IsOptional()
  @IsEnum(['gross', 'net'])
  grossOrNet?: 'gross' | 'net';

  @IsString()
  rawLine: string;

  @IsString()
  capturedAt: string;
}
