/**
 * Danh sách URL route của ZuniBee Web.
 *
 * Cập nhật file này khi thêm, đổi tên hoặc xóa một route trong `src/app`.
 * Các file đặc biệt như `not-found.tsx`, `forbidden.tsx` và
 * `unauthorized.tsx` là boundary của Next.js, không phải URL route độc lập.
 */
export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  onboarding: "/onboarding",
  studentDashboard: "/student",
  studentClasses: "/student/classes",
  teacherDashboard: "/teacher",
  teacherClasses: "/teacher/classes",
  teacherCreateClassroom: "/teacher/classes/new",
  joinClassroom: "/join",
  oauthCallback: "/oauth/callback",
  oauthSelectRole: "/oauth/select-role",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  changePassword: "/change-password",
  profile: "/profile",
} as const;

/** Danh sách phẳng, tiện dùng cho menu, kiểm tra quyền hoặc sitemap. */
export const APP_ROUTES = Object.values(ROUTES);

export type RouteName = keyof typeof ROUTES;
export type AppRoute = (typeof ROUTES)[RouteName];

export function teacherClassroomRoute(classroomId: string): string {
  return `${ROUTES.teacherClasses}/${encodeURIComponent(classroomId)}`;
}

export function joinClassroomRoute(
  token: string,
  type: "link" | "invitation" = "link",
): string {
  const path = `${ROUTES.joinClassroom}/${encodeURIComponent(token)}`;
  return type === "invitation" ? `${path}?type=invitation` : path;
}
