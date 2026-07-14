import { UserRole } from "@zunibee/shared";
import { RequireRole } from "@/components/auth/require-role";
import { AdminAiConsole } from "@/components/ai/admin-ai-console";
export default function AdminAiPage() {
  return (
    <RequireRole role={UserRole.ADMIN} allowDemo={false}>
      <AdminAiConsole />
    </RequireRole>
  );
}
