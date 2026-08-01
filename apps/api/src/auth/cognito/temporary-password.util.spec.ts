import { generateTemporaryPassword } from './temporary-password.util';

describe('generateTemporaryPassword', () => {
  it('generates different passwords', () => {
    expect(generateTemporaryPassword()).not.toBe(generateTemporaryPassword());
  });

  it('contains required password categories', () => {
    const password = generateTemporaryPassword();

    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
    expect(password.length).toBeGreaterThanOrEqual(16);
  });
});
