import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import type { DiscoverAiProviderModelsRequest } from '@zunibee/shared';
import { AiProviderKind } from '../entities/ai-provider.entity';

export class DiscoverAiProviderModelsDto implements DiscoverAiProviderModelsRequest {
  @IsEnum(AiProviderKind, { message: 'Loại provider không hợp lệ' })
  kind!: AiProviderKind;

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
