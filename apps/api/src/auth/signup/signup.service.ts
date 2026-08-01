import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { UserStatus } from '@payroll/database';

import { PrismaService } from '../../database/prisma.service';
import { CognitoAdminService } from '../cognito/cognito-admin.service';
import { createUsernameBase } from '../cognito/username.util';
import type { CreatedCognitoAccount } from '../cognito/cognito-account.interface';
import type { SignupDto } from './dto/signup.dto';

interface ReservedUser {
  id: string;
  username: string;
}

@Injectable()
export class SignupService {
  private readonly logger = new Logger(SignupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cognitoAdmin: CognitoAdminService,
  ) {}

  async signup(input: SignupDto) {
    const email = input.email.trim().toLowerCase();

    const existingEmail = await this.prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existingEmail) {
      throw new ConflictException('An account with this email already exists.');
    }

    const baseUsername = createUsernameBase(input.firstName, input.lastName);

    const reservedUser = await this.reserveUser({
      baseUsername,
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      mobile: input.mobile,
      jobTitle: input.jobTitle,
    });

    let cognitoAccount: CreatedCognitoAccount | undefined;

    try {
      cognitoAccount = await this.cognitoAdmin.createAccount({
        username: reservedUser.username,
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        mobile: input.mobile,
      });

      await this.prisma.user.update({
        where: {
          id: reservedUser.id,
        },

        data: {
          cognitoSubject: cognitoAccount.sub,
        },
      });

      return {
        username: reservedUser.username,
        status: UserStatus.PENDING_ASSIGNMENT,

        message:
          'Account created. Complete the temporary-password process, then wait for Payroll Manager access assignment.',
      };
    } catch (error: unknown) {
      if (cognitoAccount) {
        await this.compensateCognitoAccount(cognitoAccount.username);
      }

      await this.compensateReservedUser(reservedUser.id);

      throw error;
    }
  }

  private async reserveUser(input: {
    baseUsername: string;
    email: string;
    firstName: string;
    lastName: string;
    mobile?: string;
    jobTitle?: string;
  }): Promise<ReservedUser> {
    for (let suffix = 0; suffix <= 10_000; suffix += 1) {
      const username =
        suffix === 0 ? input.baseUsername : `${input.baseUsername}_${suffix}`;

      try {
        return await this.prisma.user.create({
          data: {
            username,
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            mobile: input.mobile,
            jobTitle: input.jobTitle,
            status: UserStatus.PENDING_ASSIGNMENT,
          },

          select: {
            id: true,
            username: true,
          },
        });
      } catch (error: unknown) {
        if (this.isUniqueViolation(error, 'username')) {
          continue;
        }

        if (this.isUniqueViolation(error, 'email')) {
          throw new ConflictException(
            'An account with this email already exists.',
          );
        }

        throw error;
      }
    }

    throw new InternalServerErrorException(
      'Unable to generate an available username.',
    );
  }

  private async compensateReservedUser(userId: string): Promise<void> {
    try {
      await this.prisma.user.delete({
        where: {
          id: userId,
        },
      });
    } catch (cleanupError: unknown) {
      this.logger.error(
        'Failed to clean up reserved database user after signup failure.',
        cleanupError instanceof Error
          ? cleanupError.message
          : String(cleanupError),
      );
    }
  }

  private async compensateCognitoAccount(username: string): Promise<void> {
    try {
      await this.cognitoAdmin.deleteAccount(username);
    } catch (cleanupError: unknown) {
      this.logger.error(
        `Failed to clean up Cognito account after signup failure: ${username}`,
        cleanupError instanceof Error
          ? cleanupError.message
          : String(cleanupError),
      );
    }
  }

  private isUniqueViolation(error: unknown, field: string): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    const code = (
      error as {
        code?: unknown;
      }
    ).code;

    if (code !== 'P2002') {
      return false;
    }

    const meta = (
      error as {
        meta?: {
          target?: unknown;
        };
      }
    ).meta;

    const target = meta?.target;

    if (Array.isArray(target)) {
      return target.some((value) => value === field);
    }

    if (typeof target === 'string') {
      return target.includes(field);
    }

    return false;
  }
}
