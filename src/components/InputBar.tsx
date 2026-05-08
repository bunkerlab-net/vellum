import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

interface Props {
  onSend: (text: string) => void;
  onRoll: () => void;
  disabled: boolean;
}

export default function InputBar({ onSend, onRoll, disabled }: Props) {
  const [val, setVal] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (!val.trim() || disabled) return;
    onSend(val.trim());
    setVal("");
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-fit textarea height whenever value changes
  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = `${Math.min(taRef.current.scrollHeight, 140)}px`;
    }
  }, [val]);

  return (
    <div className="input-bar">
      <div className="input-bar-deco-l"></div>
      <button
        type="button"
        className="input-rune"
        onClick={onRoll}
        disabled={disabled}
        aria-disabled={disabled}
        title="Roll d20"
      >
        <Icon.D20 s={22} />
      </button>
      <div className="input-divider"></div>
      <textarea
        ref={taRef}
        className="input-ta"
        placeholder="What do you do? (Enter to send · Shift+Enter for new line)"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={onKey}
        rows={1}
        disabled={disabled}
      />
      <button type="button" className={`input-send ${disabled ? "disabled" : ""}`} onClick={submit} disabled={disabled}>
        <span>Speak</span>
        <Icon.Send s={16} />
      </button>
      <div className="input-bar-deco-r"></div>
    </div>
  );
}
