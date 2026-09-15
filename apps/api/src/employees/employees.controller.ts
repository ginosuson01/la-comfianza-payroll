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
} from './employee-compensation.service';
import {
  EmployeeLeaveCreditService,
  type EmployeeLeaveCreditView,
} from './employee-leave-credit.service';
import {
  EmployeePayrollProfileService,
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
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { CreateRecurringPayrollItemDto } from './dto/create-recurring-payroll-item.dto';
import { EmployeeAlphaListQueryDto } from './dto/employee-alpha-list-query.dto';
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
