import { randomBytes } from 'node:crypto';

export function generateTemporaryPassword(): string {
  const randomPart = randomBytes(18).toString('base64url');

  return `Lc!A1${randomPart}`;
}
