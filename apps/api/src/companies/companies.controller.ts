import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RoleCode } from '@payroll/database';

import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { ResolvedAuthenticatedIdentity } from '../auth/interfaces/resolved-authenticated-identity.interface';
import type { CompanyListResponse, CompanyView } from './companies.service';
import { CompaniesService } from './companies.service';
import {
  CompanyCompensationService,
  type CompanyCompensationView,
} from './company-compensation.service';
import {
  CompanyCutoffTemplateService,
  type CompanyCutoffTemplateView,
} from './company-cutoff-template.service';
import {
  CompanyPayrollSetupService,
  type CompanyPayrollSetupView,
} from './company-payroll-setup.service';
import { ChangeCompanyCompensationDto } from './dto/change-company-compensation.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateCompanyCompensationDto } from './dto/create-company-compensation.dto';
import { CreateCompanyPayrollSetupDto } from './dto/create-company-payroll-setup.dto';
import { CreateCompanyPayrollSetupVersionDto } from './dto/create-company-payroll-setup-version.dto';
import { CreateCutoffTemplateDto } from './dto/create-cutoff-template.dto';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import { UpdateCompanyStatusDto } from './dto/update-company-status.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Roles(RoleCode.PAYROLL_MANAGER)
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly companyCompensationService: CompanyCompensationService,
    private readonly companyPayrollSetupService: CompanyPayrollSetupService,
    private readonly companyCutoffTemplateService: CompanyCutoffTemplateService,
  ) {}

  @Get()
  listCompanies(
    @Query()
    query: ListCompaniesQueryDto,
  ): Promise<CompanyListResponse> {
    return this.companiesService.listCompanies(query);
  }

  @Post()
  createCompany(
    @Body()
    input: CreateCompanyDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<CompanyView> {
    return this.companiesService.createCompany(input, identity.user.id);
  }

  @Patch(':companyId')
  updateCompany(
    @Param('companyId')
    companyId: string,

    @Body()
    input: UpdateCompanyDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<CompanyView> {
    return this.companiesService.updateCompany(
      companyId,
      input,
      identity.user.id,
    );
  }

  @Patch(':companyId/status')
  updateCompanyStatus(
    @Param('companyId')
    companyId: string,

    @Body()
    input: UpdateCompanyStatusDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<CompanyView> {
    return this.companiesService.updateCompanyStatus(
      companyId,
      input.status,
      identity.user.id,
    );
  }

  @Get(':companyId/compensation')
  getCompanyCompensation(
    @Param('companyId')
    companyId: string,
  ): Promise<CompanyCompensationView | null> {
    return this.companyCompensationService.getLatestCompanyCompensation(
      companyId,
    );
  }

  @Get(':companyId/compensation/history')
  listCompanyCompensationHistory(
    @Param('companyId')
    companyId: string,
  ): Promise<CompanyCompensationView[]> {
    return this.companyCompensationService.listCompanyCompensationHistory(
      companyId,
    );
  }

  @Post(':companyId/compensation')
  createCompanyCompensation(
    @Param('companyId')
    companyId: string,

    @Body()
    input: CreateCompanyCompensationDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<CompanyCompensationView> {
    return this.companyCompensationService.createInitialCompanyCompensation(
      companyId,
      input,
      identity.user.id,
    );
  }

  @Post(':companyId/compensation/versions')
  createCompanyCompensationVersion(
    @Param('companyId')
    companyId: string,

    @Body()
    input: ChangeCompanyCompensationDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<CompanyCompensationView> {
    return this.companyCompensationService.createNextCompanyCompensationVersion(
      companyId,
      input,
      identity.user.id,
    );
  }

  @Get(':companyId/cutoff-templates')
  listCompanyCutoffTemplates(
    @Param('companyId')
    companyId: string,
  ): Promise<CompanyCutoffTemplateView[]> {
    return this.companyCutoffTemplateService.listCompanyCutoffTemplates(
      companyId,
    );
  }

  @Post(':companyId/cutoff-templates')
  createCompanyCutoffTemplate(
    @Param('companyId')
    companyId: string,

    @Body()
    input: CreateCutoffTemplateDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<CompanyCutoffTemplateView> {
    return this.companyCutoffTemplateService.createCompanyCutoffTemplate(
      companyId,
      input,
      identity.user.id,
    );
  }

  @Get(':companyId/payroll-setup')
  getCompanyPayrollSetup(
    @Param('companyId')
    companyId: string,
  ): Promise<CompanyPayrollSetupView | null> {
    return this.companyPayrollSetupService.getCompanyPayrollSetup(companyId);
  }

  @Post(':companyId/payroll-setup')
  createCompanyPayrollSetup(
    @Param('companyId')
    companyId: string,

    @Body()
    input: CreateCompanyPayrollSetupDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<CompanyPayrollSetupView> {
    return this.companyPayrollSetupService.createCompanyPayrollSetup(
      companyId,
      input,
      identity.user.id,
    );
  }

  @Post(':companyId/payroll-setup/versions')
  createCompanyPayrollSetupVersion(
    @Param('companyId')
    companyId: string,

    @Body()
    input: CreateCompanyPayrollSetupVersionDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<CompanyPayrollSetupView> {
    return this.companyPayrollSetupService.createCompanyPayrollSetupVersion(
      companyId,
      input,
      identity.user.id,
    );
  }

  @Get(':companyId')
  getCompanyById(
    @Param('companyId')
    companyId: string,
  ): Promise<CompanyView> {
    return this.companiesService.getCompanyById(companyId);
  }
}
