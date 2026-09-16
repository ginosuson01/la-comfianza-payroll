import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { SecurityModule } from '../security/security.module';

import { AttendanceReferenceController } from './attendance-reference.controller';
import { AttendanceReferenceService } from './attendance-reference.service';
import { DtrAttendanceSummaryController } from './dtr-attendance-summary.controller';
import { DtrAttendanceSummaryService } from './dtr-attendance-summary.service';
import { DtrEntriesService } from './dtr-entries.service';
import { DtrEntryValidationService } from './dtr-entry-validation.service';
import { DtrLeaveBalanceService } from './dtr-leave-balance.service';
import { DtrPayrollConfigService } from './dtr-payroll-config.service';
import { DtrsController } from './dtrs.controller';
import { DtrsService } from './dtrs.service';

@Module({
  imports: [AuditModule, SecurityModule],

  controllers: [
    DtrsController,
    AttendanceReferenceController,
    DtrAttendanceSummaryController,
  ],

  providers: [
    DtrsService,
    DtrEntriesService,
    DtrEntryValidationService,
    DtrPayrollConfigService,
    DtrLeaveBalanceService,
    AttendanceReferenceService,
    DtrAttendanceSummaryService,
  ],

  exports: [
    DtrsService,
    DtrEntriesService,
    DtrEntryValidationService,
    DtrPayrollConfigService,
    DtrLeaveBalanceService,
    AttendanceReferenceService,
    DtrAttendanceSummaryService,
  ],
})
export class DtrsModule {}
