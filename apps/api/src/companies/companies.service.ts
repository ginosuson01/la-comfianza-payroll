import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanyStatus } from '@payroll/database';
import type { Prisma } from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import {
  COMPANY_MANAGEMENT_AUDIT_MODULE,
  COMPANY_MANAGEMENT_ENTITY_TYPE,
  CompanyManagementAuditAction,
} from './company-management-audit.constants';
import type { CreateCompanyDto } from './dto/create-company.dto';
import type { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import type { UpdateCompanyDto } from './dto/update-company.dto';

const COMPANY_SELECT = {
  id: true,
  code: true,
  name: true,

  addressLine1: true,
  addressLine2: true,
  barangay: true,
  city: true,
  province: true,
  postalCode: true,
  country: true,

  contactName: true,
  contactEmail: true,
  contactPhone: true,

  status: true,

  createdAt: true,
  updatedAt: true,
} as const;

export interface CompanyView {
  id: string;
  code: string;
  name: string;

  addressLine1: string | null;
  addressLine2: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;

  formattedAddress: string;

  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;

  status: CompanyStatus;

  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyListResponse {
  items: CompanyView[];

  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface CompanyRecord {
  id: string;
  code: string;
  name: string;

  addressLine1: string | null;
  addressLine2: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;

  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;

  status: CompanyStatus;

  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly auditLog: AuditLogService,
  ) {}

  async listCompanies(
    query: ListCompaniesQueryDto,
  ): Promise<CompanyListResponse> {
    const page = query.page;

    const pageSize = query.pageSize;

    const search = query.search?.trim();

    const where: Prisma.CompanyWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (search) {
      where.OR = [
        {
          code: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          addressLine1: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          addressLine2: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          barangay: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          city: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          province: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          postalCode: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          contactName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          contactEmail: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          contactPhone: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [total, companies] = await this.prisma.$transaction([
      this.prisma.company.count({
        where,
      }),

      this.prisma.company.findMany({
        where,

        select: COMPANY_SELECT,

        orderBy: [
          {
            name: 'asc',
          },
          {
            code: 'asc',
          },
        ],

        skip: (page - 1) * pageSize,

        take: pageSize,
      }),
    ]);

    return {
      items: companies.map((company) => this.toCompanyView(company)),

      pagination: {
        page,
        pageSize,
        total,

        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async createCompany(
    input: CreateCompanyDto,
    actorUserId: string,
  ): Promise<CompanyView> {
    const existingCompany = await this.prisma.company.findUnique({
      where: {
        code: input.code,
      },

      select: {
        id: true,
      },
    });

    if (existingCompany) {
      throw new ConflictException('Company code already exists.');
    }

    try {
      const company = await this.prisma.$transaction(async (transaction) => {
        const createdCompany = await transaction.company.create({
          data: {
            code: input.code,

            name: input.name,

            addressLine1: input.addressLine1 ?? null,

            addressLine2: input.addressLine2 ?? null,

            barangay: input.barangay ?? null,

            city: input.city ?? null,

            province: input.province ?? null,

            postalCode: input.postalCode ?? null,

            country: input.country ?? 'Philippines',

            contactName: input.contactName ?? null,

            contactEmail: input.contactEmail ?? null,

            contactPhone: input.contactPhone ?? null,

            status: CompanyStatus.ACTIVE,
          },

          select: COMPANY_SELECT,
        });

        await this.auditLog.recordSuccessInTransaction(transaction, {
          actorUserId,

          companyId: createdCompany.id,

          action: CompanyManagementAuditAction.CREATED,

          module: COMPANY_MANAGEMENT_AUDIT_MODULE,

          entityType: COMPANY_MANAGEMENT_ENTITY_TYPE,

          entityId: createdCompany.id,

          reference: createdCompany.code,

          details: `Created company ${createdCompany.name} (${createdCompany.code}).`,

          metadata: {
            code: createdCompany.code,

            name: createdCompany.name,

            status: createdCompany.status,
          },
        });

        return createdCompany;
      });

      return this.toCompanyView(company);
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Company code already exists.');
      }

      throw error;
    }
  }

  async updateCompany(
    companyId: string,
    input: UpdateCompanyDto,
    actorUserId: string,
  ): Promise<CompanyView> {
    const hasProvidedField = [
      input.name,
      input.addressLine1,
      input.addressLine2,
      input.barangay,
      input.city,
      input.province,
      input.postalCode,
      input.country,
      input.contactName,
      input.contactEmail,
      input.contactPhone,
    ].some((value) => value !== undefined);

    if (!hasProvidedField) {
      throw new BadRequestException(
        'At least one company field must be provided.',
      );
    }

    const currentCompany = await this.prisma.company.findUnique({
      where: {
        id: companyId,
      },

      select: COMPANY_SELECT,
    });

    if (!currentCompany) {
      throw new NotFoundException('Company was not found.');
    }

    const hasChanges =
      (input.name !== undefined && input.name !== currentCompany.name) ||
      (input.addressLine1 !== undefined &&
        input.addressLine1 !== currentCompany.addressLine1) ||
      (input.addressLine2 !== undefined &&
        input.addressLine2 !== currentCompany.addressLine2) ||
      (input.barangay !== undefined &&
        input.barangay !== currentCompany.barangay) ||
      (input.city !== undefined && input.city !== currentCompany.city) ||
      (input.province !== undefined &&
        input.province !== currentCompany.province) ||
      (input.postalCode !== undefined &&
        input.postalCode !== currentCompany.postalCode) ||
      (input.country !== undefined &&
        input.country !== currentCompany.country) ||
      (input.contactName !== undefined &&
        input.contactName !== currentCompany.contactName) ||
      (input.contactEmail !== undefined &&
        input.contactEmail !== currentCompany.contactEmail) ||
      (input.contactPhone !== undefined &&
        input.contactPhone !== currentCompany.contactPhone);

    if (!hasChanges) {
      return this.toCompanyView(currentCompany);
    }

    const data: Prisma.CompanyUpdateInput = {};

    if (input.name !== undefined) {
      data.name = input.name;
    }

    if (input.addressLine1 !== undefined) {
      data.addressLine1 = input.addressLine1;
    }

    if (input.addressLine2 !== undefined) {
      data.addressLine2 = input.addressLine2;
    }

    if (input.barangay !== undefined) {
      data.barangay = input.barangay;
    }

    if (input.city !== undefined) {
      data.city = input.city;
    }

    if (input.province !== undefined) {
      data.province = input.province;
    }

    if (input.postalCode !== undefined) {
      data.postalCode = input.postalCode;
    }

    if (input.country !== undefined) {
      data.country = input.country;
    }

    if (input.contactName !== undefined) {
      data.contactName = input.contactName;
    }

    if (input.contactEmail !== undefined) {
      data.contactEmail = input.contactEmail;
    }

    if (input.contactPhone !== undefined) {
      data.contactPhone = input.contactPhone;
    }

    const changedFields = Object.keys(data);

    const updatedCompany = await this.prisma.$transaction(
      async (transaction) => {
        const updated = await transaction.company.update({
          where: {
            id: companyId,
          },

          data,

          select: COMPANY_SELECT,
        });

        await this.auditLog.recordSuccessInTransaction(transaction, {
          actorUserId,

          companyId,

          action: CompanyManagementAuditAction.UPDATED,

          module: COMPANY_MANAGEMENT_AUDIT_MODULE,

          entityType: COMPANY_MANAGEMENT_ENTITY_TYPE,

          entityId: companyId,

          reference: currentCompany.code,

          details: `Updated company profile ${currentCompany.name} (${currentCompany.code}).`,

          metadata: {
            changedFields,

            previousValues: this.toCompanyProfileMetadata(currentCompany),

            newValues: this.toCompanyProfileMetadata(updated),
          },
        });

        return updated;
      },
    );

    return this.toCompanyView(updatedCompany);
  }

  async updateCompanyStatus(
    companyId: string,
    requestedStatus: CompanyStatus,
    actorUserId: string,
  ): Promise<CompanyView> {
    const company = await this.prisma.company.findUnique({
      where: {
        id: companyId,
      },

      select: COMPANY_SELECT,
    });

    if (!company) {
      throw new NotFoundException('Company was not found.');
    }

    if (company.status === requestedStatus) {
      return this.toCompanyView(company);
    }

    const previousStatus = company.status;

    const updatedCompany = await this.prisma.$transaction(
      async (transaction) => {
        const updated = await transaction.company.update({
          where: {
            id: companyId,
          },

          data: {
            status: requestedStatus,
          },

          select: COMPANY_SELECT,
        });

        await this.auditLog.recordSuccessInTransaction(transaction, {
          actorUserId,

          companyId,

          action: CompanyManagementAuditAction.STATUS_CHANGED,

          module: COMPANY_MANAGEMENT_AUDIT_MODULE,

          entityType: COMPANY_MANAGEMENT_ENTITY_TYPE,

          entityId: companyId,

          reference: company.code,

          details: `Changed company ${company.name} status from ${previousStatus} to ${requestedStatus}.`,

          metadata: {
            previousStatus,

            newStatus: requestedStatus,
          },
        });

        return updated;
      },
    );

    return this.toCompanyView(updatedCompany);
  }

  async getCompanyById(companyId: string): Promise<CompanyView> {
    const company = await this.prisma.company.findUnique({
      where: {
        id: companyId,
      },

      select: COMPANY_SELECT,
    });

    if (!company) {
      throw new NotFoundException('Company was not found.');
    }

    return this.toCompanyView(company);
  }

  private toCompanyView(company: CompanyRecord): CompanyView {
    return {
      ...company,

      formattedAddress: this.formatAddress(company),
    };
  }

  private toCompanyProfileMetadata(
    company: CompanyRecord,
  ): Record<string, string | null> {
    return {
      name: company.name,

      addressLine1: company.addressLine1,

      addressLine2: company.addressLine2,

      barangay: company.barangay,

      city: company.city,

      province: company.province,

      postalCode: company.postalCode,

      country: company.country,

      contactName: company.contactName,

      contactEmail: company.contactEmail,

      contactPhone: company.contactPhone,
    };
  }

  private formatAddress(company: CompanyRecord): string {
    const addressParts = [
      company.addressLine1,
      company.addressLine2,
      company.barangay,
      company.city,
      company.province,
      company.postalCode,
    ].filter((value): value is string => Boolean(value?.trim()));

    if (addressParts.length === 0) {
      return '';
    }

    return [...addressParts, company.country]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(', ');
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (
      (
        error as {
          code?: unknown;
        }
      ).code === 'P2002'
    );
  }
}
