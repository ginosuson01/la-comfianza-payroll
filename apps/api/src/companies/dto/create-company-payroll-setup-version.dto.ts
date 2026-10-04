import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCompanyPayrollSetupVersionDto {
  @IsInt()
  @Min(1)
  @Max(1440)
  standardWorkMinutesPerDay!: number;

  @IsInt()
  @IsIn([5, 6])
  philHealthDailyWorkerScheduleDaysPerWeek!: number;

  @IsOptional()
  @Matches(/^[A-Za-z0-9.-]+$/)
  @MaxLength(20)
  minimumWageRegionCode?: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9.-]+$/)
  @MaxLength(40)
  minimumWageOrderCode?: string;

  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  minimumWageAreaClassification?: string;

  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  minimumWageSector?: string;

  @IsOptional()
  @Matches(/^\d+(?:\.\d{1,2})?$/, {
    message:
      'minimumWageDailyRate must be a positive monetary amount with at most 2 decimal places.',
  })
  minimumWageDailyRate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'minimumWageRateEffectiveFrom must use YYYY-MM-DD format.',
  })
  minimumWageRateEffectiveFrom?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'effectiveFrom must use YYYY-MM-DD format.',
  })
  effectiveFrom!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'effectiveTo must use YYYY-MM-DD format.',
  })
  effectiveTo?: string;
}
