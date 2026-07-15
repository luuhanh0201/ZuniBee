import { PartialType } from '@nestjs/swagger';
import { UpsertAiUsageBudgetDto } from './upsert-ai-usage-budget.dto';

export class UpdateAiUsageBudgetDto extends PartialType(
  UpsertAiUsageBudgetDto,
) {}
