import { Transform } from 'class-transformer';
import { IsDateString, Matches } from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class GetEmployeeLeaveEntitlementQueryDto {
  @Transform(trimString)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'asOfDate must use YYYY-MM-DD format.',
  })
  @IsDateString({ strict: true })
  asOfDate!: string;
}
