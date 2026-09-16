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

export class UpdateDtrEntryDto {
  @IsOptional()
  @IsDateString()
  workDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  regularMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lateMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  undertimeMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  absenceMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  leaveMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  nightDifferentialMinutes?: number;

  @IsOptional()
  @IsBoolean()
  restDay?: boolean;

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
