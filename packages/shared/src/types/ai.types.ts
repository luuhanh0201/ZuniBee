import type { QuizDetail, QuizQuestionType } from "./quiz.types";

export type AiProviderKind = "ollama" | "openai_compatible";
export type AiProviderHealthStatus = "unknown" | "online" | "offline";
export type AiProvider = {
  id: string;
  name: string;
  kind: AiProviderKind;
  baseUrl: string;
  model: string;
  isActive: boolean;
  isDefault: boolean;
  hasApiKey: boolean;
  baseCreditCost: number;
  creditCostPer1kTokens: number;
  inputUsdPer1m: number | null;
  outputUsdPer1m: number | null;
  healthStatus: AiProviderHealthStatus;
  lastHealthLatencyMs: number | null;
  lastHealthCheckedAt: string | null;
  lastHealthError: string | null;
  requestCount: number;
  createdAt: string;
  updatedAt: string;
};
export type CreateAiProviderRequest = {
  name: string;
  kind: AiProviderKind;
  baseUrl: string;
  model: string;
  apiKey?: string;
  isActive?: boolean;
  isDefault?: boolean;
  baseCreditCost?: number;
  creditCostPer1kTokens?: number;
  inputUsdPer1m?: number | null;
  outputUsdPer1m?: number | null;
};
export type UpdateAiProviderRequest = Partial<CreateAiProviderRequest>;
export type AiProviderMetrics = {
  totalProviders: number;
  activeProviders: number;
  onlineProviders: number;
  requestsThisMonth: number;
  averageLatencyMs: number | null;
};
export type AiUsageSource =
  "quiz_generation" | "quiz_insight" | "document_vision_ocr";
export type AiUsageStatus =
  "success" | "failed" | "refused" | "timeout" | "invalid_output";
export type AiUsageBudgetScope = "global" | "provider" | "model" | "source";
export type AiUsageBudgetPeriod = "daily" | "monthly";
export type AiUsageStatRow = {
  providerId: string;
  providerName: string;
  model: string;
  source: AiUsageSource;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  /** null khi mọi event trong nhóm đều thiếu giá tại thời điểm gọi. */
  costUsd: number | null;
  unpricedRequests: number;
};
export type AiUsageStats = {
  from: string;
  to: string;
  totals: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    unpricedRequests: number;
  };
  rows: AiUsageStatRow[];
};
export type AiUsageAnalyticsFilters = {
  from: string;
  to: string;
  providerId?: string;
  model?: string;
  source?: AiUsageSource;
  status?: AiUsageStatus;
  search?: string;
  limit?: number;
  eventPage?: number;
  eventPageSize?: number;
};
export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export type AiUsageAnalyticsSummary = {
  requests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  inputTokens: number;
  outputTokens: number;
  cacheInputTokens: number;
  costUsd: number;
  unpricedRequests: number;
  averageLatencyMs: number | null;
  p95LatencyMs: number | null;
};
export type AiUsageTimeSeriesPoint = {
  bucket: string;
  requests: number;
  failedRequests: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};
export type AiUsageBreakdownRow = {
  key: string;
  label: string;
  requests: number;
  failedRequests: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  unpricedRequests: number;
  averageLatencyMs: number | null;
};
export type AiUsageEvent = {
  id: string;
  requestCount: number;
  providerId: string;
  providerName: string;
  model: string;
  source: AiUsageSource;
  status: AiUsageStatus;
  referenceId: string | null;
  userId: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheInputTokens: number;
  costUsd: number | null;
  latencyMs: number | null;
  httpStatus: number | null;
  finishReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
  createdAt: string;
};
export type AiUsageBudget = {
  id: string;
  name: string;
  scope: AiUsageBudgetScope;
  scopeValue: string | null;
  period: AiUsageBudgetPeriod;
  limitUsd: number;
  warningPercent: number;
  isActive: boolean;
  spentUsd: number;
  usagePercent: number;
  state: "safe" | "warning" | "exceeded";
  createdAt: string;
  updatedAt: string;
};
export type UpsertAiUsageBudgetRequest = {
  name: string;
  scope: AiUsageBudgetScope;
  scopeValue?: string | null;
  period: AiUsageBudgetPeriod;
  limitUsd: number;
  warningPercent?: number;
  isActive?: boolean;
};
export type AiUsageAnalytics = {
  from: string;
  to: string;
  granularity: "hour" | "day" | "month";
  summary: AiUsageAnalyticsSummary;
  previousSummary: AiUsageAnalyticsSummary;
  timeseries: AiUsageTimeSeriesPoint[];
  byProvider: AiUsageBreakdownRow[];
  byModel: AiUsageBreakdownRow[];
  bySource: AiUsageBreakdownRow[];
  byStatus: AiUsageBreakdownRow[];
  events: AiUsageEvent[];
  eventPagination: PaginationMeta;
  budgets: AiUsageBudget[];
};
export type AiProviderPricingSuggestion = {
  inputUsdPer1m: number | null;
  outputUsdPer1m: number | null;
  source: "openrouter" | null;
};
export type AiProviderTestResult = {
  ok: boolean;
  message: string;
  provider: AiProvider;
};
export type DiscoverAiProviderModelsRequest = {
  kind: AiProviderKind;
  baseUrl: string;
  apiKey?: string;
};
export type DiscoverAiProviderModelsResponse = {
  models: string[];
};
export type TestAiProviderConnectionRequest =
  DiscoverAiProviderModelsRequest & {
    model: string;
  };
export type TestAiProviderConnectionResponse = {
  ok: boolean;
  message: string;
  latencyMs: number | null;
};

export type AiCreditAccount = {
  userId: string;
  balance: number;
  reserved: number;
  available: number;
  updatedAt: string;
};
export type AiCreditLedgerKind = "grant" | "reserve" | "consume" | "release";
export type AiCreditLedgerEntry = {
  id: string;
  kind: AiCreditLedgerKind;
  amount: number;
  balanceAfter: number;
  reservedAfter: number;
  referenceType: string;
  referenceId: string;
  note: string | null;
  createdAt: string;
};
export type GrantAiCreditRequest = {
  userId: string;
  amount: number;
  note?: string;
};
export type AiCreditAdminUser = {
  id: string;
  email: string | null;
  fullName: string;
  role: string;
  credit: AiCreditAccount;
};
export type AiCreditAdminUserPage = {
  items: AiCreditAdminUser[];
  pagination: PaginationMeta;
  totals: {
    balance: number;
    reserved: number;
    available: number;
  };
  roleCounts: {
    student: number;
    teacher: number;
    admin: number;
  };
};

export type AiGenerationSourceType = "prompt" | "upload";
export type AiQuizLanguage = "auto" | "vi" | "en";
export type AiGenerationStatus = "pending" | "running" | "succeeded" | "failed";
export type GenerateQuizWithAiRequest = {
  title: string;
  description?: string;
  topic: string;
  language?: AiQuizLanguage;
  difficulty?: "easy" | "medium" | "hard";
  questionCount: number;
  questionTypes?: QuizQuestionType[];
  sourceType?: AiGenerationSourceType;
};
export type AiGenerationJob = {
  id: string;
  status: AiGenerationStatus;
  providerId: string;
  providerName: string;
  quizId: string | null;
  reservedCredits: number;
  chargedCredits: number;
  inputTokens: number;
  outputTokens: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};
export type GenerateQuizWithAiResponse = {
  job: AiGenerationJob;
  quiz: QuizDetail;
  credit: AiCreditAccount;
};

export type QuizWeaknessInsight = {
  id: string;
  quizId: string;
  status: AiGenerationStatus;
  summary: string | null;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  sampleSize: number;
  chargedCredits: number;
  errorMessage: string | null;
  generatedAt: string | null;
  createdAt: string;
};

export type NotificationOutboxStatus =
  "pending" | "processing" | "sent" | "failed";
export type QuizNotificationSummary = {
  queued: number;
  skippedGuests: number;
  alreadyQueued: number;
};
export type NotificationOutboxItem = {
  id: string;
  recipientEmail: string;
  status: NotificationOutboxStatus;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
};
