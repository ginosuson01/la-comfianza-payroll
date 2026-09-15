import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnvironment } from './config/environment.validation';
import { HealthModule } from './health/health.module';

import { AuthModule } from './auth/auth.module';

import { DatabaseModule } from './database/database.module';

import { UsersModule } from './users/users.module';

import { CompaniesModule } from './companies/companies.module';
import { EmployeesModule } from './employees/employees.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,

      envFilePath: ['../../.env', '.env'],

      validate: validateEnvironment,
    }),

    DatabaseModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    EmployeesModule,
    HealthModule,
  ],

  controllers: [AppController],

  providers: [AppService],
})
export class AppModule {}
