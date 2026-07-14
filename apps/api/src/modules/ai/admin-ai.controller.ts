import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@zunibee/shared';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/modules/auth/types/authenticated-user.type';
import { AiProviderService } from './ai-provider.service';
import { AiCreditService } from './ai-credit.service';
import { AiUsageService } from './ai-usage.service';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto';
import { GrantAiCreditDto } from './dto/grant-ai-credit.dto';
import { ExpensiveOperationRateLimit } from '@/common/security/rate-limit.decorator';
import { DiscoverAiProviderModelsDto } from './dto/discover-ai-provider-models.dto';
import { TestAiProviderConnectionDto } from './dto/test-ai-provider-connection.dto';

@Roles(UserRole.ADMIN)
@Controller('admin/ai')
export class AdminAiController {
  constructor(
    private readonly providers: AiProviderService,
    private readonly credits: AiCreditService,
    private readonly usage: AiUsageService,
  ) {}
  @Get('providers') listProviders() {
    return this.providers.list();
  }
  @Get('provider-metrics') providerMetrics() {
    return this.providers.metrics();
  }
  @Get('usage-stats') usageStats(
    @Query('from') fromRaw?: string,
    @Query('to') toRaw?: string,
  ) {
    return this.usage.stats(...parseUsageRange(fromRaw, toRaw));
  }
  @Post('providers') createProvider(@Body() dto: CreateAiProviderDto) {
    return this.providers.create(dto);
  }
  @Post('providers/models/discover')
  @ExpensiveOperationRateLimit()
  discoverProviderModels(@Body() dto: DiscoverAiProviderModelsDto) {
    return this.providers.discoverModels(dto);
  }
  @Post('providers/test-config')
  @ExpensiveOperationRateLimit()
  testProviderConfiguration(@Body() dto: TestAiProviderConnectionDto) {
    return this.providers.testConfiguration(dto);
  }
  @Post('providers/:id/models/discover')
  @ExpensiveOperationRateLimit()
  discoverSavedProviderModels(@Param('id', ParseUUIDPipe) id: string) {
    return this.providers.discoverSavedModels(id);
  }
  @Post('providers/pricing/discover')
  @ExpensiveOperationRateLimit()
  discoverProviderPricing(@Body() dto: TestAiProviderConnectionDto) {
    return this.providers.discoverPricing(dto);
  }
  @Post('providers/:id/pricing/discover')
  @ExpensiveOperationRateLimit()
  discoverSavedProviderPricing(@Param('id', ParseUUIDPipe) id: string) {
    return this.providers.discoverSavedPricing(id);
  }
  @Patch('providers/:id') updateProvider(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAiProviderDto,
  ) {
    return this.providers.update(id, dto);
  }
  @Delete('providers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeProvider(@Param('id', ParseUUIDPipe) id: string) {
    return this.providers.remove(id);
  }
  @Post('providers/:id/test')
  @ExpensiveOperationRateLimit()
  testProvider(@Param('id', ParseUUIDPipe) id: string) {
    return this.providers.testConnection(id);
  }
  @Get('credit-users') searchUsers(@Query('query') query?: string) {
    return this.credits.searchUsers(query);
  }
  @Post('credits/grant') grant(
    @Body() dto: GrantAiCreditDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.credits.grant(dto.userId, dto.amount, admin.id, dto.note);
  }
}

const MAX_USAGE_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

/** Mặc định: đầu tháng hiện tại (UTC) → hiện tại. */
function parseUsageRange(fromRaw?: string, toRaw?: string): [Date, Date] {
  const to = toRaw ? new Date(toRaw) : new Date();
  const from = fromRaw ? new Date(fromRaw) : defaultUsageFrom();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()))
    throw new BadRequestException('Khoảng thời gian không hợp lệ');
  if (from > to)
    throw new BadRequestException('Thời điểm bắt đầu phải trước kết thúc');
  if (to.getTime() - from.getTime() > MAX_USAGE_RANGE_MS)
    throw new BadRequestException('Khoảng thống kê tối đa 366 ngày');
  return [from, to];
}

function defaultUsageFrom(): Date {
  const from = new Date();
  from.setUTCDate(1);
  from.setUTCHours(0, 0, 0, 0);
  return from;
}
