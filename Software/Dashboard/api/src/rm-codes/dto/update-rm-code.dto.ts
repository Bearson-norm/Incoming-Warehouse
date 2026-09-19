import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRmCodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;
}
