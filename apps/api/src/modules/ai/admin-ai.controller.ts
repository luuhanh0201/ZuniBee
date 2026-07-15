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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  UserRole,
  type AiUsageAnalyticsFilters,
  type AiUsageSource,
  type AiUsageStatus,
} from '@zunibee/shared';
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
import { UpsertAiUsageBudgetDto } from './dto/upsert-ai-usage-budget.dto';
import { UpdateAiUsageBudgetDto } from './dto/update-ai-usage-budget.dto';

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
  @Get('usage-analytics') usageAnalytics(
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.usage.analytics(parseAnalyticsFilters(query));
  }
  @Get('usage-export') async usageExport(
    @Query() query: Record<string, string | undefined>,
    @Res() response: Response,
  ) {
    const file = await this.usage.exportExcel(parseAnalyticsFilters(query));
    const stamp = new Date().toISOString().slice(0, 10);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="zunibee-ai-usage-${stamp}.xlsx"`,
    );
    response.send(file);
  }
  @Get('usage-budgets') listUsageBudgets() {
    return this.usage.listBudgets();
  }
  @Post('usage-budgets') createUsageBudget(
    @Body() dto: UpsertAiUsageBudgetDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.usage.createBudget(dto, admin.id);
  }
  @Patch('usage-budgets/:id') updateUsageBudget(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAiUsageBudgetDto,
  ) {
    return this.usage.updateBudget(id, dto);
  }
  @Delete('usage-budgets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeUsageBudget(@Param('id', ParseUUIDPipe) id: string) {
    return this.usage.deleteBudget(id);
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
  @Get('credit-users') searchUsers(
    @Query('query') query?: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    return this.credits.searchUsers(
      query,
      parsePositiveInteger(pageRaw, 1, 100_000, 'Trang'),
      parsePositiveInteger(pageSizeRaw, 20, 100, 'Kích thước trang'),
    );
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

const AI_USAGE_SOURCES: AiUsageSource[] = [
  'quiz_generation',
  'quiz_insight',
  'document_vision_ocr',
];
const AI_USAGE_STATUSES: AiUsageStatus[] = [
  'success',
  'failed',
  'refused',
  'timeout',
  'invalid_output',
];

function parseAnalyticsFilters(
  query: Record<string, string | undefined>,
): AiUsageAnalyticsFilters {
  const [from, to] = parseUsageRange(query.from, query.to);
  if (query.source && !AI_USAGE_SOURCES.includes(query.source as AiUsageSource))
    throw new BadRequestException('Nguồn usage không hợp lệ');
  if (
    query.status &&
    !AI_USAGE_STATUSES.includes(query.status as AiUsageStatus)
  )
    throw new BadRequestException('Trạng thái usage không hợp lệ');
  if (query.providerId && !UUID_V4_PATTERN.test(query.providerId))
    throw new BadRequestException('Provider ID không hợp lệ');
  const limit = query.limit ? Number(query.limit) : 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000)
    throw new BadRequestException('Giới hạn bản ghi phải từ 1 đến 5000');
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    providerId: query.providerId || undefined,
    model: query.model?.trim().slice(0, 200) || undefined,
    source: query.source as AiUsageSource | undefined,
    status: query.status as AiUsageStatus | undefined,
    search: query.search?.trim().slice(0, 200) || undefined,
    limit,
    eventPage: parsePositiveInteger(
      query.eventPage,
      1,
      100_000,
      'Trang usage event',
    ),
    eventPageSize: parsePositiveInteger(
      query.eventPageSize,
      Math.min(limit, 20),
      100,
      'Kích thước trang usage event',
    ),
  };
}

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parsePositiveInteger(
  raw: string | undefined,
  fallback: number,
  max: number,
  label: string,
): number {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > max)
    throw new BadRequestException(`${label} phải là số nguyên từ 1 đến ${max}`);
  return value;
}
