import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

@Injectable()
export class AiSecretService {
  constructor(private readonly config: ConfigService) {}
  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), encrypted]
      .map((part) => part.toString('base64url'))
      .join('.');
  }
  decrypt(value: string | null): string | null {
    if (!value) return null;
    const [iv, tag, encrypted] = value
      .split('.')
      .map((part) => Buffer.from(part, 'base64url'));
    if (!iv || !tag || !encrypted)
      throw new InternalServerErrorException('API key provider bị hỏng');
    const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }
  private key(): Buffer {
    const secret = this.config.get<string>('AI_PROVIDER_ENCRYPTION_KEY');
    if (!secret && this.config.get<string>('NODE_ENV') === 'production') {
      throw new InternalServerErrorException(
        'Thiếu AI_PROVIDER_ENCRYPTION_KEY',
      );
    }
    return createHash('sha256')
      .update(secret || 'zunibee-local-ai-provider-key')
      .digest();
  }
}
