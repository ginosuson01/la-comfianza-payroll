import { Injectable } from '@nestjs/common';
import { AuditOutcome } from '@payroll/database';
import type { Prisma } from '@payroll/database';

import { PrismaService } from '../database/prisma.service';

export interface RecordSuccessfulAuditInput {
  actorUserId: string;
  companyId?: string;

  action: string;
  module: string;

  entityType: string;
  entityId?: string;

  reference?: string;
  details: string;

  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async recordSuccess(input: RecordSuccessfulAuditInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: this.toCreateData(input),
    });
  }

  async recordSuccessInTransaction(
    transaction: Prisma.TransactionClient,
    input: RecordSuccessfulAuditInput,
  ): Promise<void> {
    await transaction.auditLog.create({
      data: this.toCreateData(input),
    });
  }

  private toCreateData(
    input: RecordSuccessfulAuditInput,
  ): Prisma.AuditLogUncheckedCreateInput {
    return {
      actorUserId: input.actorUserId,

      ...(input.companyId
        ? {
            companyId: input.companyId,
          }
        : {}),

      action: input.action,
      module: input.module,

      entityType: input.entityType,

      ...(input.entityId
        ? {
            entityId: input.entityId,
          }
        : {}),

      ...(input.reference
        ? {
            reference: input.reference,
          }
        : {}),

      details: input.details,

      ...(input.metadata
        ? {
            metadata: input.metadata,
          }
        : {}),

      outcome: AuditOutcome.SUCCESS,
    };
  }
}
