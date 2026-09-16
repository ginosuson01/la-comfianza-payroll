import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PayrollCutoffsController } from './payroll-cutoffs.controller';
import { PayrollCutoffsService } from './payroll-cutoffs.service';

@Module({
  imports: [AuditModule],

  controllers: [PayrollCutoffsController],

  providers: [PayrollCutoffsService],

  exports: [PayrollCutoffsService],
})
export class PayrollCutoffsModule {}
