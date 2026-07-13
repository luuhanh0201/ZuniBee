import { PartialType } from '@nestjs/swagger';
import { CreateAiProviderDto } from './create-ai-provider.dto';
export class UpdateAiProviderDto extends PartialType(CreateAiProviderDto) {}
