import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRmCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;
}
