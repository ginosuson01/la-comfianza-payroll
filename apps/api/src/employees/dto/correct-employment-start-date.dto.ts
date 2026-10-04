import { Transform } from 'class-transformer';
import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CorrectEmploymentStartDateDto {
  @IsDateString()
  correctedStartDate!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
