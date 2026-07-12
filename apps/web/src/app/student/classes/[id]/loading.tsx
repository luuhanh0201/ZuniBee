import { ClassroomLoadingState } from "@/components/classroom/classroom-ui";
import { StudentClassroomFrame } from "@/components/classroom/student-classroom-frame";

export default function StudentClassroomDetailLoading() {
  return (
    <StudentClassroomFrame>
      <ClassroomLoadingState label="Đang mở lớp học..." />
    </StudentClassroomFrame>
  );
}
