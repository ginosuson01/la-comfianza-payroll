import { Controller, Get, Query } from '@nestjs/common';
import { RoleCode } from '@payroll/database';

import { Roles } from '../auth/decorators/roles.decorator';
import {
  AttendanceReferenceService,
  type AttendanceReferenceData,
} from './attendance-reference.service';
import { AttendanceReferenceQueryDto } from './dto/attendance-reference-query.dto';

@Roles(RoleCode.PAYROLL_MANAGER)
@Controller('attendance-reference')
export class AttendanceReferenceController {
  constructor(
    private readonly attendanceReferenceService: AttendanceReferenceService,
  ) {}

  @Get()
  getReferenceData(
    @Query()
    query: AttendanceReferenceQueryDto,
  ): Promise<AttendanceReferenceData> {
    return this.attendanceReferenceService.getReferenceData(query);
  }
}
