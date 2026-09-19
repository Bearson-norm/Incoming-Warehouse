import { IsString, IsNotEmpty, IsNumber, IsOptional, IsObject } from 'class-validator';

export class CreatePackagingDto {
  @IsNumber()
  @IsNotEmpty()
  vendorId: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsNumber()
  tareWeight?: number;

  @IsOptional()
  @IsObject()
  metadata?: any;
}
