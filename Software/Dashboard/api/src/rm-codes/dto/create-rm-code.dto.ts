import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRmCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  vendorId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  prodArea?: string;
}
