import { BadRequestException } from '@nestjs/common';

function normalizeUsernamePart(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function createUsernameBase(
  firstName: string,
  lastName: string,
): string {
  const cleanFirstName = normalizeUsernamePart(firstName);
  const cleanLastName = normalizeUsernamePart(lastName);

  if (!cleanFirstName || !cleanLastName) {
    throw new BadRequestException(
      'First name and last name are required to generate a username.',
    );
  }

  return `${cleanFirstName.charAt(0)}${cleanLastName}`;
}
