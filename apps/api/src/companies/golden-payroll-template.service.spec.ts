import { NotFoundException } from '@nestjs/common';
import { ConfigStatus } from '@payroll/database';

import { GoldenPayrollTemplateService } from './golden-payroll-template.service';
import { createValidGoldenPayrollTemplateConfig } from './golden-payroll-template.test-fixture';

describe('GoldenPayrollTemplateService', () => {
  const findFirst = jest.fn();

  const prisma = {
    payrollTemplateVersion: {
      findFirst,
    },
  };

  const service = new GoldenPayrollTemplateService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves the active PH_STANDARD_PAYROLL version effective on the requested date', async () => {
    const effectiveDate = new Date('2026-10-14T00:00:00.000Z');

    findFirst.mockResolvedValue({
      id: 'template-version-1',
      payrollTemplateId: 'template-1',
      version: 1,
      name: 'Initial Philippine Statutory Rules',
      status: ConfigStatus.ACTIVE,
      effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
      effectiveTo: null,
      config: createValidGoldenPayrollTemplateConfig(),

      createdAt: new Date('2026-10-14T00:00:00.000Z'),
      payrollTemplate: {
        code: 'PH_STANDARD_PAYROLL',
        name: 'Philippine Standard Payroll',
      },
    });

    const result =
      await service.getActiveVersionForDate(effectiveDate);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ConfigStatus.ACTIVE,
          payrollTemplate: {
            is: {
              code: 'PH_STANDARD_PAYROLL',
              status: ConfigStatus.ACTIVE,
            },
          },
        }),
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'template-version-1',
        payrollTemplateId: 'template-1',
        templateCode: 'PH_STANDARD_PAYROLL',
        templateName: 'Philippine Standard Payroll',
        version: 1,
        versionName: 'Initial Philippine Statutory Rules',
        status: ConfigStatus.ACTIVE,
      }),
    );
  });

  it('rejects when no active Golden version is effective for the requested date', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      service.getActiveVersionForDate(
        new Date('2026-10-14T00:00:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an invalid effective date before querying the database', async () => {
    await expect(
      service.getActiveVersionForDate(new Date('invalid')),
    ).rejects.toThrow(
      'Golden payroll template effective date must be a valid date.',
    );

    expect(findFirst).not.toHaveBeenCalled();
  });
});
