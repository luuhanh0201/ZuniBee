export type ClassroomStatus = "active" | "archived";

export type ClassroomInvitationStatus =
  "pending" | "accepted" | "revoked" | "expired";

export type ClassroomInviteResultStatus =
  "added" | "invited" | "already_member" | "already_invited";

export type CreateClassroomRequest = {
  name: string;
  description?: string;
  subject?: string;
  grade?: string;
};

export type InviteStudentsRequest = {
  emails: string[];
};

export type JoinClassroomByCodeRequest = {
  code: string;
};

export type ClassroomTeacher = {
  id: string;
  fullName: string;
};

export type ClassroomMember = {
  id: string;
  userId: string;
  fullName: string;
  email: string | null;
  joinedAt: string;
};

export type ClassroomInvitation = {
  id: string;
  email: string;
  status: ClassroomInvitationStatus;
  expiresAt: string;
  createdAt: string;
};

export type ClassroomMaterial = {
  id: string;
  title: string;
  description: string | null;
  type: "link" | "file";
  url: string | null;
  originalName: string | null;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ClassroomQuiz = {
  id: string;
  title: string;
  description: string | null;
  questionCount: number;
  dueAt: string | null;
};

export type ClassroomSummary = {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  grade: string | null;
  status: ClassroomStatus;
  joinCode: string;
  joinUrl: string;
  memberCount: number;
  pendingInvitationCount: number;
  createdAt: string;
};

export type ClassroomDetail = ClassroomSummary & {
  teacher: ClassroomTeacher;
  members: ClassroomMember[];
  invitations: ClassroomInvitation[];
  materials: ClassroomMaterial[];
  quizzes: ClassroomQuiz[];
};

export type ClassroomInviteResult = {
  email: string;
  status: ClassroomInviteResultStatus;
};

export type InviteStudentsResponse = {
  results: ClassroomInviteResult[];
};

export type RegenerateClassroomAccessResponse = {
  joinCode: string;
  joinUrl: string;
};

export type ClassroomJoinPreview = {
  kind: "link" | "email";
  classroom: {
    id: string;
    name: string;
    subject: string | null;
    grade: string | null;
    teacherName: string;
  };
  invitedEmail: string | null;
  expiresAt: string | null;
};

export type JoinClassroomResult = {
  classroom: ClassroomSummary;
  alreadyMember: boolean;
};
