import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import type { DiscoverAiProviderModelsRequest } from '@zunibee/shared';
import { AiProviderKind } from '../entities/ai-provider.entity';
import { AiProviderDriver } from '../ai-provider-driver';

export class DiscoverAiProviderModelsDto implements DiscoverAiProviderModelsRequest {
  @IsEnum(AiProviderKind, { message: 'Loại provider không hợp lệ' })
  kind!: AiProviderKind;

  @IsOptional()
  @IsEnum(AiProviderDriver, { message: 'SDK driver provider không hợp lệ' })
  driver?: AiProviderDriver;

  @IsUrl(
    {
      require_tld: false,
      protocols: ['http', 'https'],
      require_protocol: true,
    },
    { message: 'Base URL phải là URL HTTP/HTTPS hợp lệ' },
  )
  @MaxLength(500)
  baseUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  apiKey?: string;
}
