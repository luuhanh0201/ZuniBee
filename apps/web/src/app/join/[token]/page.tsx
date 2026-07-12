import type { Metadata } from "next";
import { ClassroomJoinPage } from "@/components/classroom/classroom-join-page";

export const metadata: Metadata = {
  title: "Tham gia lớp học — ZuniBee",
  description: "Xem trước và xác nhận tham gia một lớp học trên ZuniBee.",
};

type JoinPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ type?: string | string[] }>;
};

export default async function JoinPage({
  params,
  searchParams,
}: JoinPageProps) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const requestedType = Array.isArray(query.type) ? query.type[0] : query.type;
  const kind = requestedType === "invitation" ? "invitation" : "link";

  return <ClassroomJoinPage token={token} kind={kind} />;
}
