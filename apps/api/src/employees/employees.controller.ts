import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { RoleCode } from '@payroll/database';

import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { ResolvedAuthenticatedIdentity } from '../auth/interfaces/resolved-authenticated-identity.interface';
import { EmployeeAlphaListCsvService } from './employee-alpha-list-csv.service';
import { EmployeeAlphaListPdfService } from './employee-alpha-list-pdf.service';
import {
  EmployeeAlphaListService,
  type EmployeeAlphaListResponse,
} from './employee-alpha-list.service';
import {
  EmployeeCompensationService,
  type EmployeeCompensationView,
  type EmployeeEffectiveCompensationView,
} from './employee-compensation.service';
import {
  EmployeeLeaveCreditService,
  type EmployeeLeaveCreditView,
} from './employee-leave-credit.service';
import {
  EmployeeLeaveEntitlementCycleService,
  type EmployeeLeaveEntitlementCycleEnsureResult,
  type EmployeeLeaveEntitlementCycleView,
} from './employee-leave-entitlement-cycle.service';
import {
  EmployeeLeaveEntitlementService,
  type EmployeeLeaveEntitlementView,
} from './employee-leave-entitlement.service';
import {
  EmployeePayrollProfileService,
  type EmployeePayrollAccountRevealView,
  type EmployeePayrollProfileView,
} from './employee-payroll-profile.service';
import {
  EmployeeRecurringPayrollService,
  type RecurringPayrollItemView,
} from './employee-recurring-payroll.service';
import {
  EmployeeStatusService,
  type EmployeeStatusChangeView,
} from './employee-status.service';
import { AdjustEmployeeLeaveCreditDto } from './dto/adjust-employee-leave-credit.dto';
import { ChangeEmployeeStatusDto } from './dto/change-employee-status.dto';
import { ChangeEmploymentAssignmentDto } from './dto/change-employment-assignment.dto';
import { CorrectEmploymentStartDateDto } from './dto/correct-employment-start-date.dto';
import { CorrectEmploymentTypeDto } from './dto/correct-employment-type.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { CreateRecurringPayrollItemDto } from './dto/create-recurring-payroll-item.dto';
import { EmployeeAlphaListQueryDto } from './dto/employee-alpha-list-query.dto';
import { EnsureEmployeeLeaveEntitlementCycleDto } from './dto/ensure-employee-leave-entitlement-cycle.dto';
import { GetEmployeeLeaveEntitlementQueryDto } from './dto/get-employee-leave-entitlement-query.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { SetCompensationDto } from './dto/set-compensation.dto';
import { SetEmployeePayrollProfileDto } from './dto/set-employee-payroll-profile.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import type {
  EmployeeDirectoryView,
  EmployeeListResponse,
} from './employees.service';
import { EmployeesService } from './employees.service';

@Roles(RoleCode.PAYROLL_MANAGER)
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly compensationService: EmployeeCompensationService,
    private readonly recurringPayrollService: EmployeeRecurringPayrollService,
    private readonly employeeStatusService: EmployeeStatusService,
    private readonly payrollProfileService: EmployeePayrollProfileService,
    private readonly leaveCreditService: EmployeeLeaveCreditService,
    private readonly leaveEntitlementCycleService: EmployeeLeaveEntitlementCycleService,
    private readonly leaveEntitlementService: EmployeeLeaveEntitlementService,
    private readonly alphaListService: EmployeeAlphaListService,
    private readonly alphaListCsvService: EmployeeAlphaListCsvService,
    private readonly alphaListPdfService: EmployeeAlphaListPdfService,
  ) {}

  @Get()
  listEmployees(
    @Query()
    query: ListEmployeesQueryDto,
  ): Promise<EmployeeListResponse> {
    return this.employeesService.listEmployees(query);
  }

  @Get('alpha-list')
  getEmployeeAlphaList(
    @Query()
    query: EmployeeAlphaListQueryDto,
  ): Promise<EmployeeAlphaListResponse> {
    return this.alphaListService.getAlphaList(query);
  }

  @Get('alpha-list/export/csv')
  async exportEmployeeAlphaListCsv(
    @Query()
    query: EmployeeAlphaListQueryDto,
  ): Promise<StreamableFile> {
    const exportFile = await this.alphaListCsvService.generateCsv(query);

    return new StreamableFile(Buffer.from(exportFile.content, 'utf8'), {
      type: exportFile.contentType,

      disposition: `attachment; filename="${exportFile.fileName}"`,
    });
  }

  @Get('alpha-list/export/pdf')
  async exportEmployeeAlphaListPdf(
    @Query()
    query: EmployeeAlphaListQueryDto,
  ): Promise<StreamableFile> {
    const exportFile = await this.alphaListPdfService.generatePdf(query);

    return new StreamableFile(exportFile.content, {
      type: exportFile.contentType,

      disposition: `attachment; filename="${exportFile.fileName}"`,
    });
  }

  @Post()
  createEmployee(
    @Body()
    input: CreateEmployeeDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<EmployeeDirectoryView> {
    return this.employeesService.createEmployee(input, identity.user.id);
  }

  @Patch(':employeeId')
  updateEmployee(
    @Param('employeeId')
    employeeId: string,

    @Body()
    input: UpdateEmployeeDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<EmployeeDirectoryView> {
    return this.employeesService.updateEmployee(
      employeeId,
      input,
      identity.user.id,
    );
  }

  @Patch(':employeeId/employment/start-date')
  correctEmploymentStartDate(
    @Param('employeeId')
    employeeId: string,

    @Body()
    input: CorrectEmploymentStartDateDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<EmployeeDirectoryView> {
    return this.employeesService.correctEmploymentStartDate(
      employeeId,
      input,
      identity.user.id,
    );
  }

  @Patch(':employeeId/employment/type')
  correctEmploymentType(
    @Param('employeeId')
    employeeId: string,

    @Body()
    input: CorrectEmploymentTypeDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<EmployeeDirectoryView> {
    return this.employeesService.correctEmploymentType(
      employeeId,
      input,
      identity.user.id,
    );
  }

  @Patch(':employeeId/employment')
  changeEmploymentAssignment(
    @Param('employeeId')
    employeeId: string,

    @Body()
    input: ChangeEmploymentAssignmentDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<EmployeeDirectoryView> {
    return this.employeesService.changeEmploymentAssignment(
      employeeId,
      input,
      identity.user.id,
    );
  }

  @Get(':employeeId/compensation/effective')
  getEffectiveCompensation(
    @Param('employeeId')
    employeeId: string,
  ): Promise<EmployeeEffectiveCompensationView> {
    return this.compensationService.getEffectiveCompensation(employeeId);
  }

  @Get(':employeeId/compensation')
  getCurrentCompensation(
    @Param('employeeId')
    employeeId: string,
  ): Promise<EmployeeCompensationView | null> {
    return this.compensationService.getCurrentCompensation(employeeId);
  }

  @Post(':employeeId/compensation')
  setCompensation(
    @Param('employeeId')
    employeeId: string,

    @Body()
    input: SetCompensationDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<EmployeeCompensationView> {
    return this.compensationService.setCompensation(
      employeeId,
      input,
      identity.user.id,
    );
  }

  @Post(':employeeId/recurring-payroll-items')
  createRecurringPayrollItem(
    @Param('employeeId')
    employeeId: string,

    @Body()
    input: CreateRecurringPayrollItemDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<RecurringPayrollItemView> {
    return this.recurringPayrollService.createRecurringPayrollItem(
      employeeId,
      input,
      identity.user.id,
    );
  }

  @Patch(':employeeId/status')
  changeEmployeeStatus(
    @Param('employeeId')
    employeeId: string,

    @Body()
    input: ChangeEmployeeStatusDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<EmployeeStatusChangeView> {
    return this.employeeStatusService.changeStatus(
      employeeId,
      input,
      identity.user.id,
    );
  }

  @Get(':employeeId/payroll-profile')
  getPayrollProfile(
    @Param('employeeId')
    employeeId: string,
  ): Promise<EmployeePayrollProfileView | null> {
    return this.payrollProfileService.getPayrollProfile(employeeId);
  }

  @Post(':employeeId/payroll-profile/reveal-account')
  revealPayrollAccount(
    @Param('employeeId')
    employeeId: string,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<EmployeePayrollAccountRevealView> {
    return this.payrollProfileService.revealPayrollAccount(
      employeeId,
      identity.user.id,
    );
  }

  @Patch(':employeeId/payroll-profile')
  setPayrollProfile(
    @Param('employeeId')
    employeeId: string,

    @Body()
    input: SetEmployeePayrollProfileDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<EmployeePayrollProfileView> {
    return this.payrollProfileService.setPayrollProfile(
      employeeId,
      input,
      identity.user.id,
    );
  }

  @Post(':employeeId/leave-entitlement-cycle/ensure')
  ensureLeaveEntitlementCycle(
    @Param('employeeId')
    employeeId: string,

    @Body()
    input: EnsureEmployeeLeaveEntitlementCycleDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<EmployeeLeaveEntitlementCycleEnsureResult> {
    return this.leaveEntitlementCycleService.ensureAnnualCycle(
      employeeId,
      input.asOfDate,
      identity.user.id,
    );
  }

  @Post(':employeeId/leave-entitlement-cycle/initialize')
  initializeLeaveEntitlementCycle(
    @Param('employeeId')
    employeeId: string,

    @Body()
    input: EnsureEmployeeLeaveEntitlementCycleDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<EmployeeLeaveEntitlementCycleEnsureResult> {
    return this.leaveEntitlementCycleService.initializeAnnualCycle(
      employeeId,
      input.asOfDate,
      identity.user.id,
    );
  }

  @Post(':employeeId/leave-entitlement-cycle/review-complete')
  completeLeaveEntitlementInitializationReview(
    @Param('employeeId')
    employeeId: string,

    @Body()
    input: EnsureEmployeeLeaveEntitlementCycleDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<EmployeeLeaveEntitlementCycleView> {
    return this.leaveEntitlementCycleService.completeInitializationReview(
      employeeId,
      input.asOfDate,
      identity.user.id,
    );
  }

  @Get(':employeeId/leave-entitlement')
  getLeaveEntitlement(
    @Param('employeeId')
    employeeId: string,

    @Query()
    query: GetEmployeeLeaveEntitlementQueryDto,
  ): Promise<EmployeeLeaveEntitlementView> {
    return this.leaveEntitlementService.getLeaveEntitlement(
      employeeId,
      query.asOfDate,
    );
  }

  @Post(':employeeId/leave-credits/adjust')
  adjustLeaveCredit(
    @Param('employeeId')
    employeeId: string,

    @Body()
    input: AdjustEmployeeLeaveCreditDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<EmployeeLeaveCreditView> {
    return this.leaveCreditService.adjustLeaveCredit(
      employeeId,
      input,
      identity.user.id,
    );
  }
}
