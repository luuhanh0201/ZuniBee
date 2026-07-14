"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectMenuOption = {
  value: string;
  label: string;
  /** Icon hiển thị bên phải label, ví dụ mức độ mạnh của model AI. */
  icon?: ReactNode;
  /** Tooltip hiển thị khi hover option. */
  title?: string;
};

type SelectMenuProps = {
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  className?: string;
};

/**
 * Dropdown thay thế <select> native để render được icon/màu trong option.
 * Giữ ngữ nghĩa listbox: điều hướng bằng bàn phím, aria-activedescendant,
 * đóng khi click ra ngoài hoặc nhấn Escape.
 */
export function SelectMenu({
  value,
  options,
  onChange,
  className = "",
}: SelectMenuProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex(
    (option) => option.value === value,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const openMenu = useCallback(() => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [selectedIndex]);

  const selectAt = useCallback(
    (index: number) => {
      const option = options[index];
      if (option) onChange(option.value);
      setOpen(false);
    },
    [onChange, options],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        selectAt(activeIndex);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open ? `${listboxId}-${activeIndex}` : undefined
        }
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className="flex min-h-12 w-full cursor-pointer items-center gap-2 rounded-xl border-2 border-foreground bg-surface px-3 text-left font-bold outline-none focus:ring-2 focus:ring-ring"
      >
        <span className="flex-1 truncate">{selected?.label ?? value}</span>
        {selected?.icon}
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-xl border-2 border-foreground bg-surface py-1 shadow-brutal-lg"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              title={option.title}
              ref={(node) => {
                if (open && index === activeIndex)
                  node?.scrollIntoView({ block: "nearest" });
              }}
              onPointerMove={() => setActiveIndex(index)}
              // preventDefault để label bao ngoài (nếu có) không forward thêm
              // một click sang button trigger làm menu mở lại ngay sau khi chọn.
              onClick={(event) => {
                event.preventDefault();
                selectAt(index);
              }}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2.5 font-semibold ${
                index === activeIndex ? "bg-secondary-soft" : ""
              }`}
            >
              <span className="flex-1 truncate">{option.label}</span>
              {option.icon}
              {option.value === value ? (
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
