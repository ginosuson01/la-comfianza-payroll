import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyCompensationService } from './company-compensation.service';
import { CompanyCutoffTemplateService } from './company-cutoff-template.service';
import { CompanyPayrollSetupService } from './company-payroll-setup.service';

@Module({
  imports: [AuditModule],

  controllers: [CompaniesController],

  providers: [
    CompaniesService,
    CompanyCompensationService,
    CompanyPayrollSetupService,
    CompanyCutoffTemplateService,
  ],

  exports: [
    CompaniesService,
    CompanyCompensationService,
    CompanyPayrollSetupService,
    CompanyCutoffTemplateService,
  ],
})
export class CompaniesModule {}
