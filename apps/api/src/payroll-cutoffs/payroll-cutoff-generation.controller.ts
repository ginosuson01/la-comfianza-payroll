import { Body, Controller, Post } from '@nestjs/common';
import { RoleCode } from '@payroll/database';

import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { ResolvedAuthenticatedIdentity } from '../auth/interfaces/resolved-authenticated-identity.interface';
import { GeneratePayrollCutoffsDto } from './dto/generate-payroll-cutoffs.dto';
import {
  PayrollCutoffGenerationService,
  type GeneratePayrollCutoffsResult,
} from './payroll-cutoff-generation.service';

@Roles(RoleCode.PAYROLL_MANAGER)
@Controller('payroll-cutoffs')
export class PayrollCutoffGenerationController {
  constructor(
    private readonly payrollCutoffGenerationService: PayrollCutoffGenerationService,
  ) {}

  @Post('generate')
  generatePayrollCutoffs(
    @Body()
    input: GeneratePayrollCutoffsDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<GeneratePayrollCutoffsResult> {
    return this.payrollCutoffGenerationService.generateForMonth(
      input,
      identity.user.id,
    );
  }
}
