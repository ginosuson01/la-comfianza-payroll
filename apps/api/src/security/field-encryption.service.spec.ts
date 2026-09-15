import { ConfigService } from '@nestjs/config';

import { FieldEncryptionService } from './field-encryption.service';

describe('FieldEncryptionService', () => {
  const encryptionKeyBase64 = Buffer.from(
    '0123456789abcdef0123456789abcdef',
    'utf8',
  ).toString('base64');

  function createService(): FieldEncryptionService {
    const config = {
      get: jest.fn().mockReturnValue(encryptionKeyBase64),
    } as unknown as ConfigService;

    return new FieldEncryptionService(config);
  }

  it('encrypts and decrypts a value successfully', () => {
    const service = createService();

    const accountNumber = '1234567890123456';

    const encrypted = service.encrypt(accountNumber);

    expect(encrypted).not.toBe(accountNumber);
    expect(encrypted.startsWith('v1:')).toBe(true);

    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(accountNumber);
  });

  it('produces different ciphertext for the same value', () => {
    const service = createService();

    const accountNumber = '1234567890123456';

    const first = service.encrypt(accountNumber);

    const second = service.encrypt(accountNumber);

    expect(first).not.toBe(second);

    expect(service.decrypt(first)).toBe(accountNumber);

    expect(service.decrypt(second)).toBe(accountNumber);
  });

  it('rejects a missing encryption key', () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    expect(() => new FieldEncryptionService(config)).toThrow(
      'FIELD_ENCRYPTION_KEY_BASE64 is required.',
    );
  });

  it('rejects an encryption key that is not exactly 32 bytes', () => {
    const invalidKey = Buffer.from('too-short', 'utf8').toString('base64');

    const config = {
      get: jest.fn().mockReturnValue(invalidKey),
    } as unknown as ConfigService;

    expect(() => new FieldEncryptionService(config)).toThrow(
      'FIELD_ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes.',
    );
  });

  it('rejects an empty value for encryption', () => {
    const service = createService();

    expect(() => service.encrypt('')).toThrow('Cannot encrypt an empty value.');
  });

  it('detects tampering with encrypted data', () => {
    const service = createService();

    const encrypted = service.encrypt('1234567890123456');

    const parts = encrypted.split(':');

    const ciphertext = parts[3];

    const replacementCharacter = ciphertext[0] === 'A' ? 'B' : 'A';

    parts[3] = replacementCharacter + ciphertext.slice(1);

    const tampered = parts.join(':');

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('rejects an invalid encrypted payload format', () => {
    const service = createService();

    expect(() => service.decrypt('invalid-value')).toThrow(
      'Invalid encrypted value format.',
    );
  });
});
