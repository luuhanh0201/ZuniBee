import type {
  AiCreditAccount,
  AiCreditAdminUserPage,
  AiCreditLedgerEntry,
  AiGenerationJob,
  AiProvider,
  AiProviderMetrics,
  AiProviderPricingSuggestion,
  AiProviderTestResult,
  AiUsageStats,
  AiUsageAnalytics,
  AiUsageAnalyticsFilters,
  AiUsageBudget,
  UpsertAiUsageBudgetRequest,
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
import {
  API_URL,
  apiErrorFromResponse,
  apiFetch,
  createNetworkApiError,
} from "@/lib/api-client";

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
  if (body.jobId) form.append("jobId", body.jobId);
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
export const getAiQuizGenerationJob = (jobId: string, token?: string) =>
  apiFetch<AiGenerationJob>(`/ai/quiz-generations/${jobId}`, {
    accessToken: token,
    suppressGlobalError: true,
  });
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
function analyticsQuery(params: Partial<AiUsageAnalyticsFilters>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query.size ? `?${query.toString()}` : "";
}
export const adminGetAiUsageAnalytics = (
  params: AiUsageAnalyticsFilters,
  token?: string,
) =>
  apiFetch<AiUsageAnalytics>(
    `/admin/ai/usage-analytics${analyticsQuery(params)}`,
    { accessToken: token },
  );
export const adminListAiUsageBudgets = (token?: string) =>
  apiFetch<AiUsageBudget[]>("/admin/ai/usage-budgets", {
    accessToken: token,
  });
export const adminCreateAiUsageBudget = (
  body: UpsertAiUsageBudgetRequest,
  token?: string,
) =>
  apiFetch<AiUsageBudget>("/admin/ai/usage-budgets", {
    method: "POST",
    body,
    accessToken: token,
  });
export const adminUpdateAiUsageBudget = (
  id: string,
  body: Partial<UpsertAiUsageBudgetRequest>,
  token?: string,
) =>
  apiFetch<AiUsageBudget>(`/admin/ai/usage-budgets/${id}`, {
    method: "PATCH",
    body,
    accessToken: token,
  });
export const adminDeleteAiUsageBudget = (id: string, token?: string) =>
  apiFetch<void>(`/admin/ai/usage-budgets/${id}`, {
    method: "DELETE",
    accessToken: token,
  });
export async function adminExportAiUsage(
  params: AiUsageAnalyticsFilters,
  token?: string,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/admin/ai/usage-export${analyticsQuery(params)}`,
    {
      credentials: "include",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  ).catch(() => {
    throw createNetworkApiError();
  });
  if (!response.ok) {
    throw await apiErrorFromResponse(response, "Không thể xuất file Excel");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `zunibee-ai-usage-${new Date().toISOString().slice(0, 10)}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
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
export const adminSearchCreditUsers = (
  query: string,
  pagination: { page?: number; pageSize?: number } = {},
  token?: string,
) => {
  const params = new URLSearchParams({ query });
  if (pagination.page) params.set("page", String(pagination.page));
  if (pagination.pageSize) params.set("pageSize", String(pagination.pageSize));
  return apiFetch<AiCreditAdminUserPage>(
    `/admin/ai/credit-users?${params.toString()}`,
    { accessToken: token },
  );
};
export const adminGrantAiCredit = (
  body: GrantAiCreditRequest,
  token?: string,
) =>
  apiFetch<AiCreditAccount>("/admin/ai/credits/grant", {
    method: "POST",
    body,
    accessToken: token,
  });
