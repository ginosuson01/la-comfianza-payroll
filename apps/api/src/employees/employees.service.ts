import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeePayrollStatus,
  type PayoutMethod,
  type Prisma,
} from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import type { ChangeEmploymentAssignmentDto } from './dto/change-employment-assignment.dto';
import type { CreateEmployeeDto } from './dto/create-employee.dto';
import type { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';
import {
  EMPLOYEE_MANAGEMENT_AUDIT_MODULE,
  EMPLOYEE_MANAGEMENT_ENTITY_TYPE,
  EmployeeManagementAuditAction,
} from './employee-management-audit.constants';

const EMPLOYEE_SELECT = {
  id: true,
  employeeNumber: true,

  firstName: true,
  middleName: true,
  lastName: true,
  suffix: true,

  email: true,
  mobile: true,

  addressLine1: true,
  addressLine2: true,
  barangay: true,
  city: true,
  province: true,
  postalCode: true,
  country: true,

  currentStatus: true,

  createdAt: true,
  updatedAt: true,

  employmentRecords: {
    orderBy: {
      startDate: 'desc',
    },

    select: {
      id: true,
      companyEmployeeNumber: true,
      startDate: true,
      endDate: true,

      company: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },

      department: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },

      position: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },

      payrollProfile: {
        select: {
          payoutMethod: true,
        },
      },
    },
  },
} satisfies Prisma.EmployeeSelect;

interface EmploymentSummary {
  id: string;
  companyEmployeeNumber: string | null;

  startDate: Date;
  endDate: Date | null;

  company: {
    id: string;
    code: string;
    name: string;
  };

  department: {
    id: string;
    code: string;
    name: string;
  } | null;

  position: {
    id: string;
    code: string;
    name: string;
  } | null;

  payoutMethod: PayoutMethod | null;
}

export interface EmployeeDirectoryView {
  id: string;
  employeeNumber: string;

  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;

  fullName: string;

  email: string | null;
  mobile: string | null;

  currentStatus: EmployeePayrollStatus;

  currentEmployment: EmploymentSummary | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeListResponse {
  items: EmployeeDirectoryView[];

  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

type EmployeeRecord = Prisma.EmployeeGetPayload<{
  select: typeof EMPLOYEE_SELECT;
}>;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listEmployees(
    query: ListEmployeesQueryDto,
  ): Promise<EmployeeListResponse> {
    const page = query.page;
    const pageSize = query.pageSize;

    const search = query.search?.trim();

    const employmentFilter: Prisma.EmploymentRecordWhereInput = {};

    if (query.companyId) {
      employmentFilter.companyId = query.companyId;
    }

    if (query.departmentId) {
      employmentFilter.departmentId = query.departmentId;
    }

    if (query.positionId) {
      employmentFilter.positionId = query.positionId;
    }

    if (query.payoutMethod) {
      employmentFilter.payrollProfile = {
        is: {
          payoutMethod: query.payoutMethod,
        },
      };
    }

    const where: Prisma.EmployeeWhereInput = {};

    if (query.status) {
      where.currentStatus = query.status;
    }

    if (Object.keys(employmentFilter).length > 0) {
      where.employmentRecords = {
        some: employmentFilter,
      };
    }

    if (search) {
      where.OR = [
        {
          employeeNumber: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          firstName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          middleName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          mobile: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          employmentRecords: {
            some: {
              companyEmployeeNumber: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }

    const [total, employees] = await this.prisma.$transaction([
      this.prisma.employee.count({
        where,
      }),

      this.prisma.employee.findMany({
        where,

        select: EMPLOYEE_SELECT,

        orderBy: [
          {
            lastName: 'asc',
          },
          {
            firstName: 'asc',
          },
        ],

        skip: (page - 1) * pageSize,

        take: pageSize,
      }),
    ]);

    return {
      items: employees.map((employee) => this.toDirectoryView(employee)),

      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async createEmployee(
    input: CreateEmployeeDto,
    actorUserId: string,
  ): Promise<EmployeeDirectoryView> {
    await this.validateEmployeeNumber(input.employeeNumber);

    await this.validateEmploymentAssignmentReferences(
      input.companyId,
      input.departmentId,
      input.positionId,
    );

    if (input.companyEmployeeNumber) {
      await this.validateCompanyEmployeeNumber(
        input.companyId,
        input.companyEmployeeNumber,
      );
    }

    const status = input.status ?? EmployeePayrollStatus.ACTIVE;

    const employmentDate = new Date(input.employmentDate);

    const statusEffectiveDate = new Date(
      input.statusEffectiveDate ?? input.employmentDate,
    );

    try {
      const employee = await this.prisma.$transaction(async (transaction) => {
        const createdEmployee = await transaction.employee.create({
          data: {
            employeeNumber: input.employeeNumber,

            firstName: input.firstName,
            middleName: input.middleName ?? null,
            lastName: input.lastName,
            suffix: input.suffix ?? null,

            email: input.email ?? null,
            mobile: input.mobile ?? null,

            addressLine1: input.addressLine1 ?? null,
            addressLine2: input.addressLine2 ?? null,
            barangay: input.barangay ?? null,
            city: input.city ?? null,
            province: input.province ?? null,
            postalCode: input.postalCode ?? null,
            country: input.country ?? 'Philippines',

            currentStatus: status,
          },

          select: {
            id: true,
            employeeNumber: true,

            firstName: true,
            middleName: true,
            lastName: true,
            suffix: true,
          },
        });

        await transaction.employmentRecord.create({
          data: {
            employeeId: createdEmployee.id,

            companyId: input.companyId,

            departmentId: input.departmentId ?? null,
            positionId: input.positionId ?? null,

            companyEmployeeNumber: input.companyEmployeeNumber ?? null,

            startDate: employmentDate,
          },
        });

        await transaction.employeeStatusHistory.create({
          data: {
            employeeId: createdEmployee.id,

            previousStatus: null,
            newStatus: status,

            effectiveDate: statusEffectiveDate,

            changedByUserId: actorUserId,
          },
        });

        const fullName = [
          createdEmployee.firstName,
          createdEmployee.middleName,
          createdEmployee.lastName,
          createdEmployee.suffix,
        ]
          .filter(Boolean)
          .join(' ');

        await this.auditLog.recordSuccessInTransaction(transaction, {
          actorUserId,

          companyId: input.companyId,

          action: EmployeeManagementAuditAction.CREATED,

          module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

          entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

          entityId: createdEmployee.id,

          reference: createdEmployee.employeeNumber,

          details: `Created employee ${fullName} (${createdEmployee.employeeNumber}).`,

          metadata: {
            employeeNumber: createdEmployee.employeeNumber,
            status,
            companyId: input.companyId,
            employmentDate: input.employmentDate,

            ...(input.companyEmployeeNumber
              ? {
                  companyEmployeeNumber: input.companyEmployeeNumber,
                }
              : {}),

            ...(input.departmentId
              ? {
                  departmentId: input.departmentId,
                }
              : {}),

            ...(input.positionId
              ? {
                  positionId: input.positionId,
                }
              : {}),
          },
        });

        return transaction.employee.findUniqueOrThrow({
          where: {
            id: createdEmployee.id,
          },

          select: EMPLOYEE_SELECT,
        });
      });

      return this.toDirectoryView(employee);
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Employee number or company employee number already exists.',
        );
      }

      throw error;
    }
  }

  async updateEmployee(
    employeeId: string,
    input: UpdateEmployeeDto,
    actorUserId: string,
  ): Promise<EmployeeDirectoryView> {
    const currentEmployee = await this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      select: EMPLOYEE_SELECT,
    });

    if (!currentEmployee) {
      throw new NotFoundException('Employee not found.');
    }

    const data: Prisma.EmployeeUpdateInput = {};

    const changedFields: string[] = [];

    if (
      input.firstName !== undefined &&
      input.firstName !== currentEmployee.firstName
    ) {
      data.firstName = input.firstName;
      changedFields.push('firstName');
    }

    if (
      input.middleName !== undefined &&
      input.middleName !== currentEmployee.middleName
    ) {
      data.middleName = input.middleName;
      changedFields.push('middleName');
    }

    if (
      input.lastName !== undefined &&
      input.lastName !== currentEmployee.lastName
    ) {
      data.lastName = input.lastName;
      changedFields.push('lastName');
    }

    if (input.suffix !== undefined && input.suffix !== currentEmployee.suffix) {
      data.suffix = input.suffix;
      changedFields.push('suffix');
    }

    if (input.email !== undefined && input.email !== currentEmployee.email) {
      data.email = input.email;
      changedFields.push('email');
    }

    if (input.mobile !== undefined && input.mobile !== currentEmployee.mobile) {
      data.mobile = input.mobile;
      changedFields.push('mobile');
    }

    if (
      input.addressLine1 !== undefined &&
      input.addressLine1 !== currentEmployee.addressLine1
    ) {
      data.addressLine1 = input.addressLine1;
      changedFields.push('addressLine1');
    }

    if (
      input.addressLine2 !== undefined &&
      input.addressLine2 !== currentEmployee.addressLine2
    ) {
      data.addressLine2 = input.addressLine2;
      changedFields.push('addressLine2');
    }

    if (
      input.barangay !== undefined &&
      input.barangay !== currentEmployee.barangay
    ) {
      data.barangay = input.barangay;
      changedFields.push('barangay');
    }

    if (input.city !== undefined && input.city !== currentEmployee.city) {
      data.city = input.city;
      changedFields.push('city');
    }

    if (
      input.province !== undefined &&
      input.province !== currentEmployee.province
    ) {
      data.province = input.province;
      changedFields.push('province');
    }

    if (
      input.postalCode !== undefined &&
      input.postalCode !== currentEmployee.postalCode
    ) {
      data.postalCode = input.postalCode;
      changedFields.push('postalCode');
    }

    if (
      input.country !== undefined &&
      input.country !== currentEmployee.country
    ) {
      data.country = input.country;
      changedFields.push('country');
    }

    if (changedFields.length === 0) {
      return this.toDirectoryView(currentEmployee);
    }

    const currentEmployment = this.getCurrentEmployment(currentEmployee);

    const updatedEmployee = await this.prisma.$transaction(
      async (transaction) => {
        const employee = await transaction.employee.update({
          where: {
            id: employeeId,
          },

          data,

          select: EMPLOYEE_SELECT,
        });

        const fullName = [
          employee.firstName,
          employee.middleName,
          employee.lastName,
          employee.suffix,
        ]
          .filter(Boolean)
          .join(' ');

        await this.auditLog.recordSuccessInTransaction(transaction, {
          actorUserId,

          ...(currentEmployment
            ? {
                companyId: currentEmployment.company.id,
              }
            : {}),

          action: EmployeeManagementAuditAction.UPDATED,

          module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

          entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

          entityId: employee.id,

          reference: employee.employeeNumber,

          details: `Updated employee ${fullName} (${employee.employeeNumber}).`,

          metadata: {
            changedFields,
          },
        });

        return employee;
      },
    );

    return this.toDirectoryView(updatedEmployee);
  }

  async changeEmploymentAssignment(
    employeeId: string,
    input: ChangeEmploymentAssignmentDto,
    actorUserId: string,
  ): Promise<EmployeeDirectoryView> {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      select: EMPLOYEE_SELECT,
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const currentEmployment = this.getCurrentEmployment(employee);

    if (!currentEmployment || currentEmployment.endDate !== null) {
      throw new NotFoundException('Current employment assignment not found.');
    }

    const effectiveDate = new Date(input.effectiveDate);

    if (effectiveDate <= currentEmployment.startDate) {
      throw new BadRequestException(
        'Employment change effective date must be after the current employment start date.',
      );
    }

    const companyChanged = input.companyId !== currentEmployment.company.id;

    const departmentId =
      input.departmentId !== undefined
        ? input.departmentId
        : companyChanged
          ? null
          : (currentEmployment.department?.id ?? null);

    const positionId =
      input.positionId !== undefined
        ? input.positionId
        : companyChanged
          ? null
          : (currentEmployment.position?.id ?? null);

    const companyEmployeeNumber =
      input.companyEmployeeNumber !== undefined
        ? input.companyEmployeeNumber
        : companyChanged
          ? null
          : currentEmployment.companyEmployeeNumber;

    await this.validateEmploymentAssignmentReferences(
      input.companyId,
      departmentId,
      positionId,
    );

    if (
      companyEmployeeNumber &&
      (companyChanged ||
        companyEmployeeNumber !== currentEmployment.companyEmployeeNumber)
    ) {
      await this.validateCompanyEmployeeNumber(
        input.companyId,
        companyEmployeeNumber,
        currentEmployment.id,
      );
    }

    const assignmentUnchanged =
      input.companyId === currentEmployment.company.id &&
      departmentId === (currentEmployment.department?.id ?? null) &&
      positionId === (currentEmployment.position?.id ?? null) &&
      companyEmployeeNumber === currentEmployment.companyEmployeeNumber;

    if (assignmentUnchanged) {
      return this.toDirectoryView(employee);
    }

    const updatedEmployee = await this.prisma.$transaction(
      async (transaction) => {
        await transaction.employmentRecord.update({
          where: {
            id: currentEmployment.id,
          },

          data: {
            endDate: effectiveDate,
          },
        });

        const newEmployment = await transaction.employmentRecord.create({
          data: {
            employeeId,

            companyId: input.companyId,

            departmentId,
            positionId,

            companyEmployeeNumber,

            startDate: effectiveDate,
          },

          select: {
            id: true,
          },
        });

        await this.auditLog.recordSuccessInTransaction(transaction, {
          actorUserId,

          companyId: input.companyId,

          action: EmployeeManagementAuditAction.EMPLOYMENT_CHANGED,

          module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

          entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

          entityId: employee.id,

          reference: employee.employeeNumber,

          details: `Changed employment assignment for ${employee.firstName} ${employee.lastName} (${employee.employeeNumber}).`,

          metadata: {
            previousEmploymentRecordId: currentEmployment.id,
            newEmploymentRecordId: newEmployment.id,

            effectiveDate: input.effectiveDate,

            previousCompanyId: currentEmployment.company.id,
            newCompanyId: input.companyId,

            previousDepartmentId: currentEmployment.department?.id ?? null,
            newDepartmentId: departmentId,

            previousPositionId: currentEmployment.position?.id ?? null,
            newPositionId: positionId,

            previousCompanyEmployeeNumber:
              currentEmployment.companyEmployeeNumber,
            newCompanyEmployeeNumber: companyEmployeeNumber,
          },
        });

        return transaction.employee.findUniqueOrThrow({
          where: {
            id: employeeId,
          },

          select: EMPLOYEE_SELECT,
        });
      },
    );

    return this.toDirectoryView(updatedEmployee);
  }

  private async validateEmployeeNumber(employeeNumber: string): Promise<void> {
    const existingEmployee = await this.prisma.employee.findUnique({
      where: {
        employeeNumber,
      },

      select: {
        id: true,
      },
    });

    if (existingEmployee) {
      throw new ConflictException('Employee number already exists.');
    }
  }

  private async validateEmploymentAssignmentReferences(
    companyId: string,
    departmentId?: string | null,
    positionId?: string | null,
  ): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: {
        id: companyId,
      },

      select: {
        id: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    if (departmentId) {
      const department = await this.prisma.department.findFirst({
        where: {
          id: departmentId,
          companyId,
        },

        select: {
          id: true,
        },
      });

      if (!department) {
        throw new NotFoundException(
          'Department not found for the selected company.',
        );
      }
    }

    if (positionId) {
      const position = await this.prisma.position.findFirst({
        where: {
          id: positionId,
          companyId,
        },

        select: {
          id: true,
        },
      });

      if (!position) {
        throw new NotFoundException(
          'Position not found for the selected company.',
        );
      }
    }
  }

  private async validateCompanyEmployeeNumber(
    companyId: string,
    companyEmployeeNumber: string,
    excludeEmploymentRecordId?: string,
  ): Promise<void> {
    const existingEmploymentRecord =
      await this.prisma.employmentRecord.findFirst({
        where: {
          companyId,
          companyEmployeeNumber,

          ...(excludeEmploymentRecordId
            ? {
                id: {
                  not: excludeEmploymentRecordId,
                },
              }
            : {}),
        },

        select: {
          id: true,
        },
      });

    if (existingEmploymentRecord) {
      throw new ConflictException(
        'Company employee number already exists for this company.',
      );
    }
  }

  private getCurrentEmployment(
    employee: EmployeeRecord,
  ): EmployeeRecord['employmentRecords'][number] | null {
    return (
      employee.employmentRecords.find((record) => record.endDate === null) ??
      employee.employmentRecords[0] ??
      null
    );
  }

  private toDirectoryView(employee: EmployeeRecord): EmployeeDirectoryView {
    const currentEmployment = this.getCurrentEmployment(employee);

    return {
      id: employee.id,
      employeeNumber: employee.employeeNumber,

      firstName: employee.firstName,
      middleName: employee.middleName,
      lastName: employee.lastName,
      suffix: employee.suffix,

      fullName: [
        employee.firstName,
        employee.middleName,
        employee.lastName,
        employee.suffix,
      ]
        .filter(Boolean)
        .join(' '),

      email: employee.email,
      mobile: employee.mobile,

      currentStatus: employee.currentStatus,

      currentEmployment: currentEmployment
        ? {
            id: currentEmployment.id,

            companyEmployeeNumber: currentEmployment.companyEmployeeNumber,

            startDate: currentEmployment.startDate,
            endDate: currentEmployment.endDate,

            company: currentEmployment.company,

            department: currentEmployment.department,

            position: currentEmployment.position,

            payoutMethod:
              currentEmployment.payrollProfile?.payoutMethod ?? null,
          }
        : null,

      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }

  private isUniqueConstraintError(error: unknown): error is {
    code: string;
  } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
