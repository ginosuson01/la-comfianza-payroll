import { Controller, Get, Param } from '@nestjs/common';
import { RoleCode } from '@payroll/database';

import { Roles } from '../auth/decorators/roles.decorator';
import {
  DtrAttendanceSummaryService,
  type DtrAttendanceSummaryRecord,
} from './dtr-attendance-summary.service';

@Roles(RoleCode.PAYROLL_MANAGER)
@Controller('dtrs')
export class DtrAttendanceSummaryController {
  constructor(
    private readonly attendanceSummaryService: DtrAttendanceSummaryService,
  ) {}

  @Get(':dtrId/attendance-summary')
  getAttendanceSummary(
    @Param('dtrId')
    dtrId: string,
  ): Promise<DtrAttendanceSummaryRecord> {
    return this.attendanceSummaryService.getSummary(dtrId);
  }
}
