import { IsString, MaxLength, MinLength } from 'class-validator';
import type { TestAiProviderConnectionRequest } from '@zunibee/shared';
import { DiscoverAiProviderModelsDto } from './discover-ai-provider-models.dto';

export class TestAiProviderConnectionDto
  extends DiscoverAiProviderModelsDto
  implements TestAiProviderConnectionRequest
{
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  model!: string;
}
