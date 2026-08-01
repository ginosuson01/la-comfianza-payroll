import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_ASSIGNMENT_KEY = 'allowPendingAssignment';

export const AllowPendingAssignment = () =>
  SetMetadata(ALLOW_PENDING_ASSIGNMENT_KEY, true);
