import { useEffect, useRef } from "react";
import type { Settings } from "../client/settings";

export interface AgentModelOption {
  value: string;
  label: string;
}

export const CLAUDE_MODELS: AgentModelOption[] = [
  { value: "", label: "SDK default" },
  { value: "claude-opus-4-7", label: "Opus 4.7" },
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];

export const EFFORT_LEVELS: { value: string; label: string }[] = [
  { value: "low", label: "low" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high" },
  { value: "xhigh", label: "xhigh" },
];

export const PERMISSION_MODES: { value: string; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "acceptEdits", label: "Auto-accept" },
];

interface Props {
  open: boolean;
  settings: Settings;
  onChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onClose: () => void;
  agent: string;
  model: string;
  effort: string;
  permissionMode: string;
  onModelChange: (model: string) => void;
  onEffortChange: (effort: string) => void;
  onPermissionModeChange: (mode: string) => void;
}

const PALETTES: {
  value: Settings["palette"];
  colors: [string, string, string];
}[] = [
  { value: "ember", colors: ["#c9a961", "#7a2418", "#1a1410"] },
  { value: "crimson", colors: ["#c9a961", "#9a2818", "#170c0a"] },
  { value: "forest", colors: ["#b89858", "#6a2818", "#0e1410"] },
  { value: "void", colors: ["#c9a961", "#5a5aa8", "#0c0c1a"] },
];

const HEADING_FONTS = ["Cinzel", "IM Fell DW Pica", "Cormorant Garamond"];
const BODY_FONTS = ["IM Fell English", "Cormorant Garamond", "IM Fell DW Pica"];
const STORY_MODES: Settings["storyMode"][] = ["typewriter", "illuminated", "instant"];

export default function SettingsMenu({
  open,
  settings,
  onChange,
  onClose,
  agent,
  model,
  effort,
  permissionMode,
  onModelChange,
  onEffortChange,
  onPermissionModeChange,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || active === root)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      restoreFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <button type="button" aria-label="Close settings" className="settings-scrim" onClick={onClose} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="settings-popover"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div className="settings-section">
          <div id="settings-palette-label" className="settings-label">
            Palette
          </div>
          {/* biome-ignore lint/a11y/useSemanticElements: fieldset would alter layout; div + role="group" preserves the flex row design */}
          <div className="settings-palette-row" role="group" aria-labelledby="settings-palette-label">
            {PALETTES.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-label={`${p.value} palette`}
                aria-pressed={settings.palette === p.value}
                className={`settings-palette ${settings.palette === p.value ? "active" : ""}`}
                onClick={() => onChange("palette", p.value)}
                title={p.value}
              >
                {p.colors.map((c) => (
                  <span key={c} className="settings-palette-swatch" style={{ background: c }} />
                ))}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <label htmlFor="settings-heading-font" className="settings-label">
            Heading font
          </label>
          <select
            id="settings-heading-font"
            className="settings-select"
            value={settings.headingFont}
            onChange={(e) => onChange("headingFont", e.target.value)}
          >
            {HEADING_FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div className="settings-section">
          <label htmlFor="settings-body-font" className="settings-label">
            Body font
          </label>
          <select
            id="settings-body-font"
            className="settings-select"
            value={settings.bodyFont}
            onChange={(e) => onChange("bodyFont", e.target.value)}
          >
            {BODY_FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div className="settings-section">
          <div id="settings-story-label" className="settings-label">
            Story reveal
          </div>
          <div className="settings-radio-row" role="radiogroup" aria-labelledby="settings-story-label">
            {STORY_MODES.map((m) => (
              // biome-ignore lint/a11y/useSemanticElements: pill-style buttons by design; native radios would lose the styling
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={settings.storyMode === m}
                className={`settings-radio ${settings.storyMode === m ? "active" : ""}`}
                onClick={() => onChange("storyMode", m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <label htmlFor="settings-ornament-density" className="settings-label">
            Ornament density
          </label>
          <input
            id="settings-ornament-density"
            type="range"
            min={0}
            max={10}
            step={1}
            value={settings.ornamentDensity}
            onChange={(e) => onChange("ornamentDensity", Number(e.target.value))}
          />
        </div>

        {agent === "claude" && (
          <>
            <div className="settings-section">
              <label htmlFor="settings-model" className="settings-label">
                Model
              </label>
              <select
                id="settings-model"
                className="settings-select"
                value={model}
                onChange={(e) => onModelChange(e.target.value)}
              >
                {CLAUDE_MODELS.map((m) => (
                  <option key={m.value || "default"} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-section">
              <div id="settings-effort-label" className="settings-label">
                Effort
              </div>
              <div className="settings-radio-row" role="radiogroup" aria-labelledby="settings-effort-label">
                {EFFORT_LEVELS.map((m) => (
                  // biome-ignore lint/a11y/useSemanticElements: pill-style buttons by design
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={effort === m.value}
                    className={`settings-radio ${effort === m.value ? "active" : ""}`}
                    onClick={() => onEffortChange(m.value)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <div id="settings-permission-label" className="settings-label">
                Permission mode
              </div>
              <div className="settings-radio-row" role="radiogroup" aria-labelledby="settings-permission-label">
                {PERMISSION_MODES.map((m) => (
                  // biome-ignore lint/a11y/useSemanticElements: pill-style buttons by design
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={permissionMode === m.value}
                    className={`settings-radio ${permissionMode === m.value ? "active" : ""}`}
                    onClick={() => onPermissionModeChange(m.value)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
