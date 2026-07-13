"use client";
import { useState } from "react";
import { Plus, Save, X } from "lucide-react";
import type { CreateQuizQuestionRequest, QuizQuestion } from "@zunibee/shared";
import {
  INPUT_CLASS,
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
} from "@/components/classroom/classroom-ui";

export function QuizQuestionForm({
  initial,
  busy,
  onCancel,
  onSave,
}: {
  initial?: QuizQuestion | null;
  busy: boolean;
  onCancel?: () => void;
  onSave: (input: CreateQuizQuestionRequest) => void;
}) {
  const [type, setType] = useState<CreateQuizQuestionRequest["type"]>(
    initial?.type ?? "single_choice",
  );
  const [content, setContent] = useState(initial?.content ?? "");
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [showExplanation, setShowExplanation] = useState(
    initial?.showExplanation ?? true,
  );
  const [options, setOptions] = useState<
    Array<{ id?: string; content: string; isCorrect: boolean }>
  >(
    initial?.options.map((option) => ({
      id: option.id,
      content: option.content,
      isCorrect: option.isCorrect,
    })) ?? [
      { content: "", isCorrect: true },
      { content: "", isCorrect: false },
    ],
  );
  function setCorrect(index: number, checked: boolean) {
    setOptions((items) =>
      items.map((item, itemIndex) => ({
        ...item,
        isCorrect:
          type === "multiple_choice"
            ? itemIndex === index
              ? checked
              : item.isCorrect
            : itemIndex === index,
      })),
    );
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim() || options.some((o) => !o.content.trim())) return;
    onSave({
      type,
      content,
      explanation: explanation || null,
      showExplanation,
      options,
    });
  }
  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border-2 border-foreground bg-secondary-soft p-5"
    >
      <div className="flex justify-between">
        <h3 className="font-display text-xl font-extrabold">
          {initial ? "Sửa câu hỏi" : "Thêm câu hỏi"}
        </h3>
        {onCancel ? (
          <button type="button" onClick={onCancel} aria-label="Đóng">
            <X />
          </button>
        ) : null}
      </div>
      <label className="block font-bold">
        Loại câu
        <select
          className={`${INPUT_CLASS} mt-2`}
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          <option value="single_choice">Một đáp án</option>
          <option value="multiple_choice">Nhiều đáp án</option>
          <option value="true_false">Đúng / Sai</option>
        </select>
      </label>
      <label className="block font-bold">
        Nội dung
        <textarea
          className={`${INPUT_CLASS} mt-2 min-h-24`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </label>
      <fieldset>
        <legend className="font-bold">Lựa chọn</legend>
        <div className="mt-2 space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex gap-2">
              <input
                aria-label={`Đáp án đúng ${index + 1}`}
                type={type === "multiple_choice" ? "checkbox" : "radio"}
                name="correct"
                checked={option.isCorrect}
                onChange={(e) => setCorrect(index, e.target.checked)}
                className="h-5 w-5 self-center"
              />
              <input
                aria-label={`Lựa chọn ${index + 1}`}
                className={INPUT_CLASS}
                value={option.content}
                onChange={(e) =>
                  setOptions((items) =>
                    items.map((item, i) =>
                      i === index ? { ...item, content: e.target.value } : item,
                    ),
                  )
                }
              />
              {options.length > 2 ? (
                <button
                  type="button"
                  onClick={() =>
                    setOptions((items) => items.filter((_, i) => i !== index))
                  }
                  aria-label="Xóa lựa chọn"
                >
                  <X />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setOptions((items) => [...items, { content: "", isCorrect: false }])
          }
          className={`${SECONDARY_ACTION_CLASS} mt-3`}
        >
          <Plus className="h-4 w-4" />
          Lựa chọn
        </button>
      </fieldset>
      <label className="block font-bold">
        Giải thích
        <textarea
          className={`${INPUT_CLASS} mt-2 min-h-20`}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 font-bold">
        <input
          type="checkbox"
          checked={showExplanation}
          onChange={(e) => setShowExplanation(e.target.checked)}
        />
        Hiển thị giải thích sau khi nộp
      </label>
      <button disabled={busy} className={`${PRIMARY_ACTION_CLASS} w-full`}>
        <Save className="h-4 w-4" />
        {busy ? "Đang lưu..." : "Lưu câu hỏi"}
      </button>
    </form>
  );
}
