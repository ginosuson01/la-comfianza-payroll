import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsPositive,
  Max,
} from 'class-validator';
import { PayBasis } from '@payroll/database';

export class SetCompensationDto {
  @IsEnum(PayBasis)
  payBasis!: PayBasis;

  @IsNumber(
    {
      maxDecimalPlaces: 4,
    },
    {
      message: 'Rate must be a valid number with up to 4 decimal places.',
    },
  )
  @IsPositive()
  @Max(99999999999999)
  rate!: number;

  @IsDateString()
  effectiveFrom!: string;
}
