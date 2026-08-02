import { ConflictException, Injectable } from '@nestjs/common';
import { RoleCode, UserStatus } from '@payroll/database';

export const ROOT_PAYROLL_MANAGER_USERNAME = 'payroll.manager';

@Injectable()
export class RootAccountPolicyService {
  isRootAccount(username: string): boolean {
    return username === ROOT_PAYROLL_MANAGER_USERNAME;
  }

  assertRoleReplacementAllowed(
    username: string,
    requestedRoles: RoleCode[],
  ): void {
    if (!this.isRootAccount(username)) {
      return;
    }

    const retainsOnlyPayrollManagerRole =
      requestedRoles.length === 1 &&
      requestedRoles[0] === RoleCode.PAYROLL_MANAGER;

    if (!retainsOnlyPayrollManagerRole) {
      throw new ConflictException(
        'The root Payroll Manager must retain only the PAYROLL_MANAGER role.',
      );
    }
  }

  assertCompanyReplacementAllowed(
    username: string,
    requestedCompanyIds: string[],
  ): void {
    if (!this.isRootAccount(username)) {
      return;
    }

    if (requestedCompanyIds.length > 0) {
      throw new ConflictException(
        'The root Payroll Manager cannot be assigned company-specific access.',
      );
    }
  }

  assertStatusUpdateAllowed(
    username: string,
    requestedStatus: UserStatus,
  ): void {
    if (!this.isRootAccount(username)) {
      return;
    }

    if (requestedStatus !== UserStatus.ACTIVE) {
      throw new ConflictException(
        'The root Payroll Manager account must remain active.',
      );
    }
  }
}
