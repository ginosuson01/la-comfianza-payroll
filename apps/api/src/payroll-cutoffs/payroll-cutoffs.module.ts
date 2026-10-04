import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PayrollCutoffGenerationController } from './payroll-cutoff-generation.controller';
import { PayrollCutoffGenerationService } from './payroll-cutoff-generation.service';
import { PayrollCutoffsController } from './payroll-cutoffs.controller';
import { PayrollCutoffsService } from './payroll-cutoffs.service';

@Module({
  imports: [AuditModule],

  controllers: [PayrollCutoffsController, PayrollCutoffGenerationController],

  providers: [PayrollCutoffsService, PayrollCutoffGenerationService],

  exports: [PayrollCutoffsService, PayrollCutoffGenerationService],
})
export class PayrollCutoffsModule {}
