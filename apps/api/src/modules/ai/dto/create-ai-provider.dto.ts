import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { CreateAiProviderRequest } from '@zunibee/shared';
import { AiProviderKind } from '../entities/ai-provider.entity';

export class CreateAiProviderDto implements CreateAiProviderRequest {
  @IsString({ message: 'Tên provider phải là chuỗi' })
  @MinLength(2)
  @MaxLength(120)
  name!: string;
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
  @IsString() @MinLength(1) @MaxLength(200) model!: string;
  @IsOptional() @IsString() @MaxLength(1000) apiKey?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isVisionDefault?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100000) baseCreditCost?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000) creditCostPer1kTokens?: number;
  // Đơn giá USD / 1 triệu token; gửi null để xoá giá (IsOptional bỏ qua null).
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Max(1_000_000)
  inputUsdPer1m?: number | null;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Max(1_000_000)
  outputUsdPer1m?: number | null;
}
