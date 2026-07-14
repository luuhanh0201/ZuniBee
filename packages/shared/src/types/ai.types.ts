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
export type AiUsageSource = "quiz_generation" | "quiz_insight";
export type AiUsageStatRow = {
  providerId: string;
  providerName: string;
  model: string;
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

export type AiGenerationSourceType = "prompt" | "upload";
export type AiGenerationStatus = "pending" | "running" | "succeeded" | "failed";
export type GenerateQuizWithAiRequest = {
  title: string;
  description?: string;
  topic: string;
  language?: string;
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
