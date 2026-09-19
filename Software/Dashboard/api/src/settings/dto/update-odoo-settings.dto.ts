import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class UpdateOdooSettingsDto {
  @IsString()
  @IsNotEmpty()
  baseUrl: string;

  @IsOptional()
  @IsString()
  iotApiKey?: string;
}
