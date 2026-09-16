import { IsUUID, Matches } from 'class-validator';

export class AttendanceReferenceQueryDto {
  @IsUUID()
  companyId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate!: string;
}
