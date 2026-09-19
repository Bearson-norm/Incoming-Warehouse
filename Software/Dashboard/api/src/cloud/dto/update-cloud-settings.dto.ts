import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCloudSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  serverUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  syncApiKey?: string;
}
