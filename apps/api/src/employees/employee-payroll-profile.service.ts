import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayoutMethod, type Prisma } from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import { FieldEncryptionService } from '../security/field-encryption.service';
import type { SetEmployeePayrollProfileDto } from './dto/set-employee-payroll-profile.dto';
import {
  EMPLOYEE_MANAGEMENT_AUDIT_MODULE,
  EMPLOYEE_MANAGEMENT_ENTITY_TYPE,
  EmployeeManagementAuditAction,
} from './employee-management-audit.constants';

export interface EmployeePayrollProfileView {
  id: string;

  employmentRecordId: string;

  payoutMethod: PayoutMethod;

  bankName: string | null;

  accountNumberLast4: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeePayrollAccountRevealView {
  accountNumber: string;
  accountNumberLast4: string;
}

@Injectable()
export class EmployeePayrollProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly fieldEncryption: FieldEncryptionService,
  ) {}

  async getPayrollProfile(
    employeeId: string,
  ): Promise<EmployeePayrollProfileView | null> {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      select: {
        employmentRecords: {
          where: {
            endDate: null,
          },

          orderBy: {
            startDate: 'desc',
          },

          take: 1,

          select: {
            id: true,

            payrollProfile: {
              select: {
                id: true,

                employmentRecordId: true,

                payoutMethod: true,

                bankName: true,

                accountNumberLast4: true,

                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const currentEmployment = employee.employmentRecords[0];

    if (!currentEmployment) {
      throw new NotFoundException('Current employment assignment not found.');
    }

    return currentEmployment.payrollProfile ?? null;
  }

  async revealPayrollAccount(
    employeeId: string,
    actorUserId: string,
  ): Promise<EmployeePayrollAccountRevealView> {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      select: {
        id: true,
        employeeNumber: true,

        firstName: true,
        lastName: true,

        employmentRecords: {
          where: {
            endDate: null,
          },

          orderBy: {
            startDate: 'desc',
          },

          take: 1,

          select: {
            id: true,

            company: {
              select: {
                id: true,
              },
            },

            payrollProfile: {
              select: {
                id: true,

                payoutMethod: true,

                accountNumberEncrypted: true,
                accountNumberLast4: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const currentEmployment = employee.employmentRecords[0];

    if (!currentEmployment) {
      throw new NotFoundException('Current employment assignment not found.');
    }

    const profile = currentEmployment.payrollProfile;

    if (
      !profile ||
      profile.payoutMethod !== PayoutMethod.ATM ||
      !profile.accountNumberEncrypted ||
      !profile.accountNumberLast4
    ) {
      throw new BadRequestException(
        'ATM account is not configured for this employee.',
      );
    }

    const accountNumber = this.fieldEncryption.decrypt(
      profile.accountNumberEncrypted,
    );

    await this.auditLog.recordSuccess({
      actorUserId,

      companyId: currentEmployment.company.id,

      action: EmployeeManagementAuditAction.PAYROLL_ACCOUNT_REVEALED,

      module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

      entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

      entityId: employee.id,

      reference: employee.employeeNumber,

      details: `Revealed stored ATM account number for ${employee.firstName} ${employee.lastName} (${employee.employeeNumber}).`,

      metadata: {
        employmentRecordId: currentEmployment.id,

        payrollProfileId: profile.id,

        accountNumberLast4: profile.accountNumberLast4,
      },
    });

    return {
      accountNumber,
      accountNumberLast4: profile.accountNumberLast4,
    };
  }

  async setPayrollProfile(
    employeeId: string,
    input: SetEmployeePayrollProfileDto,
    actorUserId: string,
  ): Promise<EmployeePayrollProfileView> {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      select: {
        id: true,
        employeeNumber: true,

        firstName: true,
        lastName: true,

        employmentRecords: {
          where: {
            endDate: null,
          },

          orderBy: {
            startDate: 'desc',
          },

          take: 1,

          select: {
            id: true,

            company: {
              select: {
                id: true,
              },
            },

            payrollProfile: {
              select: {
                id: true,

                payoutMethod: true,

                bankName: true,

                accountNumberEncrypted: true,
                accountNumberLast4: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const currentEmployment = employee.employmentRecords[0];

    if (!currentEmployment) {
      throw new NotFoundException('Current employment assignment not found.');
    }

    const existingProfile = currentEmployment.payrollProfile;

    let bankName: string | null = null;

    let accountNumberEncrypted: string | null = null;

    let accountNumberLast4: string | null = null;

    if (input.payoutMethod === PayoutMethod.ATM) {
      bankName = input.bankName ?? existingProfile?.bankName ?? null;

      if (!bankName) {
        throw new BadRequestException('Bank name is required for ATM payout.');
      }

      if (input.accountNumber) {
        accountNumberEncrypted = this.fieldEncryption.encrypt(
          input.accountNumber,
        );

        accountNumberLast4 = input.accountNumber.slice(-4);
      } else {
        accountNumberEncrypted =
          existingProfile?.accountNumberEncrypted ?? null;

        accountNumberLast4 = existingProfile?.accountNumberLast4 ?? null;
      }

      if (!accountNumberEncrypted || !accountNumberLast4) {
        throw new BadRequestException(
          'Account number is required for ATM payout.',
        );
      }
    }

    const profile = await this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient) => {
        const savedProfile = await transaction.employeePayrollProfile.upsert({
          where: {
            employmentRecordId: currentEmployment.id,
          },

          create: {
            employmentRecordId: currentEmployment.id,

            payoutMethod: input.payoutMethod,

            bankName,

            accountNumberEncrypted,

            accountNumberLast4,
          },

          update: {
            payoutMethod: input.payoutMethod,

            bankName,

            accountNumberEncrypted,

            accountNumberLast4,
          },

          select: {
            id: true,

            employmentRecordId: true,

            payoutMethod: true,

            bankName: true,

            accountNumberLast4: true,

            createdAt: true,
            updatedAt: true,
          },
        });

        await this.auditLog.recordSuccessInTransaction(transaction, {
          actorUserId,

          companyId: currentEmployment.company.id,

          action: EmployeeManagementAuditAction.PAYROLL_PROFILE_UPDATED,

          module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

          entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

          entityId: employee.id,

          reference: employee.employeeNumber,

          details: `Updated payroll payout profile for ${employee.firstName} ${employee.lastName} (${employee.employeeNumber}) to ${input.payoutMethod}.`,

          metadata: {
            employmentRecordId: currentEmployment.id,

            payoutMethod: input.payoutMethod,

            bankName: savedProfile.bankName,

            accountNumberLast4: savedProfile.accountNumberLast4,
          },
        });

        return savedProfile;
      },
    );

    return profile;
  }
}
