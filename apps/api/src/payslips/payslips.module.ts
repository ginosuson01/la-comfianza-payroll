import { Module } from '@nestjs/common';

import { PayslipDataService } from './payslip-data.service';

@Module({
  providers: [PayslipDataService],

  exports: [PayslipDataService],
})
export class PayslipsModule {}
