"use client";
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import type { QuizLeaderboardEntry } from "@zunibee/shared";
import { useAuth } from "@/lib/auth-context";
import { getQuizLeaderboard } from "./quiz-api";
export function QuizLeaderboard({ quizId }: { quizId: string }) {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<QuizLeaderboardEntry[] | null>(null);
  useEffect(() => {
    getQuizLeaderboard(quizId, accessToken ?? undefined)
      .then(setRows)
      .catch(() => setRows([]));
  }, [accessToken, quizId]);
  if (!rows?.length) return null;
  return (
    <section className="mt-7 rounded-2xl border-2 border-foreground bg-surface p-5 shadow-brutal-md">
      <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold">
        <Trophy className="h-6 w-6" />
        Bảng xếp hạng
      </h2>
      <ol className="mt-4 space-y-2">
        {rows.map((row) => (
          <li
            key={`${row.rank}-${row.label}`}
            className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-xl border-2 border-divider p-3"
          >
            <span className="font-display text-xl font-extrabold">
              #{row.rank}
            </span>
            <span className="font-bold">{row.label}</span>
            <span className="font-extrabold">
              {row.score}/{row.maxScore}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
