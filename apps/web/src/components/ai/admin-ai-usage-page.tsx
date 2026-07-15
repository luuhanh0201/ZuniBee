"use client";

import { useAuth } from "@/lib/auth-context";
import { AdminAiUsageSection } from "./admin-ai-usage-section";

export function AdminAiUsagePage() {
  const { accessToken } = useAuth();
  return <AdminAiUsageSection accessToken={accessToken} />;
}
