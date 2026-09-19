import { IsString, IsOptional } from 'class-validator';

export class UpdateVendorDto {
  @IsString()
  @IsOptional()
  name?: string;
}
