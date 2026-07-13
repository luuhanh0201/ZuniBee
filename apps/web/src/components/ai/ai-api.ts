import type {
  AiCreditAccount,
  AiCreditAdminUser,
  AiCreditLedgerEntry,
  AiProvider,
  CreateAiProviderRequest,
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
