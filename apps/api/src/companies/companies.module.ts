import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyCompensationService } from './company-compensation.service';
import { CompanyCutoffTemplateService } from './company-cutoff-template.service';
import { CompanyPayrollConfigResolverService } from './company-payroll-config-resolver.service';
import { CompanyPayrollSetupService } from './company-payroll-setup.service';
import { GoldenPayrollTemplateService } from './golden-payroll-template.service';

@Module({
  imports: [AuditModule],

  controllers: [CompaniesController],

  providers: [
    CompaniesService,
    CompanyCompensationService,
    CompanyPayrollConfigResolverService,
    CompanyPayrollSetupService,
    GoldenPayrollTemplateService,
    CompanyCutoffTemplateService,
  ],

  exports: [
    CompaniesService,
    CompanyCompensationService,
    CompanyPayrollConfigResolverService,
    CompanyPayrollSetupService,
    GoldenPayrollTemplateService,
    CompanyCutoffTemplateService,
  ],
})
export class CompaniesModule {}
