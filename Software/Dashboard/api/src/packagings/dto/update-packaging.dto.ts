import { IsString, IsOptional, IsNumber, IsObject } from 'class-validator';

export class UpdatePackagingDto {
  @IsOptional()
  @IsNumber()
  vendorId?: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  tareWeight?: number;

  @IsOptional()
  @IsObject()
  metadata?: any;
}
