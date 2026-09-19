import { IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateReadingLabelDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @ValidateIf((_, v) => v != null && v !== '')
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/, {
    message:
      'packageUid must start with a letter or digit and may contain letters, digits, /, _, or -',
  })
  packageUid?: string;

  @IsOptional()
  @IsString()
  dateIncoming?: string;
}
