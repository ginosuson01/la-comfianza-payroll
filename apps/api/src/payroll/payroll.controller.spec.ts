import { Reflector } from '@nestjs/core';
import { PayrollRunStatus, RoleCode } from '@payroll/database';

import { REQUIRED_ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { ResolvedAuthenticatedIdentity } from '../auth/interfaces/resolved-authenticated-identity.interface';

import type { PayrollAdjustmentService } from './payroll-adjustment.service';
import { PayrollController } from './payroll.controller';
import type { PayrollCutoffCalculationService } from './payroll-cutoff-calculation.service';
import type { PayrollEmployeeHistoryService } from './payroll-employee-history.service';
import type { PayrollGenerationService } from './payroll-generation.service';
import type { PayrollHistoryService } from './payroll-history.service';

describe('PayrollController', () => {
  const actorUserId = '99999999-9999-4999-8999-999999999999';

  function createFixture() {
    const payrollGenerationService = {
      generateInitialPayroll: jest.fn(),

      regeneratePayroll: jest.fn(),
    };

    const payrollCutoffCalculationService = {
      calculateCutoffPreflight: jest.fn(),
    };

    const payrollHistoryService = {
      listPayrollRuns: jest.fn(),

      getPayrollRunDetail: jest.fn(),
    };

    const payrollEmployeeHistoryService = {
      listEmployeePayrollHistory: jest.fn(),
    };

    const payrollAdjustmentService = {
      listAdjustments: jest.fn(),

      createAdjustment: jest.fn(),

      updateAdjustment: jest.fn(),

      deleteAdjustment: jest.fn(),
    };

    const controller = new PayrollController(
      payrollGenerationService as unknown as PayrollGenerationService,

      payrollCutoffCalculationService as unknown as PayrollCutoffCalculationService,

      payrollHistoryService as unknown as PayrollHistoryService,

      payrollEmployeeHistoryService as unknown as PayrollEmployeeHistoryService,

      payrollAdjustmentService as unknown as PayrollAdjustmentService,
    );

    return {
      controller,

      payrollGenerationService,

      payrollCutoffCalculationService,

      payrollHistoryService,

      payrollEmployeeHistoryService,

      payrollAdjustmentService,
    };
  }

  function createIdentity(): ResolvedAuthenticatedIdentity {
    return {
      user: {
        id: actorUserId,
      },
    } as unknown as ResolvedAuthenticatedIdentity;
  }

  it('requires the PAYROLL_MANAGER role', () => {
    const reflector = new Reflector();

    const requiredRoles = reflector.get<RoleCode[]>(
      REQUIRED_ROLES_KEY,
      PayrollController,
    );

    expect(requiredRoles).toEqual([RoleCode.PAYROLL_MANAGER]);
  });

  it('lists payroll run history for the requested company', async () => {
    const { controller, payrollHistoryService } = createFixture();

    const query = {
      status: PayrollRunStatus.CURRENT_LOCKED,

      page: 1,

      pageSize: 25,
    };

    const response = {
      items: [],

      pagination: {
        page: 1,

        pageSize: 25,

        total: 0,

        totalPages: 0,
      },
    };

    payrollHistoryService.listPayrollRuns.mockResolvedValue(response);

    const result = await controller.listPayrollRuns('company-1', query);

    expect(payrollHistoryService.listPayrollRuns).toHaveBeenCalledWith(
      'company-1',
      query,
    );

    expect(result).toEqual(response);
  });

  it('returns payroll run detail for the requested company and run', async () => {
    const { controller, payrollHistoryService } = createFixture();

    const detail = {
      id: 'run-2',

      version: 2,

      status: PayrollRunStatus.CURRENT_LOCKED,

      statusBreakdown: {
        totalEmployees: 3,

        active: 1,

        activeHold: 1,

        resigned: 1,
      },

      employees: [],
    };

    payrollHistoryService.getPayrollRunDetail.mockResolvedValue(detail);

    const result = await controller.getPayrollRunDetail('company-1', 'run-2');

    expect(payrollHistoryService.getPayrollRunDetail).toHaveBeenCalledWith(
      'company-1',
      'run-2',
    );

    expect(result).toBe(detail);
  });

  it('lists employee payroll history for the requested company and employee', async () => {
    const { controller, payrollEmployeeHistoryService } = createFixture();

    const query = {
      runStatus: PayrollRunStatus.CURRENT_LOCKED,

      page: 1,

      pageSize: 25,
    };

    const response = {
      items: [],

      pagination: {
        page: 1,

        pageSize: 25,

        total: 0,

        totalPages: 0,
      },
    };

    payrollEmployeeHistoryService.listEmployeePayrollHistory.mockResolvedValue(
      response,
    );

    const result = await controller.listEmployeePayrollHistory(
      'company-1',
      'employee-1',
      query,
    );

    expect(
      payrollEmployeeHistoryService.listEmployeePayrollHistory,
    ).toHaveBeenCalledWith('company-1', 'employee-1', query);

    expect(result).toEqual(response);
  });

  it('returns sanitized payroll readiness diagnostics', async () => {
    const { controller, payrollCutoffCalculationService } = createFixture();

    payrollCutoffCalculationService.calculateCutoffPreflight.mockResolvedValue({
      companyId: 'company-1',

      payrollCutoffId: 'cutoff-1',

      cutoff: {
        id: 'cutoff-1',

        startDate: '2026-09-16',
        endDate: '2026-09-30',
        payDate: '2026-10-10',

        status: 'OPEN',
      },

      ready: false,

      eligibleEmployeeCount: 3,
      calculatedEmployeeCount: 2,

      inputIssues: [
        {
          code: 'INPUT_ASSEMBLY_FAILED',

          employeeId: 'employee-1',
          employeeNumber: 'EMP-000001',

          message: 'Employee payroll input is incomplete.',
        },
      ],

      calculationIssues: [
        {
          code: 'EMPLOYEE_CALCULATION_INCOMPLETE',

          employeeId: 'employee-2',
          employeeNumber: 'EMP-000002',

          message: 'Employee payroll calculation is incomplete.',
        },
      ],

      companyPayrollSetupVersionId: 'setup-version-1',

      configSnapshot: {
        internal: 'not exposed',
      },

      employees: [],

      totals: null,
    });

    const result = await controller.getPayrollReadiness(
      'company-1',
      'cutoff-1',
    );

    expect(
      payrollCutoffCalculationService.calculateCutoffPreflight,
    ).toHaveBeenCalledWith('company-1', 'cutoff-1');

    expect(result).toEqual({
      companyId: 'company-1',
      payrollCutoffId: 'cutoff-1',

      ready: false,

      eligibleEmployeeCount: 3,
      calculatedEmployeeCount: 2,

      issues: [
        {
          source: 'INPUT',

          code: 'INPUT_ASSEMBLY_FAILED',

          employeeId: 'employee-1',
          employeeNumber: 'EMP-000001',

          message: 'Employee payroll input is incomplete.',
        },
        {
          source: 'CALCULATION',

          code: 'EMPLOYEE_CALCULATION_INCOMPLETE',

          employeeId: 'employee-2',
          employeeNumber: 'EMP-000002',

          message: 'Employee payroll calculation is incomplete.',
        },
      ],
    });
  });

  it('generates initial payroll for the requested company and cutoff using the authenticated actor', async () => {
    const { controller, payrollGenerationService } = createFixture();

    payrollGenerationService.generateInitialPayroll.mockResolvedValue({
      id: 'payroll-run-v1',

      companyId: 'company-1',

      payrollCutoffId: 'cutoff-1',

      version: 1,

      status: PayrollRunStatus.CURRENT_LOCKED,

      employeeCount: 10,

      totalGross: '10000.00',

      totalNet: '9000.00',

      cashPayoutTotal: '4000.00',

      atmPayoutTotal: '5000.00',

      activeHoldTotal: '0.00',

      clientPayableGross: null,
    });

    const result = await controller.generateInitialPayroll(
      'company-1',
      'cutoff-1',
      createIdentity(),
    );

    expect(
      payrollGenerationService.generateInitialPayroll,
    ).toHaveBeenCalledWith({
      companyId: 'company-1',

      payrollCutoffId: 'cutoff-1',

      actorUserId,
    });

    expect(result.version).toBe(1);

    expect(result.status).toBe(PayrollRunStatus.CURRENT_LOCKED);
  });

  it('regenerates payroll for the requested company and cutoff using the authenticated actor', async () => {
    const { controller, payrollGenerationService } = createFixture();

    payrollGenerationService.regeneratePayroll.mockResolvedValue({
      id: 'payroll-run-v2',

      companyId: 'company-1',

      payrollCutoffId: 'cutoff-1',

      version: 2,

      status: PayrollRunStatus.CURRENT_LOCKED,

      employeeCount: 10,

      totalGross: '10250.00',

      totalNet: '9250.00',

      cashPayoutTotal: '4250.00',

      atmPayoutTotal: '5000.00',

      activeHoldTotal: '0.00',

      clientPayableGross: null,
    });

    const result = await controller.regeneratePayroll(
      'company-1',
      'cutoff-1',
      createIdentity(),
    );

    expect(payrollGenerationService.regeneratePayroll).toHaveBeenCalledWith({
      companyId: 'company-1',

      payrollCutoffId: 'cutoff-1',

      actorUserId,
    });

    expect(result.version).toBe(2);

    expect(result.status).toBe(PayrollRunStatus.CURRENT_LOCKED);
  });

  it('lists payroll adjustments for a cutoff', async () => {
    const { controller, payrollAdjustmentService } = createFixture();

    const response = [
      {
        id: 'adjustment-1',

        companyId: 'company-1',
        payrollCutoffId: 'cutoff-1',
        employeeId: 'employee-1',

        type: 'EARNING',

        code: 'BONUS',
        description: 'Performance Bonus',

        amount: '1500',

        reason: 'Approved payroll adjustment',

        taxable: true,

        pagIbigFundSalaryTreatment: 'INCLUDE',

        createdByUserId: actorUserId,
        createdAt: new Date('2026-09-10T00:00:00.000Z'),
      },
    ];

    payrollAdjustmentService.listAdjustments.mockResolvedValue(response);

    const result = await controller.listPayrollAdjustments(
      'company-1',
      'cutoff-1',
      'employee-1',
    );

    expect(payrollAdjustmentService.listAdjustments).toHaveBeenCalledWith(
      'company-1',
      'cutoff-1',
      'employee-1',
    );

    expect(result).toBe(response);
  });

  it('creates a payroll adjustment using the authenticated actor', async () => {
    const { controller, payrollAdjustmentService } = createFixture();

    const input = {
      type: 'EARNING',

      code: 'BONUS',
      description: 'Performance Bonus',

      amount: 1500,

      reason: 'Approved payroll adjustment',

      taxable: true,

      pagIbigFundSalaryTreatment: 'INCLUDE',
    };

    payrollAdjustmentService.createAdjustment.mockResolvedValue({
      id: 'adjustment-1',
    });

    await controller.createPayrollAdjustment(
      'company-1',
      'cutoff-1',
      'employee-1',
      input as never,
      createIdentity(),
    );

    expect(payrollAdjustmentService.createAdjustment).toHaveBeenCalledWith(
      'company-1',
      'cutoff-1',
      'employee-1',
      input,
      actorUserId,
    );
  });

  it('updates a payroll adjustment using the authenticated actor', async () => {
    const { controller, payrollAdjustmentService } = createFixture();

    const input = {
      description: 'Corrected Performance Bonus',

      amount: 1750,

      reason: 'Corrected amount',
    };

    payrollAdjustmentService.updateAdjustment.mockResolvedValue({
      id: 'adjustment-1',
    });

    await controller.updatePayrollAdjustment(
      'company-1',
      'cutoff-1',
      'employee-1',
      'adjustment-1',
      input,
      createIdentity(),
    );

    expect(payrollAdjustmentService.updateAdjustment).toHaveBeenCalledWith(
      'company-1',
      'cutoff-1',
      'employee-1',
      'adjustment-1',
      input,
      actorUserId,
    );
  });

  it('deletes a payroll adjustment using the authenticated actor', async () => {
    const { controller, payrollAdjustmentService } = createFixture();

    payrollAdjustmentService.deleteAdjustment.mockResolvedValue({
      id: 'adjustment-1',

      deleted: true,
    });

    const result = await controller.deletePayrollAdjustment(
      'company-1',
      'cutoff-1',
      'employee-1',
      'adjustment-1',
      createIdentity(),
    );

    expect(payrollAdjustmentService.deleteAdjustment).toHaveBeenCalledWith(
      'company-1',
      'cutoff-1',
      'employee-1',
      'adjustment-1',
      actorUserId,
    );

    expect(result).toEqual({
      id: 'adjustment-1',

      deleted: true,
    });
  });
});
