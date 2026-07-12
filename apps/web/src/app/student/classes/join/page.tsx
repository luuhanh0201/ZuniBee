import type { Metadata } from "next";
import { UserRole } from "@zunibee/shared";
import { RequireRole } from "@/components/auth/require-role";
import { JoinCodeForm } from "@/components/classroom/join-code-form";
import {
  StudentClassroomFrame,
  StudentClassroomPageHeader,
} from "@/components/classroom/student-classroom-frame";

export const metadata: Metadata = {
  title: "Tham gia lớp — ZuniBee",
  description: "Nhập mã giáo viên cung cấp để tham gia lớp học ZuniBee.",
};

export default function JoinStudentClassPage() {
  return (
    <RequireRole role={UserRole.STUDENT}>
      <StudentClassroomFrame>
        <StudentClassroomPageHeader
          title="Tham gia lớp học"
          description="Nhập mã lớp do giáo viên cung cấp. Bạn chỉ cần xác nhận một lần."
          backHref="/student/classes"
          backLabel="Về danh sách lớp"
        />
        <div className="mx-auto max-w-3xl">
          <JoinCodeForm />
        </div>
      </StudentClassroomFrame>
    </RequireRole>
  );
}
