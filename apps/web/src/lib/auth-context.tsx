"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  UserRole,
  type AuthResponse,
  type AuthUser,
  type LoginRequest,
  type RegisterRequest,
  type ForgotPasswordRequest,
  type ResetPasswordRequest,
  type ChangePasswordRequest,
  type SelectRoleRequest,
  type UpdateProfileRequest,
  type UploadFileResponse,
} from "@zunibee/shared";
import { apiFetch, ApiError } from "./api-client";

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  /** true khi đang thử khôi phục phiên đăng nhập lúc tải trang lần đầu. */
  isLoading: boolean;
  login: (input: LoginRequest) => Promise<AuthUser>;
  register: (input: RegisterRequest) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Dùng cho trang /oauth/callback để nạp access token nhận từ redirect OAuth. */
  setSession: (accessToken: string) => Promise<AuthUser | null>;
  forgotPassword: (input: ForgotPasswordRequest) => Promise<void>;
  resetPassword: (input: ResetPasswordRequest) => Promise<AuthUser>;
  changePassword: (input: ChangePasswordRequest) => Promise<void>;
  selectRole: (input: SelectRoleRequest) => Promise<AuthUser>;
  updateProfile: (input: UpdateProfileRequest) => Promise<AuthUser>;
  uploadAvatar: (file: File) => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async (token: string) => {
    const me = await apiFetch<AuthUser>("/auth/me", { accessToken: token });
    setUser(me);
    return me;
  }, []);

  // Khôi phục phiên đăng nhập từ refresh token (httpOnly cookie) khi tải trang.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<AuthResponse>("/auth/refresh", {
          method: "POST",
        });
        if (cancelled) return;
        setAccessToken(res.accessToken);
        setUser(res.user);
      } catch {
        // Chưa đăng nhập hoặc phiên hết hạn — bỏ qua, coi như chưa đăng nhập.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async ({ email, password }: LoginRequest) => {
    const res = await apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (input: RegisterRequest) => {
    const res = await apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      body: input,
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        accessToken: accessToken ?? undefined,
      });
    } catch {
      // Kể cả khi API lỗi vẫn xoá phiên phía client.
    }
    setAccessToken(null);
    setUser(null);
  }, [accessToken]);

  const setSession = useCallback(
    async (token: string) => {
      setAccessToken(token);
      try {
        return await fetchMe(token);
      } catch {
        setAccessToken(null);
        setUser(null);
        return null;
      }
    },
    [fetchMe],
  );

  const forgotPassword = useCallback(async (input: ForgotPasswordRequest) => {
    await apiFetch("/auth/forgot-password", { method: "POST", body: input });
  }, []);

  const resetPassword = useCallback(async (input: ResetPasswordRequest) => {
    const res = await apiFetch<AuthResponse>("/auth/reset-password", {
      method: "POST",
      body: input,
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const changePassword = useCallback(
    async (input: ChangePasswordRequest) => {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: input,
        accessToken: accessToken ?? undefined,
      });
    },
    [accessToken],
  );

  const selectRole = useCallback(
    async (input: SelectRoleRequest) => {
      const res = await apiFetch<AuthResponse>("/auth/select-role", {
        method: "POST",
        body: input,
        accessToken: accessToken ?? undefined,
      });
      setAccessToken(res.accessToken);
      setUser(res.user);
      return res.user;
    },
    [accessToken],
  );

  const updateProfile = useCallback(
    async (input: UpdateProfileRequest) => {
      const updatedUser = await apiFetch<AuthUser>("/users/me", {
        method: "PATCH",
        body: input,
        accessToken: accessToken ?? undefined,
      });
      setUser(updatedUser);
      return updatedUser;
    },
    [accessToken],
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const result = await apiFetch<UploadFileResponse>("/upload-file/avatar", {
        method: "POST",
        body: form,
        accessToken: accessToken ?? undefined,
      });
      return result.url;
    },
    [accessToken],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isLoading,
      login,
      register,
      logout,
      setSession,
      forgotPassword,
      resetPassword,
      changePassword,
      selectRole,
      updateProfile,
      uploadAvatar,
    }),
    [
      user,
      accessToken,
      isLoading,
      login,
      register,
      logout,
      setSession,
      forgotPassword,
      resetPassword,
      changePassword,
      selectRole,
      updateProfile,
      uploadAvatar,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải được dùng trong <AuthProvider>");
  return ctx;
}

export { ApiError };
export { UserRole };
export type { AuthUser };
