import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional } from 'class-validator';

import {
  DEFAULT_EMPLOYEE_ALPHA_LIST_COLUMNS,
  EmployeeAlphaListColumn,
} from '../employee-alpha-list.constants';
import { ListEmployeesQueryDto } from './list-employees-query.dto';

function normalizeColumns({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') {
    return [...DEFAULT_EMPLOYEE_ALPHA_LIST_COLUMNS];
  }

  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [value];

  return values
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export class EmployeeAlphaListQueryDto extends ListEmployeesQueryDto {
  @IsOptional()
  @Transform(normalizeColumns)
  @IsArray()
  @IsEnum(EmployeeAlphaListColumn, {
    each: true,
  })
  columns: EmployeeAlphaListColumn[] = [...DEFAULT_EMPLOYEE_ALPHA_LIST_COLUMNS];
}
