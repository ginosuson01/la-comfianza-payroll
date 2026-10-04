import type { ResolvedAuthenticatedIdentity } from '../auth/interfaces/resolved-authenticated-identity.interface';
import type { EmployeeAlphaListCsvService } from './employee-alpha-list-csv.service';
import type { EmployeeAlphaListPdfService } from './employee-alpha-list-pdf.service';
import type { EmployeeAlphaListService } from './employee-alpha-list.service';
import type { EmployeeCompensationService } from './employee-compensation.service';
import type { EmployeeLeaveCreditService } from './employee-leave-credit.service';
import type { EmployeeLeaveEntitlementCycleService } from './employee-leave-entitlement-cycle.service';
import type { EmployeeLeaveEntitlementService } from './employee-leave-entitlement.service';
import type { EmployeePayrollProfileService } from './employee-payroll-profile.service';
import type { EmployeeRecurringPayrollService } from './employee-recurring-payroll.service';
import type { EmployeeStatusService } from './employee-status.service';
import { EmployeesController } from './employees.controller';
import type { EmployeesService } from './employees.service';

describe('EmployeesController', () => {
  it('forwards normal leave entitlement ensure with the authenticated actor', async () => {
    const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const actorUserId = '99999999-9999-4999-8999-999999999999';

    const ensureAnnualCycle = jest.fn().mockResolvedValue({
      status: 'CYCLE_READY',
      entitlement: {},
      cycle: null,
    });

    const leaveEntitlementCycleService = {
      ensureAnnualCycle,
    } as unknown as EmployeeLeaveEntitlementCycleService;

    const controller = new EmployeesController(
      {} as EmployeesService,
      {} as EmployeeCompensationService,
      {} as EmployeeRecurringPayrollService,
      {} as EmployeeStatusService,
      {} as EmployeePayrollProfileService,
      {} as EmployeeLeaveCreditService,
      leaveEntitlementCycleService,
      {} as EmployeeLeaveEntitlementService,
      {} as EmployeeAlphaListService,
      {} as EmployeeAlphaListCsvService,
      {} as EmployeeAlphaListPdfService,
    );

    const identity = {
      user: {
        id: actorUserId,
      },
    } as unknown as ResolvedAuthenticatedIdentity;

    const input = {
      asOfDate: '2026-10-03',
    };

    await controller.ensureLeaveEntitlementCycle(employeeId, input, identity);

    expect(ensureAnnualCycle).toHaveBeenCalledTimes(1);

    expect(ensureAnnualCycle).toHaveBeenCalledWith(
      employeeId,
      '2026-10-03',
      actorUserId,
    );
  });

  it('forwards leave entitlement initialization with the authenticated actor', async () => {
    const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const actorUserId = '99999999-9999-4999-8999-999999999999';

    const initializeAnnualCycle = jest.fn().mockResolvedValue({
      status: 'CYCLE_READY',
      entitlement: {},
      cycle: null,
    });

    const leaveEntitlementCycleService = {
      initializeAnnualCycle,
    } as unknown as EmployeeLeaveEntitlementCycleService;

    const controller = new EmployeesController(
      {} as EmployeesService,
      {} as EmployeeCompensationService,
      {} as EmployeeRecurringPayrollService,
      {} as EmployeeStatusService,
      {} as EmployeePayrollProfileService,
      {} as EmployeeLeaveCreditService,
      leaveEntitlementCycleService,
      {} as EmployeeLeaveEntitlementService,
      {} as EmployeeAlphaListService,
      {} as EmployeeAlphaListCsvService,
      {} as EmployeeAlphaListPdfService,
    );

    const identity = {
      user: {
        id: actorUserId,
      },
    } as unknown as ResolvedAuthenticatedIdentity;

    const input = {
      asOfDate: '2026-09-29',
    };

    await controller.initializeLeaveEntitlementCycle(
      employeeId,
      input,
      identity,
    );

    expect(initializeAnnualCycle).toHaveBeenCalledTimes(1);

    expect(initializeAnnualCycle).toHaveBeenCalledWith(
      employeeId,
      '2026-09-29',
      actorUserId,
    );
  });
  it('forwards leave entitlement review completion with the authenticated actor', async () => {
    const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const actorUserId = '99999999-9999-4999-8999-999999999999';

    const completeInitializationReview = jest.fn().mockResolvedValue({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      initializationReviewRequired: false,
    });

    const leaveEntitlementCycleService = {
      completeInitializationReview,
    } as unknown as EmployeeLeaveEntitlementCycleService;

    const controller = new EmployeesController(
      {} as EmployeesService,
      {} as EmployeeCompensationService,
      {} as EmployeeRecurringPayrollService,
      {} as EmployeeStatusService,
      {} as EmployeePayrollProfileService,
      {} as EmployeeLeaveCreditService,
      leaveEntitlementCycleService,
      {} as EmployeeLeaveEntitlementService,
      {} as EmployeeAlphaListService,
      {} as EmployeeAlphaListCsvService,
      {} as EmployeeAlphaListPdfService,
    );

    const identity = {
      user: {
        id: actorUserId,
      },
    } as unknown as ResolvedAuthenticatedIdentity;

    const input = {
      asOfDate: '2026-10-01',
    };

    await controller.completeLeaveEntitlementInitializationReview(
      employeeId,
      input,
      identity,
    );

    expect(completeInitializationReview).toHaveBeenCalledTimes(1);

    expect(completeInitializationReview).toHaveBeenCalledWith(
      employeeId,
      '2026-10-01',
      actorUserId,
    );
  });
});
