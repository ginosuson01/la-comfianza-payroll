import { AuditOutcome } from '@payroll/database';

import type { PrismaService } from '../database/prisma.service';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  it('records a successful business action', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'audit-id',
    });

    const prisma = {
      auditLog: {
        create,
      },
    } as unknown as PrismaService;

    const service = new AuditLogService(prisma);

    await service.recordSuccess({
      actorUserId: '11111111-1111-4111-8111-111111111111',

      action: 'USER_STATUS_CHANGED',

      module: 'USER_MANAGEMENT',

      entityType: 'User',

      entityId: '22222222-2222-4222-8222-222222222222',

      reference: 'jsantos',

      details: 'Changed user status.',

      metadata: {
        previousStatus: 'PENDING_ASSIGNMENT',

        newStatus: 'ACTIVE',
      },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        actorUserId: '11111111-1111-4111-8111-111111111111',

        action: 'USER_STATUS_CHANGED',

        module: 'USER_MANAGEMENT',

        entityType: 'User',

        entityId: '22222222-2222-4222-8222-222222222222',

        reference: 'jsantos',

        details: 'Changed user status.',

        metadata: {
          previousStatus: 'PENDING_ASSIGNMENT',

          newStatus: 'ACTIVE',
        },

        outcome: AuditOutcome.SUCCESS,
      },
    });
  });
});
