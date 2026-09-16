import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { OvertimeEntryInputDto } from './overtime-entry-input.dto';

export class DtrEntryValuesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  regularMinutes = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lateMinutes = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  undertimeMinutes = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  absenceMinutes = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  leaveMinutes = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  nightDifferentialMinutes = 0;

  @IsOptional()
  @IsBoolean()
  restDay = false;

  @IsOptional()
  @IsUUID()
  leaveTypeId?: string | null;

  @IsOptional()
  @IsUUID()
  holidayId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OvertimeEntryInputDto)
  overtimeEntries?: OvertimeEntryInputDto[];
}

export class CreateDtrEntryDto extends DtrEntryValuesDto {
  @IsDateString()
  workDate!: string;
}
