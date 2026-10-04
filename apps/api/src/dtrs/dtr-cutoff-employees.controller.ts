import { Controller, Get, Query } from '@nestjs/common';
import { RoleCode } from '@payroll/database';

import { Roles } from '../auth/decorators/roles.decorator';
import {
  DtrCutoffEmployeesService,
  type CutoffEmployeeView,
} from './dtr-cutoff-employees.service';
import { ListCutoffEmployeesQueryDto } from './dto/list-cutoff-employees-query.dto';

@Roles(RoleCode.PAYROLL_MANAGER)
@Controller('attendance/cutoff-employees')
export class DtrCutoffEmployeesController {
  constructor(private readonly service: DtrCutoffEmployeesService) {}

  @Get()
  listCutoffEmployees(
    @Query()
    query: ListCutoffEmployeesQueryDto,
  ): Promise<CutoffEmployeeView[]> {
    return this.service.listCutoffEmployees(query);
  }
}
