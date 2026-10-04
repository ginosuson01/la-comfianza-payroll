import { BadRequestException, Injectable } from '@nestjs/common';
import { EmployeeType, LeaveTransactionType, Prisma } from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import {
  EMPLOYEE_MANAGEMENT_AUDIT_MODULE,
  EMPLOYEE_MANAGEMENT_ENTITY_TYPE,
  EmployeeManagementAuditAction,
} from './employee-management-audit.constants';
import { planAnnualLeaveAccountAllocations } from './employee-annual-leave-allocation';
import {
  EmployeeLeaveEntitlementService,
  type EmployeeLeaveEntitlementView,
} from './employee-leave-entitlement.service';

export type EmployeeLeaveEntitlementCycleEnsureStatus =
  'CLASSIFICATION_REQUIRED' | 'NOT_YET_ELIGIBLE' | 'CYCLE_READY';

export interface EmployeeLeaveEntitlementCycleView {
  id: string;

  employeeId: string;
  employmentRecordId: string;

  calendarYear: number;

  employeeType: EmployeeType;

  employmentStartDate: string;
  eligibilityDate: string;

  annualEntitlementDays: string;

  effectiveFrom: string;
  expiresOn: string;

  initializationReviewRequired: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeLeaveEntitlementCycleEnsureResult {
  status: EmployeeLeaveEntitlementCycleEnsureStatus;

  entitlement: EmployeeLeaveEntitlementView;

  cycle: EmployeeLeaveEntitlementCycleView | null;
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toUtcDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

@Injectable()
export class EmployeeLeaveEntitlementCycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EmployeeLeaveEntitlementService,
    private readonly auditLog: AuditLogService,
  ) {}

  async ensureAnnualCycle(
    employeeId: string,
    asOfDate: string,
    actorUserId: string,
  ): Promise<EmployeeLeaveEntitlementCycleEnsureResult> {
    const entitlement = await this.entitlementService.getLeaveEntitlement(
      employeeId,
      asOfDate,
    );

    if (entitlement.eligibilityStatus === 'CLASSIFICATION_REQUIRED') {
      return {
        status: 'CLASSIFICATION_REQUIRED',
        entitlement,
        cycle: null,
      };
    }

    if (!entitlement.eligible) {
      return {
        status: 'NOT_YET_ELIGIBLE',
        entitlement,
        cycle: null,
      };
    }

    if (
      !entitlement.employeeType ||
      !entitlement.eligibilityDate ||
      entitlement.annualPaidLeaveDays === null
    ) {
      throw new Error(
        'Eligible leave entitlement is missing required classification data.',
      );
    }

    if (
      !entitlement.balanceAllocation ||
      !entitlement.calendarAllocationPolicy
    ) {
      throw new Error(
        'Eligible leave entitlement is missing required allocation data.',
      );
    }

    const employeeType = entitlement.employeeType;
    const eligibilityDate = entitlement.eligibilityDate;
    const annualPaidLeaveDays = entitlement.annualPaidLeaveDays;

    const allocationPlan = planAnnualLeaveAccountAllocations({
      employmentGroup:
        employeeType === EmployeeType.LACOM_INTERNAL ? 'INTERNAL' : 'CLIENT',

      hireDate: entitlement.employmentStartDate,
      eligibilityDate,
      eligible: true,

      annualPaidLeaveDays,

      balanceAllocation: entitlement.balanceAllocation,

      calendarAllocationPolicy: entitlement.calendarAllocationPolicy,
    });

    const calendarYear = Number.parseInt(entitlement.asOfDate.slice(0, 4), 10);

    const yearStart = `${calendarYear}-01-01`;
    const yearEnd = `${calendarYear}-12-31`;

    const effectiveFrom =
      eligibilityDate > yearStart ? eligibilityDate : yearStart;

    const cycle = await this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient) => {
        await transaction.employeeLeaveEntitlementCycle.upsert({
          where: {
            employeeId_calendarYear: {
              employeeId,
              calendarYear,
            },
          },

          create: {
            employeeId,
            employmentRecordId: entitlement.employmentRecordId,
            calendarYear,
            employeeType,
            employmentStartDate: toUtcDate(entitlement.employmentStartDate),
            eligibilityDate: toUtcDate(eligibilityDate),
            annualEntitlementDays: new Prisma.Decimal(annualPaidLeaveDays),
            effectiveFrom: toUtcDate(effectiveFrom),
            expiresOn: toUtcDate(yearEnd),
            initializationReviewRequired: false,
          },

          update: {},

          select: {
            id: true,
          },
        });

        const savedCycle =
          await transaction.employeeLeaveEntitlementCycle.findUniqueOrThrow({
            where: {
              employeeId_calendarYear: {
                employeeId,
                calendarYear,
              },
            },

            select: {
              id: true,
              employeeId: true,
              employmentRecordId: true,
              calendarYear: true,
              employeeType: true,
              employmentStartDate: true,
              eligibilityDate: true,
              annualEntitlementDays: true,
              effectiveFrom: true,
              expiresOn: true,
              initializationReviewRequired: true,
              createdAt: true,
              updatedAt: true,
            },
          });

        for (const allocation of allocationPlan) {
          const createdAccount =
            await transaction.employeeLeaveAccount.createMany({
              data: {
                employeeId,
                leaveTypeId: null,
                entitlementCycleId: savedCycle.id,
                balanceKind: allocation.balanceKind,
                currentBalance: new Prisma.Decimal(allocation.initialDays),
              },

              skipDuplicates: true,
            });

          const leaveAccount =
            await transaction.employeeLeaveAccount.findUniqueOrThrow({
              where: {
                entitlementCycleId_balanceKind: {
                  entitlementCycleId: savedCycle.id,
                  balanceKind: allocation.balanceKind,
                },
              },

              select: {
                id: true,
              },
            });

          if (createdAccount.count === 1) {
            await transaction.leaveTransaction.create({
              data: {
                leaveAccountId: leaveAccount.id,

                type: LeaveTransactionType.INITIAL_ALLOCATION,

                quantity: new Prisma.Decimal(allocation.initialDays),

                effectiveDate: savedCycle.effectiveFrom,

                referenceType: 'LEAVE_ENTITLEMENT_CYCLE',
                referenceId: savedCycle.id,

                notes:
                  `${savedCycle.calendarYear} ${allocation.balanceKind} ` +
                  'annual leave entitlement allocation.',

                createdByUserId: actorUserId,
              },
            });
          }
        }

        return savedCycle;
      },
    );

    return {
      status: 'CYCLE_READY',

      entitlement,

      cycle: {
        id: cycle.id,

        employeeId: cycle.employeeId,
        employmentRecordId: cycle.employmentRecordId,

        calendarYear: cycle.calendarYear,

        employeeType: cycle.employeeType,

        employmentStartDate: toDateOnly(cycle.employmentStartDate),
        eligibilityDate: toDateOnly(cycle.eligibilityDate),

        annualEntitlementDays: cycle.annualEntitlementDays.toString(),

        effectiveFrom: toDateOnly(cycle.effectiveFrom),
        expiresOn: toDateOnly(cycle.expiresOn),

        initializationReviewRequired: cycle.initializationReviewRequired,

        createdAt: cycle.createdAt,
        updatedAt: cycle.updatedAt,
      },
    };
  }

  async initializeAnnualCycle(
    employeeId: string,
    asOfDate: string,
    actorUserId: string,
  ): Promise<EmployeeLeaveEntitlementCycleEnsureResult> {
    const entitlement = await this.entitlementService.getLeaveEntitlement(
      employeeId,
      asOfDate,
    );

    if (entitlement.eligibilityStatus === 'CLASSIFICATION_REQUIRED') {
      return {
        status: 'CLASSIFICATION_REQUIRED',
        entitlement,
        cycle: null,
      };
    }

    if (!entitlement.eligible) {
      return {
        status: 'NOT_YET_ELIGIBLE',
        entitlement,
        cycle: null,
      };
    }

    if (
      !entitlement.employeeType ||
      !entitlement.eligibilityDate ||
      entitlement.annualPaidLeaveDays === null
    ) {
      throw new Error(
        'Eligible leave entitlement is missing required classification data.',
      );
    }

    const employeeType = entitlement.employeeType;
    const eligibilityDate = entitlement.eligibilityDate;
    const annualPaidLeaveDays = entitlement.annualPaidLeaveDays;

    if (
      !entitlement.balanceAllocation ||
      !entitlement.calendarAllocationPolicy
    ) {
      throw new Error(
        'Eligible leave entitlement is missing required allocation data.',
      );
    }

    const allocationPlan = planAnnualLeaveAccountAllocations({
      employmentGroup:
        employeeType === EmployeeType.LACOM_INTERNAL ? 'INTERNAL' : 'CLIENT',

      hireDate: entitlement.employmentStartDate,
      eligibilityDate,
      eligible: true,

      annualPaidLeaveDays,

      balanceAllocation: entitlement.balanceAllocation,

      calendarAllocationPolicy: entitlement.calendarAllocationPolicy,
    });

    const calendarYear = Number.parseInt(entitlement.asOfDate.slice(0, 4), 10);

    const yearStart = `${calendarYear}-01-01`;
    const yearEnd = `${calendarYear}-12-31`;

    const effectiveFrom =
      eligibilityDate > yearStart ? eligibilityDate : yearStart;

    const cycle = await this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient) => {
        await transaction.employeeLeaveEntitlementCycle.upsert({
          where: {
            employeeId_calendarYear: {
              employeeId,
              calendarYear,
            },
          },

          create: {
            employeeId,
            employmentRecordId: entitlement.employmentRecordId,
            calendarYear,
            employeeType: employeeType,
            employmentStartDate: toUtcDate(entitlement.employmentStartDate),
            eligibilityDate: toUtcDate(eligibilityDate),
            annualEntitlementDays: new Prisma.Decimal(annualPaidLeaveDays),
            effectiveFrom: toUtcDate(effectiveFrom),
            expiresOn: toUtcDate(yearEnd),
            initializationReviewRequired: false,
          },

          update: {},

          select: {
            id: true,
          },
        });

        const cycleBeforeInitialization =
          await transaction.employeeLeaveEntitlementCycle.findUniqueOrThrow({
            where: {
              employeeId_calendarYear: {
                employeeId,
                calendarYear,
              },
            },

            select: {
              id: true,
              employeeId: true,
              employmentRecordId: true,
              calendarYear: true,
              employeeType: true,
              employmentStartDate: true,
              eligibilityDate: true,
              annualEntitlementDays: true,
              effectiveFrom: true,
              expiresOn: true,
              initializationReviewRequired: true,
              createdAt: true,
              updatedAt: true,
            },
          });

        let createdAnnualAccountCount = 0;

        for (const allocation of allocationPlan) {
          const createdAccount =
            await transaction.employeeLeaveAccount.createMany({
              data: {
                employeeId,
                leaveTypeId: null,
                entitlementCycleId: cycleBeforeInitialization.id,
                balanceKind: allocation.balanceKind,
                currentBalance: new Prisma.Decimal(allocation.initialDays),
              },

              skipDuplicates: true,
            });

          createdAnnualAccountCount += createdAccount.count;

          const leaveAccount =
            await transaction.employeeLeaveAccount.findUniqueOrThrow({
              where: {
                entitlementCycleId_balanceKind: {
                  entitlementCycleId: cycleBeforeInitialization.id,
                  balanceKind: allocation.balanceKind,
                },
              },

              select: {
                id: true,
              },
            });

          if (createdAccount.count === 1) {
            await transaction.leaveTransaction.create({
              data: {
                leaveAccountId: leaveAccount.id,

                type: LeaveTransactionType.INITIAL_ALLOCATION,

                quantity: new Prisma.Decimal(allocation.initialDays),

                effectiveDate: cycleBeforeInitialization.effectiveFrom,

                referenceType: 'LEAVE_ENTITLEMENT_CYCLE',
                referenceId: cycleBeforeInitialization.id,

                notes:
                  `${cycleBeforeInitialization.calendarYear} ${allocation.balanceKind} ` +
                  'annual leave entitlement allocation.',

                createdByUserId: actorUserId,
              },
            });
          }
        }

        const initializationTransition =
          createdAnnualAccountCount > 0
            ? await transaction.employeeLeaveEntitlementCycle.updateMany({
                where: {
                  employeeId,
                  calendarYear,
                  initializationReviewRequired: false,
                },

                data: {
                  initializationReviewRequired: true,
                },
              })
            : {
                count: 0,
              };

        const savedCycle =
          initializationTransition.count === 1
            ? await transaction.employeeLeaveEntitlementCycle.findUniqueOrThrow(
                {
                  where: {
                    employeeId_calendarYear: {
                      employeeId,
                      calendarYear,
                    },
                  },

                  select: {
                    id: true,
                    employeeId: true,
                    employmentRecordId: true,
                    calendarYear: true,
                    employeeType: true,
                    employmentStartDate: true,
                    eligibilityDate: true,
                    annualEntitlementDays: true,
                    effectiveFrom: true,
                    expiresOn: true,
                    initializationReviewRequired: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
              )
            : cycleBeforeInitialization;

        if (initializationTransition.count === 1) {
          const employmentRecord =
            await transaction.employmentRecord.findUniqueOrThrow({
              where: {
                id: entitlement.employmentRecordId,
              },

              select: {
                companyId: true,
              },
            });

          await this.auditLog.recordSuccessInTransaction(transaction, {
            actorUserId,

            companyId: employmentRecord.companyId,

            action: EmployeeManagementAuditAction.LEAVE_ENTITLEMENT_INITIALIZED,

            module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

            entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

            entityId: employeeId,

            reference: entitlement.employeeNumber,

            details:
              `Initialized ${calendarYear} leave entitlement cycle for ` +
              `employee ${entitlement.employeeNumber} and marked it for review.`,

            metadata: {
              leaveEntitlementCycleId: savedCycle.id,
              employmentRecordId: entitlement.employmentRecordId,
              calendarYear,
              employeeType: employeeType,
              employmentStartDate: entitlement.employmentStartDate,
              eligibilityDate: eligibilityDate,
              annualEntitlementDays: annualPaidLeaveDays,
              effectiveFrom,
              expiresOn: yearEnd,
              initializationReviewRequired: true,
            },
          });
        }

        return savedCycle;
      },
    );

    return {
      status: 'CYCLE_READY',

      entitlement,

      cycle: {
        id: cycle.id,

        employeeId: cycle.employeeId,
        employmentRecordId: cycle.employmentRecordId,

        calendarYear: cycle.calendarYear,

        employeeType: cycle.employeeType,

        employmentStartDate: toDateOnly(cycle.employmentStartDate),
        eligibilityDate: toDateOnly(cycle.eligibilityDate),

        annualEntitlementDays: cycle.annualEntitlementDays.toString(),

        effectiveFrom: toDateOnly(cycle.effectiveFrom),
        expiresOn: toDateOnly(cycle.expiresOn),

        initializationReviewRequired: cycle.initializationReviewRequired,

        createdAt: cycle.createdAt,
        updatedAt: cycle.updatedAt,
      },
    };
  }

  async completeInitializationReview(
    employeeId: string,
    asOfDate: string,
    actorUserId: string,
  ): Promise<EmployeeLeaveEntitlementCycleView> {
    const calendarYear = Number.parseInt(asOfDate.slice(0, 4), 10);

    const cycle = await this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient) => {
        const existingCycle =
          await transaction.employeeLeaveEntitlementCycle.findUnique({
            where: {
              employeeId_calendarYear: {
                employeeId,
                calendarYear,
              },
            },

            select: {
              id: true,
              employeeId: true,
              employmentRecordId: true,
              calendarYear: true,
              employeeType: true,
              employmentStartDate: true,
              eligibilityDate: true,
              annualEntitlementDays: true,
              effectiveFrom: true,
              expiresOn: true,
              initializationReviewRequired: true,
              createdAt: true,
              updatedAt: true,
            },
          });

        if (!existingCycle) {
          throw new BadRequestException(
            `Employee does not have an initialized ${calendarYear} leave entitlement.`,
          );
        }

        if (!existingCycle.initializationReviewRequired) {
          return existingCycle;
        }

        const reviewTransition =
          await transaction.employeeLeaveEntitlementCycle.updateMany({
            where: {
              id: existingCycle.id,
              initializationReviewRequired: true,
            },

            data: {
              initializationReviewRequired: false,
            },
          });

        const savedCycle =
          await transaction.employeeLeaveEntitlementCycle.findUniqueOrThrow({
            where: {
              id: existingCycle.id,
            },

            select: {
              id: true,
              employeeId: true,
              employmentRecordId: true,
              calendarYear: true,
              employeeType: true,
              employmentStartDate: true,
              eligibilityDate: true,
              annualEntitlementDays: true,
              effectiveFrom: true,
              expiresOn: true,
              initializationReviewRequired: true,
              createdAt: true,
              updatedAt: true,
            },
          });

        if (reviewTransition.count === 1) {
          const employmentRecord =
            await transaction.employmentRecord.findUniqueOrThrow({
              where: {
                id: savedCycle.employmentRecordId,
              },

              select: {
                companyId: true,
              },
            });

          const employee = await transaction.employee.findUniqueOrThrow({
            where: {
              id: employeeId,
            },

            select: {
              employeeNumber: true,
            },
          });

          await this.auditLog.recordSuccessInTransaction(transaction, {
            actorUserId,

            companyId: employmentRecord.companyId,

            action:
              EmployeeManagementAuditAction.LEAVE_ENTITLEMENT_REVIEW_COMPLETED,

            module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

            entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

            entityId: employeeId,

            reference: employee.employeeNumber,

            details:
              `Completed ${calendarYear} leave entitlement initialization ` +
              `review for employee ${employee.employeeNumber}.`,

            metadata: {
              leaveEntitlementCycleId: savedCycle.id,
              employmentRecordId: savedCycle.employmentRecordId,
              calendarYear: savedCycle.calendarYear,
              employeeType: savedCycle.employeeType,
              initializationReviewRequired: false,
            },
          });
        }

        return savedCycle;
      },
    );

    return {
      id: cycle.id,

      employeeId: cycle.employeeId,
      employmentRecordId: cycle.employmentRecordId,

      calendarYear: cycle.calendarYear,

      employeeType: cycle.employeeType,

      employmentStartDate: toDateOnly(cycle.employmentStartDate),
      eligibilityDate: toDateOnly(cycle.eligibilityDate),

      annualEntitlementDays: cycle.annualEntitlementDays.toString(),

      effectiveFrom: toDateOnly(cycle.effectiveFrom),
      expiresOn: toDateOnly(cycle.expiresOn),

      initializationReviewRequired: cycle.initializationReviewRequired,

      createdAt: cycle.createdAt,
      updatedAt: cycle.updatedAt,
    };
  }
}
