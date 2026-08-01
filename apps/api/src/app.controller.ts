import { Controller, Get } from '@nestjs/common';

import { Public } from './auth/decorators/public.decorator';
import { AppService } from './app.service';

@Public()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getInfo() {
    return this.appService.getInfo();
  }
}
