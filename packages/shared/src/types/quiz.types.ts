export type QuizStatus = "draft" | "published";
export type QuizVisibility = "private_class" | "assigned" | "public";
export type QuizLeaderboardMode = "hidden" | "visible_anonymized";
export type QuizQuestionType =
  "single_choice" | "true_false" | "multiple_choice";
export type QuizAssignmentTargetType = "classroom" | "student";
export type QuizAttemptStatus = "in_progress" | "submitted" | "expired";

export type QuizQuestionOptionInput = {
  id?: string;
  content: string;
  isCorrect: boolean;
};

export type QuizQuestionOption = QuizQuestionOptionInput & {
  id: string;
  displayOrder: number;
};

export type QuizQuestion = {
  id: string;
  type: QuizQuestionType;
  content: string;
  explanation: string | null;
  showExplanation: boolean;
  score: number;
  displayOrder: number;
  options: QuizQuestionOption[];
};

export type QuizSummary = {
  id: string;
  teacherId: string;
  title: string;
  description: string | null;
  status: QuizStatus;
  visibility: QuizVisibility;
  questionCount: number;
  totalScore: number;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QuizAssignment = {
  id: string;
  targetType: QuizAssignmentTargetType;
  classroomId: string | null;
  studentId: string | null;
  targetName: string;
  createdAt: string;
};

export type QuizDetail = QuizSummary & {
  timeLimitSeconds: number | null;
  opensAt: string | null;
  maxAttempts: number | null;
  leaderboardMode: QuizLeaderboardMode;
  answersChangedAt: string | null;
  lastRegradedAt: string | null;
  questions: QuizQuestion[];
  assignments: QuizAssignment[];
  isOwner: boolean;
};

export type CreateQuizRequest = { title: string; description?: string };
export type UpdateQuizRequest = { title?: string; description?: string | null };
export type ConfigureQuizRequest = {
  totalScore?: 10 | 100 | 1000;
  timeLimitSeconds?: number | null;
  opensAt?: string | null;
  dueAt?: string | null;
  maxAttempts?: number | null;
  visibility?: QuizVisibility;
  leaderboardMode?: QuizLeaderboardMode;
};
export type CreateQuizQuestionRequest = {
  type: QuizQuestionType;
  content: string;
  explanation?: string | null;
  showExplanation?: boolean;
  options: QuizQuestionOptionInput[];
};
export type UpdateQuizQuestionRequest = Partial<CreateQuizQuestionRequest>;
export type ReorderQuizQuestionsRequest = { questionIds: string[] };
export type CreateQuizAssignmentRequest = {
  targetType: QuizAssignmentTargetType;
  targetId: string;
};

export type StartQuizAttemptRequest = {
  quizId: string;
  guestToken?: string;
  guestName?: string;
};
export type SaveQuizAnswerRequest = { selectedOptionIds: string[] };
export type QuizAttemptQuestion = Omit<QuizQuestion, "options"> & {
  options: Array<Omit<QuizQuestionOption, "isCorrect">>;
};
export type QuizAttempt = {
  id: string;
  quizId: string;
  quizTitle: string;
  attemptNumber: number;
  status: QuizAttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  deadlineAt: string | null;
  score: number | null;
  maxScore: number;
  questions: QuizAttemptQuestion[];
  answers: Record<string, string[]>;
};
export type QuizAttemptResult = {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  status: QuizAttemptStatus;
  score: number;
  maxScore: number;
  timeTakenSeconds: number;
  answers: Array<{
    questionId: string;
    content: string;
    selectedOptionIds: string[];
    correctOptionIds: string[];
    isCorrect: boolean;
    scoreAwarded: number;
    explanation: string | null;
  }>;
};
export type QuizLeaderboardEntry = {
  rank: number;
  label: string;
  score: number;
  maxScore: number;
  timeTakenSeconds: number;
  submittedAt: string;
};
export type QuizResultRow = QuizLeaderboardEntry & {
  attemptId: string;
  identityName: string;
  attemptNumber: number;
};
