import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RoleCode } from '@payroll/database';

import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { ResolvedAuthenticatedIdentity } from '../auth/interfaces/resolved-authenticated-identity.interface';

import { ListEmployeePayrollHistoryQueryDto } from './dto/list-employee-payroll-history-query.dto';
import { ListPayrollRunsQueryDto } from './dto/list-payroll-runs-query.dto';
import {
  PayrollEmployeeHistoryService,
  type EmployeePayrollHistoryResponse,
} from './payroll-employee-history.service';
import { PayrollCutoffCalculationService } from './payroll-cutoff-calculation.service';
import {
  PayrollGenerationService,
  type GeneratedPayrollRunResult,
} from './payroll-generation.service';
import {
  PayrollHistoryService,
  type PayrollRunDetail,
  type PayrollRunHistoryResponse,
} from './payroll-history.service';

export interface PayrollReadinessIssueResponse {
  source: 'INPUT' | 'CALCULATION';

  code: string;

  employeeId?: string;
  employeeNumber?: string;

  message: string;
}

export interface PayrollReadinessResponse {
  companyId: string;
  payrollCutoffId: string;

  ready: boolean;

  eligibleEmployeeCount: number;
  calculatedEmployeeCount: number;

  issues: PayrollReadinessIssueResponse[];
}

@Roles(RoleCode.PAYROLL_MANAGER)
@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly payrollGenerationService: PayrollGenerationService,

    private readonly payrollCutoffCalculationService: PayrollCutoffCalculationService,

    private readonly payrollHistoryService: PayrollHistoryService,

    private readonly payrollEmployeeHistoryService: PayrollEmployeeHistoryService,
  ) {}

  @Get('companies/:companyId/runs')
  listPayrollRuns(
    @Param('companyId')
    companyId: string,

    @Query()
    query: ListPayrollRunsQueryDto,
  ): Promise<PayrollRunHistoryResponse> {
    return this.payrollHistoryService.listPayrollRuns(companyId, query);
  }

  @Get('companies/:companyId/runs/:payrollRunId')
  getPayrollRunDetail(
    @Param('companyId')
    companyId: string,

    @Param('payrollRunId')
    payrollRunId: string,
  ): Promise<PayrollRunDetail> {
    return this.payrollHistoryService.getPayrollRunDetail(
      companyId,
      payrollRunId,
    );
  }

  @Get('companies/:companyId/employees/:employeeId/history')
  listEmployeePayrollHistory(
    @Param('companyId')
    companyId: string,

    @Param('employeeId')
    employeeId: string,

    @Query()
    query: ListEmployeePayrollHistoryQueryDto,
  ): Promise<EmployeePayrollHistoryResponse> {
    return this.payrollEmployeeHistoryService.listEmployeePayrollHistory(
      companyId,
      employeeId,
      query,
    );
  }

  @Get('companies/:companyId/cutoffs/:payrollCutoffId/readiness')
  async getPayrollReadiness(
    @Param('companyId')
    companyId: string,

    @Param('payrollCutoffId')
    payrollCutoffId: string,
  ): Promise<PayrollReadinessResponse> {
    const preflight =
      await this.payrollCutoffCalculationService.calculateCutoffPreflight(
        companyId,
        payrollCutoffId,
      );

    return {
      companyId: preflight.companyId,
      payrollCutoffId: preflight.payrollCutoffId,

      ready: preflight.ready,

      eligibleEmployeeCount: preflight.eligibleEmployeeCount,
      calculatedEmployeeCount: preflight.calculatedEmployeeCount,

      issues: [
        ...preflight.inputIssues.map((issue) => ({
          source: 'INPUT' as const,

          code: issue.code,

          employeeId: issue.employeeId,
          employeeNumber: issue.employeeNumber,

          message: issue.message,
        })),

        ...preflight.calculationIssues.map((issue) => ({
          source: 'CALCULATION' as const,

          code: issue.code,

          employeeId: issue.employeeId,
          employeeNumber: issue.employeeNumber,

          message: issue.message,
        })),
      ],
    };
  }

  @Post('companies/:companyId/cutoffs/:payrollCutoffId/generate')
  generateInitialPayroll(
    @Param('companyId')
    companyId: string,

    @Param('payrollCutoffId')
    payrollCutoffId: string,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<GeneratedPayrollRunResult> {
    return this.payrollGenerationService.generateInitialPayroll({
      companyId,

      payrollCutoffId,

      actorUserId: identity.user.id,
    });
  }

  @Post('companies/:companyId/cutoffs/:payrollCutoffId/regenerate')
  regeneratePayroll(
    @Param('companyId')
    companyId: string,

    @Param('payrollCutoffId')
    payrollCutoffId: string,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<GeneratedPayrollRunResult> {
    return this.payrollGenerationService.regeneratePayroll({
      companyId,

      payrollCutoffId,

      actorUserId: identity.user.id,
    });
  }
}
