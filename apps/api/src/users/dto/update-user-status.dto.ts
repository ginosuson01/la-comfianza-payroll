import { IsIn } from 'class-validator';
import { UserStatus } from '@payroll/database';

export class UpdateUserStatusDto {
  @IsIn([UserStatus.ACTIVE, UserStatus.DISABLED], {
    message: 'Status must be either ACTIVE or DISABLED.',
  })
  status!: UserStatus;
}
