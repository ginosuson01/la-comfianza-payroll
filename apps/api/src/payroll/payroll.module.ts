import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { DtrsModule } from '../dtrs/dtrs.module';

import { PayrollCalculationService } from './payroll-calculation.service';
import { PayrollController } from './payroll.controller';
import { PayrollCutoffCalculationService } from './payroll-cutoff-calculation.service';
import { PayrollCutoffInputService } from './payroll-cutoff-input.service';
import { PayrollEmployeeHistoryService } from './payroll-employee-history.service';
import { PayrollGenerationService } from './payroll-generation.service';
import { PhilippineGovernmentContributionOrchestrationService } from './philippine-government-contribution-orchestration.service';
import { PayrollHistoryService } from './payroll-history.service';
import { PayrollInputService } from './payroll-input.service';
import { PayrollMonthlyStatutoryBasisService } from './payroll-monthly-statutory-basis.service';
import { PayrollCutoffPeriodService } from './payroll-cutoff-period.service';
import { PayrollStatutoryConfigService } from './payroll-statutory-config.service';

@Module({
  imports: [AuditModule, DtrsModule],

  controllers: [PayrollController],

  providers: [
    PayrollInputService,
    PayrollCutoffInputService,
    PayrollMonthlyStatutoryBasisService,
    PayrollCutoffPeriodService,
    PhilippineGovernmentContributionOrchestrationService,
    PayrollStatutoryConfigService,
    PayrollCalculationService,
    PayrollCutoffCalculationService,
    PayrollGenerationService,
    PayrollHistoryService,
    PayrollEmployeeHistoryService,
  ],

  exports: [
    PayrollInputService,
    PayrollCutoffInputService,
    PayrollMonthlyStatutoryBasisService,
    PayrollCutoffPeriodService,
    PhilippineGovernmentContributionOrchestrationService,
    PayrollStatutoryConfigService,
    PayrollCalculationService,
    PayrollCutoffCalculationService,
    PayrollGenerationService,
    PayrollHistoryService,
    PayrollEmployeeHistoryService,
  ],
})
export class PayrollModule {}
