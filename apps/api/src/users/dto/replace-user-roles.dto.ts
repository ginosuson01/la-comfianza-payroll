import { ArrayMinSize, ArrayUnique, IsArray, IsEnum } from 'class-validator';
import { RoleCode } from '@payroll/database';

export class ReplaceUserRolesDto {
  @IsArray()
  @ArrayMinSize(1, {
    message: 'At least one role must be assigned.',
  })
  @ArrayUnique({
    message: 'Duplicate role assignments are not allowed.',
  })
  @IsEnum(RoleCode, {
    each: true,
    message: 'Each role must be a valid role code.',
  })
  roles!: RoleCode[];
}
