import type {
  ClassroomDetail,
  ClassroomJoinPreview,
  ClassroomSummary,
  CreateClassroomRequest,
  InviteStudentsRequest,
  InviteStudentsResponse,
  JoinClassroomByCodeRequest,
  JoinClassroomResult,
  RegenerateClassroomAccessResponse,
} from "@zunibee/shared";
import { apiFetch } from "@/lib/api-client";

export type ClassroomJoinKind = "link" | "invitation";

export function getTeacherClassrooms(accessToken?: string) {
  return apiFetch<ClassroomSummary[]>("/classrooms/mine", { accessToken });
}

export function createClassroom(
  input: CreateClassroomRequest,
  accessToken?: string,
) {
  return apiFetch<ClassroomDetail>("/classrooms", {
    method: "POST",
    body: input,
    accessToken,
  });
}

export function getClassroom(classroomId: string, accessToken?: string) {
  return apiFetch<ClassroomDetail>(`/classrooms/${classroomId}`, {
    accessToken,
  });
}

export function inviteStudents(
  classroomId: string,
  input: InviteStudentsRequest,
  accessToken?: string,
) {
  return apiFetch<InviteStudentsResponse>(
    `/classrooms/${classroomId}/invitations`,
    {
      method: "POST",
      body: input,
      accessToken,
    },
  );
}

export function resendClassroomInvitation(
  classroomId: string,
  invitationId: string,
  accessToken?: string,
) {
  return apiFetch<void>(
    `/classrooms/${classroomId}/invitations/${invitationId}/resend`,
    { method: "POST", accessToken },
  );
}

export function revokeClassroomInvitation(
  classroomId: string,
  invitationId: string,
  accessToken?: string,
) {
  return apiFetch<void>(
    `/classrooms/${classroomId}/invitations/${invitationId}`,
    { method: "DELETE", accessToken },
  );
}

export function regenerateClassroomAccess(
  classroomId: string,
  accessToken?: string,
) {
  return apiFetch<RegenerateClassroomAccessResponse>(
    `/classrooms/${classroomId}/access/regenerate`,
    { method: "POST", accessToken },
  );
}

export function getStudentClassrooms(accessToken?: string) {
  return apiFetch<ClassroomSummary[]>("/classrooms/mine", { accessToken });
}

export function joinClassroomByCode(
  input: JoinClassroomByCodeRequest,
  accessToken?: string,
) {
  return apiFetch<JoinClassroomResult>("/classrooms/join/code", {
    method: "POST",
    body: input,
    accessToken,
  });
}

function classroomJoinPath(token: string, kind: ClassroomJoinKind): string {
  const encodedToken = encodeURIComponent(token);
  return kind === "invitation"
    ? `/classrooms/invitations/${encodedToken}`
    : `/classrooms/join/link/${encodedToken}`;
}

export function previewClassroomJoin(token: string, kind: ClassroomJoinKind) {
  return apiFetch<ClassroomJoinPreview>(
    `${classroomJoinPath(token, kind)}/preview`,
  );
}

export function acceptClassroomJoin(
  token: string,
  kind: ClassroomJoinKind,
  accessToken?: string,
) {
  const basePath = classroomJoinPath(token, kind);
  const acceptPath = kind === "invitation" ? `${basePath}/accept` : basePath;
  return apiFetch<JoinClassroomResult>(acceptPath, {
    method: "POST",
    accessToken,
  });
}
