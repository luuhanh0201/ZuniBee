import type {
  AdminListUsersFilters,
  AdminUpdateUserRoleRequest,
  AdminUpdateUserStatusRequest,
  AdminUser,
  AdminUserDetail,
  AdminUserPage,
} from "@zunibee/shared";
import { apiFetch } from "@/lib/api-client";

export const adminListUsers = (
  filters: AdminListUsersFilters,
  token?: string,
) => {
  const query = new URLSearchParams();
  if (filters.query) query.set("query", filters.query);
  if (filters.role) query.set("role", filters.role);
  if (filters.status) query.set("status", filters.status);
  if (filters.page) query.set("page", String(filters.page));
  if (filters.pageSize) query.set("pageSize", String(filters.pageSize));
  const suffix = query.size ? `?${query.toString()}` : "";
  return apiFetch<AdminUserPage>(`/admin/users${suffix}`, {
    accessToken: token,
  });
};

export const adminGetUser = (id: string, token?: string) =>
  apiFetch<AdminUserDetail>(`/admin/users/${id}`, { accessToken: token });

export const adminUpdateUserStatus = (
  id: string,
  body: AdminUpdateUserStatusRequest,
  token?: string,
) =>
  apiFetch<AdminUser>(`/admin/users/${id}/status`, {
    method: "PATCH",
    body,
    accessToken: token,
  });

export const adminUpdateUserRole = (
  id: string,
  body: AdminUpdateUserRoleRequest,
  token?: string,
) =>
  apiFetch<AdminUser>(`/admin/users/${id}/role`, {
    method: "PATCH",
    body,
    accessToken: token,
  });

export const adminSoftDeleteUser = (id: string, token?: string) =>
  apiFetch<void>(`/admin/users/${id}`, {
    method: "DELETE",
    accessToken: token,
  });

export const adminRestoreUser = (id: string, token?: string) =>
  apiFetch<AdminUser>(`/admin/users/${id}/restore`, {
    method: "POST",
    accessToken: token,
  });

export const adminHardDeleteUser = (id: string, token?: string) =>
  apiFetch<void>(`/admin/users/${id}/permanent`, {
    method: "DELETE",
    accessToken: token,
  });
