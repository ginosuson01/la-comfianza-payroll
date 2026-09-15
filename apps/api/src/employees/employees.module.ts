import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { SecurityModule } from '../security/security.module';
import { EmployeeAlphaListCsvService } from './employee-alpha-list-csv.service';
import { EmployeeAlphaListPdfService } from './employee-alpha-list-pdf.service';
import { EmployeeAlphaListService } from './employee-alpha-list.service';
import { EmployeeCompensationService } from './employee-compensation.service';
import { EmployeeLeaveCreditService } from './employee-leave-credit.service';
import { EmployeePayrollProfileService } from './employee-payroll-profile.service';
import { EmployeeRecurringPayrollService } from './employee-recurring-payroll.service';
import { EmployeeStatusService } from './employee-status.service';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [AuditModule, SecurityModule],

  controllers: [EmployeesController],

  providers: [
    EmployeesService,
    EmployeeCompensationService,
    EmployeeRecurringPayrollService,
    EmployeeStatusService,
    EmployeePayrollProfileService,
    EmployeeLeaveCreditService,
    EmployeeAlphaListService,
    EmployeeAlphaListCsvService,
    EmployeeAlphaListPdfService,
  ],

  exports: [
    EmployeesService,
    EmployeeCompensationService,
    EmployeeRecurringPayrollService,
    EmployeeStatusService,
    EmployeePayrollProfileService,
    EmployeeLeaveCreditService,
    EmployeeAlphaListService,
    EmployeeAlphaListCsvService,
    EmployeeAlphaListPdfService,
  ],
})
export class EmployeesModule {}
