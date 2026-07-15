import type {
  ClassroomDetail,
  ClassroomJoinPreview,
  ClassroomMaterial,
  ClassroomSummary,
  CreateClassroomRequest,
  InviteStudentsRequest,
  InviteStudentsResponse,
  JoinClassroomByCodeRequest,
  JoinClassroomResult,
  RegenerateClassroomAccessResponse,
} from "@zunibee/shared";
import {
  API_URL,
  apiErrorFromResponse,
  apiFetch,
  createNetworkApiError,
} from "@/lib/api-client";

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

export function getClassroomMaterials(
  classroomId: string,
  accessToken?: string,
) {
  return apiFetch<ClassroomMaterial[]>(`/classrooms/${classroomId}/materials`, {
    accessToken,
  });
}

export function uploadClassroomMaterialFiles(
  classroomId: string,
  input: { description?: string; files: File[] },
  accessToken?: string,
) {
  const body = new FormData();
  if (input.description) body.set("description", input.description);
  input.files.forEach((file) => body.append("files", file));
  return apiFetch<ClassroomMaterial[]>(
    `/classrooms/${classroomId}/materials/files`,
    {
      method: "POST",
      body,
      accessToken,
    },
  );
}

export function createClassroomMaterialLink(
  classroomId: string,
  input: { title: string; description?: string; url: string },
  accessToken?: string,
) {
  return apiFetch<ClassroomMaterial>(
    `/classrooms/${classroomId}/materials/links`,
    {
      method: "POST",
      body: input,
      accessToken,
    },
  );
}

export function updateClassroomMaterial(
  classroomId: string,
  materialId: string,
  input: { title?: string; description?: string; url?: string },
  accessToken?: string,
) {
  return apiFetch<ClassroomMaterial>(
    `/classrooms/${classroomId}/materials/${materialId}`,
    { method: "PATCH", body: input, accessToken },
  );
}

export function deleteClassroomMaterial(
  classroomId: string,
  materialId: string,
  accessToken?: string,
) {
  return apiFetch<void>(`/classrooms/${classroomId}/materials/${materialId}`, {
    method: "DELETE",
    accessToken,
  });
}

export async function downloadClassroomMaterial(
  classroomId: string,
  material: ClassroomMaterial,
  accessToken?: string,
) {
  const blob = await fetchClassroomMaterialBlob(
    classroomId,
    material,
    accessToken,
  );
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = material.originalName || material.title;
  anchor.click();
  URL.revokeObjectURL(blobUrl);
}

export async function fetchClassroomMaterialBlob(
  classroomId: string,
  material: ClassroomMaterial,
  accessToken?: string,
) {
  const response = await fetch(
    `${API_URL}/classrooms/${classroomId}/materials/${material.id}/download`,
    {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      credentials: "include",
    },
  ).catch(() => {
    throw createNetworkApiError();
  });
  if (!response.ok) {
    throw await apiErrorFromResponse(response, "Không thể tải tài liệu");
  }
  return response.blob();
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
