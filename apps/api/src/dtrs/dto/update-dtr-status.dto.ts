import { IsEnum } from 'class-validator';

import { DtrStatus } from '@payroll/database';

export class UpdateDtrStatusDto {
  @IsEnum(DtrStatus)
  status!: DtrStatus;
}
