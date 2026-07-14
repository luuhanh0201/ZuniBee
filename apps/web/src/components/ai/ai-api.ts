import type {
  AiCreditAccount,
  AiCreditAdminUser,
  AiCreditLedgerEntry,
  AiProvider,
  AiProviderMetrics,
  AiProviderPricingSuggestion,
  AiProviderTestResult,
  AiUsageStats,
  CreateAiProviderRequest,
  DiscoverAiProviderModelsRequest,
  DiscoverAiProviderModelsResponse,
  TestAiProviderConnectionRequest,
  TestAiProviderConnectionResponse,
  GenerateQuizWithAiRequest,
  GenerateQuizWithAiResponse,
  GrantAiCreditRequest,
  NotificationOutboxItem,
  QuizNotificationSummary,
  QuizWeaknessInsight,
  UpdateAiProviderRequest,
} from "@zunibee/shared";
import { apiFetch } from "@/lib/api-client";

export const getMyAiCredit = (token?: string) =>
  apiFetch<AiCreditAccount>("/ai/credits/me", { accessToken: token });
export const getMyAiCreditHistory = (token?: string) =>
  apiFetch<AiCreditLedgerEntry[]>("/ai/credits/history", {
    accessToken: token,
  });
export const generateQuizWithAi = (
  body: GenerateQuizWithAiRequest,
  file?: File,
  token?: string,
) => {
  const form = new FormData();
  form.append("title", body.title);
  form.append("topic", body.topic);
  form.append("questionCount", String(body.questionCount));
  if (body.description) form.append("description", body.description);
  if (body.language) form.append("language", body.language);
  if (body.difficulty) form.append("difficulty", body.difficulty);
  if (body.questionTypes)
    form.append("questionTypes", JSON.stringify(body.questionTypes));
  if (body.sourceType) form.append("sourceType", body.sourceType);
  if (file) form.append("file", file);
  return apiFetch<GenerateQuizWithAiResponse>("/ai/quiz-generations", {
    method: "POST",
    body: form,
    accessToken: token,
  });
};
export const getQuizInsight = (quizId: string, token?: string) =>
  apiFetch<QuizWeaknessInsight | null>(`/quizzes/${quizId}/ai-insight`, {
    accessToken: token,
  });
export const generateQuizInsight = (quizId: string, token?: string) =>
  apiFetch<QuizWeaknessInsight>(`/quizzes/${quizId}/ai-insight`, {
    method: "POST",
    accessToken: token,
  });
export const enqueueQuizResultNotifications = (
  quizId: string,
  token?: string,
) =>
  apiFetch<QuizNotificationSummary>(
    `/quizzes/${quizId}/notifications/results`,
    {
      method: "POST",
      accessToken: token,
    },
  );
export const listQuizResultNotifications = (quizId: string, token?: string) =>
  apiFetch<NotificationOutboxItem[]>(
    `/quizzes/${quizId}/notifications/results`,
    {
      accessToken: token,
    },
  );

export const adminListAiProviders = (token?: string) =>
  apiFetch<AiProvider[]>("/admin/ai/providers", { accessToken: token });
export const adminCreateAiProvider = (
  body: CreateAiProviderRequest,
  token?: string,
) =>
  apiFetch<AiProvider>("/admin/ai/providers", {
    method: "POST",
    body,
    accessToken: token,
  });
export const adminUpdateAiProvider = (
  id: string,
  body: UpdateAiProviderRequest,
  token?: string,
) =>
  apiFetch<AiProvider>(`/admin/ai/providers/${id}`, {
    method: "PATCH",
    body,
    accessToken: token,
  });
export const adminDeleteAiProvider = (id: string, token?: string) =>
  apiFetch<void>(`/admin/ai/providers/${id}`, {
    method: "DELETE",
    accessToken: token,
  });
export const adminTestAiProvider = (id: string, token?: string) =>
  apiFetch<AiProviderTestResult>(`/admin/ai/providers/${id}/test`, {
    method: "POST",
    accessToken: token,
  });
export const adminGetAiProviderMetrics = (token?: string) =>
  apiFetch<AiProviderMetrics>("/admin/ai/provider-metrics", {
    accessToken: token,
  });
export const adminDiscoverAiProviderModels = (
  body: DiscoverAiProviderModelsRequest,
  token?: string,
) =>
  apiFetch<DiscoverAiProviderModelsResponse>(
    "/admin/ai/providers/models/discover",
    {
      method: "POST",
      body,
      accessToken: token,
    },
  );
export const adminDiscoverSavedAiProviderModels = (
  id: string,
  token?: string,
) =>
  apiFetch<DiscoverAiProviderModelsResponse>(
    `/admin/ai/providers/${id}/models/discover`,
    { method: "POST", accessToken: token },
  );
export const adminTestAiProviderConfiguration = (
  body: TestAiProviderConnectionRequest,
  token?: string,
) =>
  apiFetch<TestAiProviderConnectionResponse>(
    "/admin/ai/providers/test-config",
    { method: "POST", body, accessToken: token },
  );
export const adminGetAiUsageStats = (
  params: { from?: string; to?: string },
  token?: string,
) => {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  const suffix = query.size ? `?${query.toString()}` : "";
  return apiFetch<AiUsageStats>(`/admin/ai/usage-stats${suffix}`, {
    accessToken: token,
  });
};
export const adminDiscoverAiProviderPricing = (
  body: TestAiProviderConnectionRequest,
  token?: string,
) =>
  apiFetch<AiProviderPricingSuggestion>(
    "/admin/ai/providers/pricing/discover",
    { method: "POST", body, accessToken: token },
  );
export const adminDiscoverSavedAiProviderPricing = (
  id: string,
  token?: string,
) =>
  apiFetch<AiProviderPricingSuggestion>(
    `/admin/ai/providers/${id}/pricing/discover`,
    { method: "POST", accessToken: token },
  );
export const adminSearchCreditUsers = (query: string, token?: string) =>
  apiFetch<AiCreditAdminUser[]>(
    `/admin/ai/credit-users?query=${encodeURIComponent(query)}`,
    { accessToken: token },
  );
export const adminGrantAiCredit = (
  body: GrantAiCreditRequest,
  token?: string,
) =>
  apiFetch<AiCreditAccount>("/admin/ai/credits/grant", {
    method: "POST",
    body,
    accessToken: token,
  });
