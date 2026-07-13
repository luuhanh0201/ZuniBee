import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { GrantAiCreditRequest } from '@zunibee/shared';
export class GrantAiCreditDto implements GrantAiCreditRequest {
  @IsUUID('4', { message: 'User ID không hợp lệ' }) userId!: string;
  @IsInt() @Min(1) @Max(1000000) amount!: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
