import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigStatus } from '@payroll/database';

import { PrismaService } from '../database/prisma.service';
import { validateGoldenPayrollTemplateConfig } from './golden-payroll-template-config.validator';
import type { GoldenPayrollTemplateConfig } from './golden-payroll-template.types';

export const GOLDEN_PAYROLL_TEMPLATE_CODE =
  'PH_STANDARD_PAYROLL';

export interface GoldenPayrollTemplateVersionView {
  id: string;

  payrollTemplateId: string;

  templateCode: string;
  templateName: string;

  version: number;
  versionName: string | null;

  status: ConfigStatus;

  effectiveFrom: Date | null;
  effectiveTo: Date | null;

  config: GoldenPayrollTemplateConfig;

  createdAt: Date;
}

@Injectable()
export class GoldenPayrollTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveVersionForDate(
    effectiveDate: Date,
  ): Promise<GoldenPayrollTemplateVersionView> {
    if (Number.isNaN(effectiveDate.getTime())) {
      throw new Error(
        'Golden payroll template effective date must be a valid date.',
      );
    }

    const version =
      await this.prisma.payrollTemplateVersion.findFirst({
        where: {
          status: ConfigStatus.ACTIVE,

          payrollTemplate: {
            is: {
              code: GOLDEN_PAYROLL_TEMPLATE_CODE,
              status: ConfigStatus.ACTIVE,
            },
          },

          AND: [
            {
              OR: [
                {
                  effectiveFrom: null,
                },
                {
                  effectiveFrom: {
                    lte: effectiveDate,
                  },
                },
              ],
            },

            {
              OR: [
                {
                  effectiveTo: null,
                },
                {
                  effectiveTo: {
                    gte: effectiveDate,
                  },
                },
              ],
            },
          ],
        },

        orderBy: [
          {
            effectiveFrom: {
              sort: 'desc',
              nulls: 'last',
            },
          },
          {
            version: 'desc',
          },
        ],

        select: {
          id: true,

          payrollTemplateId: true,

          version: true,
          name: true,

          status: true,

          effectiveFrom: true,
          effectiveTo: true,

          config: true,

          createdAt: true,

          payrollTemplate: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      });

    if (!version) {
      throw new NotFoundException(
        `No active ${GOLDEN_PAYROLL_TEMPLATE_CODE} Golden Payroll Template version is effective for ${effectiveDate
          .toISOString()
          .slice(0, 10)}.`,
      );
    }

    return {
      id: version.id,

      payrollTemplateId: version.payrollTemplateId,

      templateCode: version.payrollTemplate.code,
      templateName: version.payrollTemplate.name,

      version: version.version,
      versionName: version.name,

      status: version.status,

      effectiveFrom: version.effectiveFrom,
      effectiveTo: version.effectiveTo,

      config: validateGoldenPayrollTemplateConfig(
        version.config,
      ),

      createdAt: version.createdAt,
    };
  }
}
