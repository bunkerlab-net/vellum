import { type CSSProperties, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Optional inline style for the option's label — used e.g. to preview font picks. */
  labelStyle?: CSSProperties;
}

interface Props {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  id?: string;
}

function fuzzyMatch(haystack: string, needle: string): boolean {
  if (!needle) return true;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  // Subsequence match: every char of needle appears in order somewhere in haystack.
  let i = 0;
  for (const ch of h) {
    if (ch === n[i]) {
      i++;
      if (i === n.length) return true;
    }
  }
  return i === n.length;
}

export default function Combobox({ options, value, onChange, placeholder, emptyLabel = "—", id }: Props) {
  const generatedId = useId();
  const buttonId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const [highlighted, setHighlighted] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const buttonLabel = selected?.label ?? (value || emptyLabel);

  const filtered = useMemo(
    () => options.filter((o) => fuzzyMatch(o.label, query) || fuzzyMatch(o.value, query)),
    [options, query],
  );

  useEffect(() => {
    if (!open) return;
    const btn = buttonRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setQuery("");
    setHighlighted(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("mousedown", onDocPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDocPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    setHighlighted((h) => Math.min(h, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const choose = (val: string) => {
    onChange(val);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onListKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlighted];
      if (opt) choose(opt.value);
    }
  };

  return (
    <>
      <button
        type="button"
        id={buttonId}
        ref={buttonRef}
        className="combobox-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="combobox-trigger-label" style={selected?.labelStyle}>
          {buttonLabel}
        </span>
        <span className="combobox-trigger-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={listRef}
            className="combobox-popover"
            style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
            role="listbox"
          >
            <input
              ref={inputRef}
              type="text"
              className="combobox-search"
              value={query}
              placeholder={placeholder ?? "Search…"}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onListKey}
            />
            <div className="combobox-options">
              {filtered.length === 0 ? (
                <div className="combobox-empty">No matches</div>
              ) : (
                filtered.map((opt, i) => (
                  <button
                    key={opt.value || `__${i}`}
                    type="button"
                    role="option"
                    aria-selected={opt.value === value}
                    className={`combobox-option ${i === highlighted ? "is-highlighted" : ""} ${opt.value === value ? "is-selected" : ""}`}
                    onMouseEnter={() => setHighlighted(i)}
                    onClick={() => choose(opt.value)}
                  >
                    <span className="combobox-option-mark">{opt.value === value ? "✓" : ""}</span>
                    <span className="combobox-option-label" style={opt.labelStyle}>
                      {opt.label}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
