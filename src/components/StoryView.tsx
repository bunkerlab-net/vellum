import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "./icons";

export type RevealMode = "typewriter" | "illuminated" | "instant";

export interface ChoiceOption {
  text: string;
  sub?: string;
}

export interface AskQuestion {
  question: string;
  header?: string;
  multiSelect?: boolean;
  options: { label: string; description?: string }[];
}

export type Entry =
  | {
      id: number;
      type: "narrator";
      text: string;
      speaker?: string;
      dropCap?: boolean;
    }
  | { id: number; type: "user"; text: string }
  | {
      id: number;
      type: "choice";
      subtype?: "branch" | "skill" | "target";
      prompt?: string;
      options: ChoiceOption[];
      chosenIdx?: number | null;
    }
  | {
      id: number;
      type: "roll";
      label: string;
      modifier: number;
      result: number;
      total: number;
    }
  | {
      id: number;
      type: "ask";
      toolUseId: string;
      questions: AskQuestion[];
      answers: (string[] | null)[];
      submitted: boolean;
    };

interface StoryEntryProps {
  entry: Entry;
  revealMode: RevealMode;
  isLatest: boolean;
  playerName: string;
  onChoose?: (entryId: number, optIdx: number) => void;
  onAsk?: (entryId: number, questionIdx: number, label: string) => void;
  onAskSubmit?: (entryId: number) => void;
}

function StoryEntry({ entry, revealMode, isLatest, playerName, onChoose, onAsk, onAskSubmit }: StoryEntryProps) {
  const [revealed, setRevealed] = useState(!isLatest || revealMode === "instant");

  // biome-ignore lint/correctness/useExhaustiveDependencies: entry.id is the re-trigger for reveal animation on new entries
  useEffect(() => {
    if (!isLatest || revealMode === "instant") {
      setRevealed(true);
      return;
    }
    setRevealed(false);
    const t = setTimeout(() => setRevealed(true), 50);
    return () => clearTimeout(t);
  }, [entry.id, revealMode, isLatest]);

  const narratorText = entry.type === "narrator" ? entry.text : "";
  const dropCap =
    entry.type === "narrator" && revealMode === "illuminated" && entry.dropCap !== false && !entry.speaker;
  const textRef = useRef<HTMLDivElement>(null);

  const animatedCountRef = useRef(0);
  const prevRevealMode = useRef(revealMode);
  const prevEntryId = useRef(entry.id);

  // biome-ignore lint/correctness/useExhaustiveDependencies: entry.id and narratorText force re-stagger on new entry / streamed text
  useEffect(() => {
    const root = textRef.current;
    if (!root) return;
    const children = Array.from(root.children) as HTMLElement[];

    const modeChanged = prevRevealMode.current !== revealMode;
    const entryChanged = prevEntryId.current !== entry.id;
    prevRevealMode.current = revealMode;
    prevEntryId.current = entry.id;

    let startIdx = animatedCountRef.current;

    if (modeChanged || entryChanged) {
      // Re-animate every child from scratch
      startIdx = 0;
      for (const c of children) {
        c.style.animation = "none";
        c.style.removeProperty("opacity");
        c.style.removeProperty("--reveal-i");
      }
      void root.offsetHeight; // force reflow so re-applied animation restarts
      for (const c of children) {
        c.style.removeProperty("animation");
      }
    } else {
      // Streaming or quiet re-render: lock already-animated children so a
      // stray re-render can't replay their fade-in.
      for (let i = 0; i < startIdx; i++) {
        const c = children[i];
        if (!c) continue;
        c.style.animation = "none";
        c.style.opacity = "1";
      }
    }

    if (revealMode === "instant" || children.length === 0) {
      for (const c of children) {
        c.style.animation = "none";
        c.style.opacity = "1";
      }
      animatedCountRef.current = children.length;
      return;
    }

    const rect = root.getBoundingClientRect();
    const viewport = window.innerHeight || document.documentElement.clientHeight;
    const inView = rect.bottom > 0 && rect.top < viewport;

    for (let i = startIdx; i < children.length; i++) {
      const c = children[i];
      if (!c) continue;
      if (!inView) {
        c.style.animation = "none";
        c.style.opacity = "1";
        continue;
      }
      c.style.removeProperty("animation");
      c.style.removeProperty("opacity");
      c.style.setProperty("--reveal-i", String(i - startIdx));
    }

    animatedCountRef.current = children.length;
  }, [revealMode, entry.id, narratorText]);

  if (entry.type === "user") {
    return (
      <div className="story-block user-block">
        <div className="user-mark">
          <span className="user-mark-bar"></span>
          <span className="user-mark-label">{playerName}</span>
          <span className="user-mark-bar"></span>
        </div>
        <div className="user-text">{entry.text}</div>
      </div>
    );
  }

  if (entry.type === "choice") {
    const subtypeLabel = {
      branch: "The path forks",
      skill: "A check is called for",
      target: "Choose your mark",
    }[entry.subtype || "branch"];
    if (entry.chosenIdx != null) {
      const ch = entry.options[entry.chosenIdx];
      return (
        <div className="story-block choice-block chosen">
          <div className="choice-collapsed">
            <span className="choice-collapsed-mark">✦</span>
            <span className="choice-collapsed-label">Chose:</span>
            <span className="choice-collapsed-text">{ch?.text}</span>
          </div>
        </div>
      );
    }
    return (
      <div className="story-block choice-block">
        <div className="choice-card">
          <div className="choice-card-corner tl"></div>
          <div className="choice-card-corner tr"></div>
          <div className="choice-card-corner bl"></div>
          <div className="choice-card-corner br"></div>
          <div className="choice-header">
            <span className="choice-header-rule"></span>
            <span className="choice-header-label">{subtypeLabel}</span>
            <span className="choice-header-rule"></span>
          </div>
          {entry.prompt && <div className="choice-prompt">{entry.prompt}</div>}
          <div className="choice-options">
            {entry.options.map((opt, i) => (
              <button key={opt.text} type="button" className="choice-option" onClick={() => onChoose?.(entry.id, i)}>
                <span className="choice-initial">{i + 1}</span>
                <span className="choice-body">
                  <span className="choice-text">{opt.text}</span>
                  {opt.sub && <span className="choice-sub">{opt.sub}</span>}
                </span>
                <span className="choice-arrow">→</span>
              </button>
            ))}
          </div>
          <div className="choice-or">— or describe your own approach below —</div>
        </div>
      </div>
    );
  }

  if (entry.type === "ask") {
    const anyMultiSelect = entry.questions.some((q) => q.multiSelect);
    const allAnswered = entry.answers.every((a) => a !== null && a.length > 0);
    return (
      <div className="story-block choice-block">
        <div className="choice-card">
          <div className="choice-card-corner tl"></div>
          <div className="choice-card-corner tr"></div>
          <div className="choice-card-corner bl"></div>
          <div className="choice-card-corner br"></div>
          <div className="choice-header">
            <span className="choice-header-rule"></span>
            <span className="choice-header-label">The DM asks</span>
            <span className="choice-header-rule"></span>
          </div>
          {entry.questions.map((q, qi) => {
            const picks = entry.answers[qi] ?? [];
            const hint = q.multiSelect ? "Select any that apply" : null;
            return (
              <div key={q.question} className="ask-question">
                <div className="choice-prompt">{q.question}</div>
                {hint && <div className="ask-hint">{hint}</div>}
                <div className="choice-options">
                  {q.options.map((opt) => {
                    const picked = picks.includes(opt.label);
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        className={`choice-option ${picked ? "chosen" : ""}`}
                        disabled={entry.submitted}
                        onClick={() => onAsk?.(entry.id, qi, opt.label)}
                      >
                        <span className="choice-initial">
                          {q.multiSelect ? (picked ? "☑" : "☐") : picked ? "✓" : "·"}
                        </span>
                        <span className="choice-body">
                          <span className="choice-text">{opt.label}</span>
                          {opt.description && <span className="choice-sub">{opt.description}</span>}
                        </span>
                        <span className="choice-arrow">→</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {anyMultiSelect && !entry.submitted && (
            <button
              type="button"
              className="ask-submit"
              disabled={!allAnswered}
              onClick={() => onAskSubmit?.(entry.id)}
            >
              Submit
            </button>
          )}
        </div>
      </div>
    );
  }

  if (entry.type === "roll") {
    return (
      <div className="story-block roll-block">
        <div className="roll-card">
          <div className="roll-icon">
            <Icon.D20 s={28} />
          </div>
          <div className="roll-info">
            <div className="roll-label">{entry.label}</div>
            <div className="roll-detail">d20 · {entry.modifier >= 0 ? `+${entry.modifier}` : entry.modifier}</div>
          </div>
          <div className="roll-result">
            <div className={`roll-num ${entry.result === 20 ? "crit" : entry.result === 1 ? "fumble" : ""}`}>
              {entry.total}
            </div>
            <div className="roll-meta">
              {entry.result === 20 ? "Critical" : entry.result === 1 ? "Fumble" : `Roll ${entry.result}`}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // narrator
  if (entry.type !== "narrator") return null;

  return (
    <div className={`story-block narrator-block ${revealMode}${dropCap ? " has-drop-cap" : ""}`}>
      {entry.speaker && (
        <div className="speaker-tag">
          <span className="speaker-bullet"></span>
          <span>{entry.speaker}</span>
          <span className="speaker-bullet"></span>
        </div>
      )}
      <div ref={textRef} className={`narrator-text ${revealed ? "revealed" : "hidden-reveal"}`}>
        <ReactMarkdown key={revealMode} remarkPlugins={[remarkGfm]}>
          {narratorText}
        </ReactMarkdown>
      </div>
    </div>
  );
}

interface StoryViewProps {
  entries: Entry[];
  revealMode: RevealMode;
  playerName: string;
  chapterLabel: string;
  onChoose?: (entryId: number, optIdx: number) => void;
  onAsk?: (entryId: number, questionIdx: number, label: string) => void;
  onAskSubmit?: (entryId: number) => void;
}

export default function StoryView({
  entries,
  revealMode,
  playerName,
  chapterLabel,
  onChoose,
  onAsk,
  onAskSubmit,
}: StoryViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll-on-new-entry trigger
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [entries.length]);

  return (
    <div className="story-wrap">
      <div className="story-vignette"></div>
      <div className="story-scroll" ref={scrollRef}>
        <div className="chapter-mark">
          <div className="chapter-text">{chapterLabel}</div>
        </div>
        {entries.map((e, i) => (
          <StoryEntry
            key={e.id}
            entry={e}
            revealMode={revealMode}
            isLatest={i === entries.length - 1}
            playerName={playerName}
            onChoose={onChoose}
            onAsk={onAsk}
            onAskSubmit={onAskSubmit}
          />
        ))}
      </div>
    </div>
  );
}
