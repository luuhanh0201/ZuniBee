import type { UserRole } from "../enums";

export type AuthUser = {
  id: string;
  email: string | null;
  fullName: string;
  role: UserRole;
  avatar: string | null;
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};

export type RegisterRequest = {
  email: string;
  password: string;
  fullName: string;
  role: UserRole.STUDENT | UserRole.TEACHER;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type ForgotPasswordRequest = {
  email: string;
};

export type ResetPasswordRequest = {
  email: string;
  tempPassword: string;
  newPassword: string;
};

export type ChangePasswordRequest = {
  /** Bỏ trống nếu tài khoản chưa từng đặt mật khẩu (đăng ký qua Google/Facebook). */
  currentPassword?: string;
  newPassword: string;
};
