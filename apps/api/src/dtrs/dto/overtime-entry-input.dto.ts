import { Type } from 'class-transformer';
import { IsEnum, IsInt, Min } from 'class-validator';
import { OvertimeType } from '@payroll/database';

export class OvertimeEntryInputDto {
  @IsEnum(OvertimeType)
  type!: OvertimeType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  minutes!: number;
}
