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
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import { UpdateCompanyStatusDto } from './dto/update-company-status.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Roles(RoleCode.PAYROLL_MANAGER)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

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

  @Get(':companyId')
  getCompanyById(
    @Param('companyId')
    companyId: string,
  ): Promise<CompanyView> {
    return this.companiesService.getCompanyById(companyId);
  }
}
