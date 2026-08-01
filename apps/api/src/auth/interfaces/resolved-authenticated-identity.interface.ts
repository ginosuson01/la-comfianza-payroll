import type { UserStatus } from '@payroll/database';

import type { AuthenticatedIdentity } from './authenticated-identity.interface';

export interface ApplicationUserIdentity {
  id: string;
  username: string;
  email: string;
  status: UserStatus;
}

export interface ResolvedAuthenticatedIdentity extends AuthenticatedIdentity {
  user: ApplicationUserIdentity;
}
