import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const ENCRYPTION_VERSION = 'v1';

@Injectable()
export class FieldEncryptionService {
  private readonly encryptionKey: Buffer;

  constructor(private readonly config: ConfigService) {
    const encodedKey = this.config
      .get<string>('FIELD_ENCRYPTION_KEY_BASE64')
      ?.trim();

    if (!encodedKey) {
      throw new Error('FIELD_ENCRYPTION_KEY_BASE64 is required.');
    }

    const encryptionKey = Buffer.from(encodedKey, 'base64');

    if (encryptionKey.length !== KEY_LENGTH_BYTES) {
      throw new Error(
        'FIELD_ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes.',
      );
    }

    this.encryptionKey = encryptionKey;
  }

  encrypt(value: string): string {
    if (!value) {
      throw new Error('Cannot encrypt an empty value.');
    }

    const iv = randomBytes(IV_LENGTH_BYTES);

    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);

    const ciphertext = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);

    const authenticationTag = cipher.getAuthTag();

    return [
      ENCRYPTION_VERSION,
      iv.toString('base64url'),
      authenticationTag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join(':');
  }

  decrypt(payload: string): string {
    const parts = payload.split(':');

    if (parts.length !== 4 || parts[0] !== ENCRYPTION_VERSION) {
      throw new Error('Invalid encrypted value format.');
    }

    const [, , authenticationTagPart, ciphertextPart] = parts;

    const iv = Buffer.from(parts[1], 'base64url');

    const authenticationTag = Buffer.from(authenticationTagPart, 'base64url');

    const ciphertext = Buffer.from(ciphertextPart, 'base64url');

    if (iv.length !== IV_LENGTH_BYTES) {
      throw new Error('Invalid encrypted value initialization vector.');
    }

    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv);

    decipher.setAuthTag(authenticationTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  }
}
