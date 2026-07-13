import type {
  ConfigureQuizRequest,
  CreateQuizAssignmentRequest,
  CreateQuizQuestionRequest,
  CreateQuizRequest,
  QuizAssignment,
  QuizAttempt,
  QuizAttemptResult,
  QuizDetail,
  QuizLeaderboardEntry,
  QuizResultRow,
  QuizSummary,
  SaveQuizAnswerRequest,
  StartQuizAttemptRequest,
  UpdateQuizQuestionRequest,
  UpdateQuizRequest,
} from "@zunibee/shared";
import { apiFetch } from "@/lib/api-client";

export const listQuizzes = (token?: string) =>
  apiFetch<QuizSummary[]>("/quizzes", { accessToken: token });
export const getQuiz = (id: string, token?: string) =>
  apiFetch<QuizDetail>(`/quizzes/${id}`, { accessToken: token });
export const createQuiz = (body: CreateQuizRequest, token?: string) =>
  apiFetch<QuizDetail>("/quizzes", {
    method: "POST",
    body,
    accessToken: token,
  });
export const updateQuiz = (
  id: string,
  body: UpdateQuizRequest,
  token?: string,
) =>
  apiFetch<QuizDetail>(`/quizzes/${id}`, {
    method: "PATCH",
    body,
    accessToken: token,
  });
export const configureQuiz = (
  id: string,
  body: ConfigureQuizRequest,
  token?: string,
) =>
  apiFetch<QuizDetail>(`/quizzes/${id}/configure`, {
    method: "PATCH",
    body,
    accessToken: token,
  });
export const addQuizQuestion = (
  id: string,
  body: CreateQuizQuestionRequest,
  token?: string,
) =>
  apiFetch<QuizDetail>(`/quizzes/${id}/questions`, {
    method: "POST",
    body,
    accessToken: token,
  });
export const updateQuizQuestion = (
  id: string,
  questionId: string,
  body: UpdateQuizQuestionRequest,
  token?: string,
) =>
  apiFetch<QuizDetail>(`/quizzes/${id}/questions/${questionId}`, {
    method: "PATCH",
    body,
    accessToken: token,
  });
export const deleteQuizQuestion = (
  id: string,
  questionId: string,
  token?: string,
) =>
  apiFetch<QuizDetail>(`/quizzes/${id}/questions/${questionId}`, {
    method: "DELETE",
    accessToken: token,
  });
export const reorderQuizQuestions = (
  id: string,
  questionIds: string[],
  token?: string,
) =>
  apiFetch<QuizDetail>(`/quizzes/${id}/questions/reorder`, {
    method: "PATCH",
    body: { questionIds },
    accessToken: token,
  });
export const publishQuiz = (id: string, publish: boolean, token?: string) =>
  apiFetch<QuizDetail>(`/quizzes/${id}/${publish ? "publish" : "unpublish"}`, {
    method: "POST",
    accessToken: token,
  });
export const addQuizAssignment = (
  id: string,
  body: CreateQuizAssignmentRequest,
  token?: string,
) =>
  apiFetch<QuizAssignment[]>(`/quizzes/${id}/assignments`, {
    method: "POST",
    body,
    accessToken: token,
  });
export const deleteQuizAssignment = (
  id: string,
  assignmentId: string,
  token?: string,
) =>
  apiFetch<void>(`/quizzes/${id}/assignments/${assignmentId}`, {
    method: "DELETE",
    accessToken: token,
  });
export const regradeQuiz = (id: string, token?: string) =>
  apiFetch<{ regradedAttempts: number }>(`/quizzes/${id}/regrade`, {
    method: "POST",
    accessToken: token,
  });
export const getQuizResults = (id: string, token?: string) =>
  apiFetch<QuizResultRow[]>(`/quizzes/${id}/results`, { accessToken: token });
export const startQuizAttempt = (
  body: StartQuizAttemptRequest,
  token?: string,
) =>
  apiFetch<QuizAttempt>("/quiz-attempts", {
    method: "POST",
    body,
    accessToken: token,
  });
export const getQuizAttempt = (id: string, token?: string) =>
  apiFetch<QuizAttempt>(`/quiz-attempts/${id}`, { accessToken: token });
export const saveQuizAnswer = (
  id: string,
  questionId: string,
  body: SaveQuizAnswerRequest,
  token?: string,
) =>
  apiFetch<QuizAttempt>(`/quiz-attempts/${id}/answers/${questionId}`, {
    method: "PATCH",
    body,
    accessToken: token,
  });
export const submitQuizAttempt = (id: string, token?: string) =>
  apiFetch<QuizAttemptResult>(`/quiz-attempts/${id}/submit`, {
    method: "POST",
    accessToken: token,
  });
export const getQuizAttemptResult = (id: string, token?: string) =>
  apiFetch<QuizAttemptResult>(`/quiz-attempts/${id}/result`, {
    accessToken: token,
  });
export const getQuizLeaderboard = (quizId: string, token?: string) =>
  apiFetch<QuizLeaderboardEntry[]>(
    `/quiz-attempts/quiz/${quizId}/leaderboard`,
    { accessToken: token },
  );
