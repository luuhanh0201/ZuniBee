"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
};

const focusClass =
  "focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  itemLabel = "bản ghi",
}: PaginationProps) {
  if (total === 0) return null;
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(safeTotalPages, Math.max(1, page));
  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(total, safePage * pageSize);
  const pages = pageWindow(safePage, safeTotalPages);

  return (
    <nav
      aria-label={`Phân trang ${itemLabel}`}
      className="flex flex-col gap-3 border-t-2 border-foreground bg-surface-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-muted-foreground">
        <span aria-live="polite">
          {from}–{to} / {total} {itemLabel}
        </span>
        {onPageSizeChange ? (
          <label className="flex items-center gap-2">
            Hiển thị
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className={`min-h-11 cursor-pointer rounded-xl border-2 border-foreground bg-background px-3 font-extrabold text-foreground outline-none ${focusClass}`}
              aria-label={`Số ${itemLabel} trên mỗi trang`}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            / trang
          </label>
        ) : null}
      </div>
      <div className="flex items-center gap-1 self-end sm:self-auto">
        <PageButton
          label="Trang trước"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </PageButton>
        {pages.map((value, index) =>
          value === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              aria-hidden="true"
              className="flex h-11 min-w-8 items-center justify-center font-extrabold text-muted-foreground"
            >
              …
            </span>
          ) : (
            <PageButton
              key={value}
              label={`Trang ${value}`}
              current={value === safePage}
              onClick={() => onPageChange(value)}
            >
              {value}
            </PageButton>
          ),
        )}
        <PageButton
          label="Trang sau"
          disabled={safePage >= safeTotalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </PageButton>
      </div>
    </nav>
  );
}

function PageButton({
  label,
  disabled = false,
  current = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  current?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border-2 border-foreground px-2 font-extrabold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${current ? "bg-primary shadow-brutal-sm" : "bg-surface hover:bg-background"} ${focusClass}`}
    >
      {children}
    </button>
  );
}

function pageWindow(
  current: number,
  total: number,
): Array<number | "ellipsis"> {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const values = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...values]
    .filter((value) => value >= 1 && value <= total)
    .sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push("ellipsis");
    result.push(value);
  });
  return result;
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(totalPages, Math.max(1, page));
  return {
    items: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    pagination: {
      page: safePage,
      pageSize,
      total: items.length,
      totalPages,
    },
  };
}
