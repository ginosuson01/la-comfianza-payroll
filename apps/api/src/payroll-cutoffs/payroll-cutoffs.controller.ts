import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { RoleCode } from '@payroll/database';

import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { ResolvedAuthenticatedIdentity } from '../auth/interfaces/resolved-authenticated-identity.interface';
import { ListPayrollCutoffsQueryDto } from './dto/list-payroll-cutoffs-query.dto';
import { ReopenPayrollCutoffDto } from './dto/reopen-payroll-cutoff.dto';
import {
  PayrollCutoffsService,
  type PayrollCutoffView,
} from './payroll-cutoffs.service';

@Roles(RoleCode.PAYROLL_MANAGER)
@Controller('payroll-cutoffs')
export class PayrollCutoffsController {
  constructor(private readonly payrollCutoffsService: PayrollCutoffsService) {}

  @Get()
  listPayrollCutoffs(
    @Query()
    query: ListPayrollCutoffsQueryDto,
  ): Promise<PayrollCutoffView[]> {
    return this.payrollCutoffsService.listPayrollCutoffs(query);
  }

  @Patch(':payrollCutoffId/lock')
  lockPayrollCutoff(
    @Param('payrollCutoffId')
    payrollCutoffId: string,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<PayrollCutoffView> {
    return this.payrollCutoffsService.lockPayrollCutoff(
      payrollCutoffId,
      identity.user.id,
    );
  }

  @Patch(':payrollCutoffId/reopen')
  reopenPayrollCutoff(
    @Param('payrollCutoffId')
    payrollCutoffId: string,

    @Body()
    input: ReopenPayrollCutoffDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<PayrollCutoffView> {
    return this.payrollCutoffsService.reopenPayrollCutoff(
      payrollCutoffId,
      input.reason,
      identity.user.id,
    );
  }
}
