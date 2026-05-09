import { useEffect, useMemo, useRef } from "react";
import type { Settings } from "../client/settings";
import Combobox from "./Combobox";

export interface AgentModelOption {
  value: string;
  label: string;
}

const AGENTS_WITH_EFFORT = new Set(["claude", "codex"]);
const AGENTS_WITH_PERMISSION_MODE = new Set(["claude", "codex"]);

export const EFFORT_LEVELS: { value: string; label: string }[] = [
  { value: "", label: "Inherit" },
  { value: "low", label: "low" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high" },
  { value: "xhigh", label: "xhigh" },
];

export const PERMISSION_MODES: { value: string; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "acceptEdits", label: "Auto-accept" },
];

const DEFAULT_LABEL_BY_AGENT: Record<string, string> = {
  claude: "Use SDK default",
  opencode: "Use OpenCode default",
  codex: "Use Codex default",
};

function findDefaultEntry(models: AgentModelOption[]): AgentModelOption | undefined {
  return models.find((m) => /default/i.test(m.label) || m.value === "default" || m.value === "");
}

interface Props {
  open: boolean;
  settings: Settings;
  onChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onClose: () => void;
  agent: string;
  model: string;
  effort: string;
  permissionMode: string;
  models: AgentModelOption[];
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
  models,
  onModelChange,
  onEffortChange,
  onPermissionModeChange,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const defaultEntry = useMemo(() => findDefaultEntry(models), [models]);
  const modelOptions = useMemo<AgentModelOption[]>(() => {
    if (defaultEntry) return models;
    const prefix: AgentModelOption = { value: "", label: DEFAULT_LABEL_BY_AGENT[agent] ?? "Use default" };
    return [prefix, ...models];
  }, [models, agent, defaultEntry]);
  const modelEmptyLabel = defaultEntry?.label ?? DEFAULT_LABEL_BY_AGENT[agent] ?? "Default";

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
          <Combobox
            id="settings-heading-font"
            options={HEADING_FONTS.map((f) => ({
              value: f,
              label: f,
              labelStyle: { fontFamily: `"${f}", serif` },
            }))}
            value={settings.headingFont}
            onChange={(v) => onChange("headingFont", v)}
          />
        </div>

        <div className="settings-section">
          <label htmlFor="settings-body-font" className="settings-label">
            Body font
          </label>
          <Combobox
            id="settings-body-font"
            options={BODY_FONTS.map((f) => ({
              value: f,
              label: f,
              labelStyle: { fontFamily: `"${f}", serif` },
            }))}
            value={settings.bodyFont}
            onChange={(v) => onChange("bodyFont", v)}
          />
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

        <div className="settings-section">
          <label htmlFor="settings-model" className="settings-label">
            Model
          </label>
          <Combobox
            id="settings-model"
            options={modelOptions}
            value={model}
            placeholder="Search models…"
            emptyLabel={modelEmptyLabel}
            onChange={onModelChange}
          />
        </div>

        {AGENTS_WITH_EFFORT.has(agent) && (
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
        )}

        {AGENTS_WITH_PERMISSION_MODE.has(agent) && (
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
        )}
      </div>
    </>
  );
}
