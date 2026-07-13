"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Save } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { teacherQuizRoute } from "@/config/routes";
import {
  TeacherClassroomFrame,
  INPUT_CLASS,
  PRIMARY_ACTION_CLASS,
} from "@/components/classroom/classroom-ui";
import { getErrorMessage } from "@/components/classroom/classroom-utils";
import { createQuiz } from "./quiz-api";
export function CreateQuizForm() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const lock = useRef(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || !title.trim()) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const quiz = await createQuiz(
        { title, description },
        accessToken ?? undefined,
      );
      router.push(teacherQuizRoute(quiz.id));
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <TeacherClassroomFrame>
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-4xl font-extrabold">Tạo quiz mới</h1>
        <form
          onSubmit={submit}
          className="mt-7 space-y-5 rounded-2xl border-2 border-foreground bg-surface p-6 shadow-brutal-lg"
        >
          <label className="block font-extrabold">
            Tiêu đề
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`${INPUT_CLASS} mt-2`}
              maxLength={200}
            />
          </label>
          <label className="block font-extrabold">
            Mô tả
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${INPUT_CLASS} mt-2 min-h-32`}
            />
          </label>
          {error ? (
            <p
              className="rounded-xl bg-destructive-soft p-3 font-bold"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <button
            disabled={busy || !title.trim()}
            className={`${PRIMARY_ACTION_CLASS} w-full`}
          >
            <Save className="h-5 w-5" />
            {busy ? "Đang tạo..." : "Tạo và soạn quiz"}
          </button>
        </form>
      </div>
    </TeacherClassroomFrame>
  );
}
