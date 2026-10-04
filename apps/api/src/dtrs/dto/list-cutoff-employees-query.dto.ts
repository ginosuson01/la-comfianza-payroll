import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class ListCutoffEmployeesQueryDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  payrollCutoffId!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(200)
  search?: string;
}
