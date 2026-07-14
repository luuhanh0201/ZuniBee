import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

@Injectable()
export class AiSecretService {
  private readonly logger = new Logger(AiSecretService.name);
  private encryptionKey?: Buffer;

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
    if (this.encryptionKey) return this.encryptionKey;
    const configured = this.config.get<string>('AI_PROVIDER_ENCRYPTION_KEY');
    const secret =
      configured ||
      (this.config.get<string>('NODE_ENV') === 'production'
        ? this.productionFileSecret()
        : 'zunibee-local-ai-provider-key');
    this.encryptionKey = createHash('sha256').update(secret).digest();
    return this.encryptionKey;
  }

  private productionFileSecret(): string {
    const path = this.config.get<string>(
      'AI_PROVIDER_ENCRYPTION_KEY_FILE',
      '/app/apps/api/secrets/ai-provider-encryption-key',
    );
    try {
      const existing = readSecret(path);
      if (existing) return existing;
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      const generated = randomBytes(32).toString('base64url');
      try {
        writeFileSync(path, generated, {
          encoding: 'utf8',
          flag: 'wx',
          mode: 0o600,
        });
        this.logger.log('Đã tạo khóa mã hóa AI provider trong secret volume');
        return generated;
      } catch (error) {
        const racedValue = readSecret(path);
        if (racedValue) return racedValue;
        throw error;
      }
    } catch {
      this.logger.error('Không thể khởi tạo khóa mã hóa AI provider');
      throw new InternalServerErrorException(
        'Không thể đọc hoặc tạo khóa mã hóa AI provider',
      );
    }
  }
}

function readSecret(path: string): string | null {
  try {
    const value = readFileSync(path, 'utf8').trim();
    if (value.length < 32)
      throw new Error('AI provider encryption key file is too short');
    return value;
  } catch (error) {
    if (errorCode(error) === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as Record<string, unknown>).code;
  return typeof code === 'string' ? code : undefined;
}
