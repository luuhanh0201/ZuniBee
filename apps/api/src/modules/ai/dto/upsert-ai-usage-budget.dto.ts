import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type {
  AiUsageBudgetPeriod,
  AiUsageBudgetScope,
  UpsertAiUsageBudgetRequest,
} from '@zunibee/shared';

export class UpsertAiUsageBudgetDto implements UpsertAiUsageBudgetRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsIn(['global', 'provider', 'model', 'source'])
  scope!: AiUsageBudgetScope;

  @ValidateIf((dto: UpsertAiUsageBudgetDto) => dto.scope !== 'global')
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  scopeValue?: string | null;

  @IsIn(['daily', 'monthly'])
  period!: AiUsageBudgetPeriod;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Max(100_000_000)
  limitUsd!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  warningPercent?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
