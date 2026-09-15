import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { FieldEncryptionService } from './field-encryption.service';

@Module({
  imports: [ConfigModule],

  providers: [FieldEncryptionService],

  exports: [FieldEncryptionService],
})
export class SecurityModule {}
