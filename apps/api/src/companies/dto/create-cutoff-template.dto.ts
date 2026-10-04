import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsDefined,
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CutoffFrequency } from '@payroll/database';

export type CutoffDayMode = 'DAY' | 'LAST_DAY';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeCode({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class CutoffDateRuleDto {
  @IsIn(['DAY', 'LAST_DAY'])
  mode!: CutoffDayMode;

  @ValidateIf((value: CutoffDateRuleDto) => value.mode === 'DAY')
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  day?: number;

  @Type(() => Number)
  @IsInt()
  @Min(-1)
  @Max(1)
  monthOffset!: number;
}

export class SemiMonthlyCutoffPeriodDto {
  @Transform(normalizeCode)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, {
    message:
      'Period code may contain uppercase letters, numbers, and single hyphens only.',
  })
  code!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ValidateNested()
  @Type(() => CutoffDateRuleDto)
  start!: CutoffDateRuleDto;

  @ValidateNested()
  @Type(() => CutoffDateRuleDto)
  end!: CutoffDateRuleDto;

  @ValidateNested()
  @Type(() => CutoffDateRuleDto)
  pay!: CutoffDateRuleDto;
}

export class SemiMonthlyCutoffConfigurationDto {
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @ValidateNested({
    each: true,
  })
  @Type(() => SemiMonthlyCutoffPeriodDto)
  periods!: SemiMonthlyCutoffPeriodDto[];
}

export class CreateCutoffTemplateDto {
  @Transform(normalizeCode)
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, {
    message:
      'Cutoff template code may contain uppercase letters, numbers, and single hyphens only.',
  })
  code!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @Equals(CutoffFrequency.SEMI_MONTHLY, {
    message: 'Only SEMI_MONTHLY cutoff templates are currently supported.',
  })
  frequency!: CutoffFrequency;

  @ValidateNested()
  @Type(() => SemiMonthlyCutoffConfigurationDto)
  configuration!: SemiMonthlyCutoffConfigurationDto;
}
