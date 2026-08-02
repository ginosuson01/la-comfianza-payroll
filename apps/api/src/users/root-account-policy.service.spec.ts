import { ConflictException } from '@nestjs/common';
import { RoleCode, UserStatus } from '@payroll/database';

import {
  ROOT_PAYROLL_MANAGER_USERNAME,
  RootAccountPolicyService,
} from './root-account-policy.service';

describe('RootAccountPolicyService', () => {
  let policy: RootAccountPolicyService;

  beforeEach(() => {
    policy = new RootAccountPolicyService();
  });

  describe('role replacement', () => {
    it('allows only PAYROLL_MANAGER for the root account', () => {
      expect(() =>
        policy.assertRoleReplacementAllowed(ROOT_PAYROLL_MANAGER_USERNAME, [
          RoleCode.PAYROLL_MANAGER,
        ]),
      ).not.toThrow();
    });

    it('rejects removal of PAYROLL_MANAGER from the root account', () => {
      expect(() =>
        policy.assertRoleReplacementAllowed(ROOT_PAYROLL_MANAGER_USERNAME, [
          RoleCode.COMPANY_MANAGER,
        ]),
      ).toThrow(ConflictException);
    });

    it('rejects additional roles on the root account', () => {
      expect(() =>
        policy.assertRoleReplacementAllowed(ROOT_PAYROLL_MANAGER_USERNAME, [
          RoleCode.PAYROLL_MANAGER,
          RoleCode.COMPANY_MANAGER,
        ]),
      ).toThrow(ConflictException);
    });

    it('does not restrict normal users', () => {
      expect(() =>
        policy.assertRoleReplacementAllowed('jsantos', [
          RoleCode.COMPANY_MANAGER,
        ]),
      ).not.toThrow();
    });
  });

  describe('company replacement', () => {
    it('allows an empty company list for the root account', () => {
      expect(() =>
        policy.assertCompanyReplacementAllowed(
          ROOT_PAYROLL_MANAGER_USERNAME,
          [],
        ),
      ).not.toThrow();
    });

    it('rejects company-specific access for the root account', () => {
      expect(() =>
        policy.assertCompanyReplacementAllowed(ROOT_PAYROLL_MANAGER_USERNAME, [
          '9c74a047-5ca5-45c3-b9ef-814c15650c41',
        ]),
      ).toThrow(ConflictException);
    });

    it('does not restrict normal users', () => {
      expect(() =>
        policy.assertCompanyReplacementAllowed('jsantos', [
          '9c74a047-5ca5-45c3-b9ef-814c15650c41',
        ]),
      ).not.toThrow();
    });
  });

  describe('status update', () => {
    it('allows ACTIVE for the root account', () => {
      expect(() =>
        policy.assertStatusUpdateAllowed(
          ROOT_PAYROLL_MANAGER_USERNAME,
          UserStatus.ACTIVE,
        ),
      ).not.toThrow();
    });

    it('rejects DISABLED for the root account', () => {
      expect(() =>
        policy.assertStatusUpdateAllowed(
          ROOT_PAYROLL_MANAGER_USERNAME,
          UserStatus.DISABLED,
        ),
      ).toThrow(ConflictException);
    });

    it('does not restrict normal users', () => {
      expect(() =>
        policy.assertStatusUpdateAllowed('jsantos', UserStatus.DISABLED),
      ).not.toThrow();
    });
  });
});
