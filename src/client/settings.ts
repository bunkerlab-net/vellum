import { useEffect, useState } from "react";

export interface Settings {
  palette: "ember" | "crimson" | "forest" | "void";
  headingFont: string;
  bodyFont: string;
  storyMode: "typewriter" | "illuminated" | "instant";
  ornamentDensity: number;
  soundOn: boolean;
}

const KEY = "vellum.settings";

const DEFAULTS: Settings = {
  palette: "ember",
  headingFont: "Cinzel",
  bodyFont: "IM Fell English",
  storyMode: "illuminated",
  ornamentDensity: 6,
  soundOn: true,
};

const PALETTES: Record<Settings["palette"], Record<string, string>> = {
  ember: {
    "--bg": "#100a06",
    "--bg-2": "#1a1410",
    "--bg-panel": "#15100b",
    "--ink": "#0a0604",
    "--parchment": "#e8d9b0",
    "--parchment-dim": "#b8a880",
    "--gold": "#c9a961",
    "--gold-bright": "#e8c878",
    "--blood": "#d96a4a",
    "--arcane": "#5a7aa8",
    "--rare": "#5e7fb8",
    "--uncommon": "#6a8a4a",
    "--common": "#a89878",
  },
  crimson: {
    "--bg": "#0d0807",
    "--bg-2": "#1a0e0c",
    "--bg-panel": "#170c0a",
    "--ink": "#0a0403",
    "--parchment": "#e8d4ae",
    "--parchment-dim": "#b89c70",
    "--gold": "#c9a961",
    "--gold-bright": "#e8c878",
    "--blood": "#e87060",
    "--arcane": "#7a4a8a",
    "--rare": "#a85e7f",
    "--uncommon": "#8a6a4a",
    "--common": "#a89878",
  },
  forest: {
    "--bg": "#0a0e0a",
    "--bg-2": "#101a14",
    "--bg-panel": "#0e1410",
    "--ink": "#040804",
    "--parchment": "#dfd4a8",
    "--parchment-dim": "#a89c70",
    "--gold": "#b89858",
    "--gold-bright": "#d8b878",
    "--blood": "#c66848",
    "--arcane": "#4a8a7a",
    "--rare": "#5e9f7f",
    "--uncommon": "#7a9a4a",
    "--common": "#98a878",
  },
  void: {
    "--bg": "#080814",
    "--bg-2": "#10101e",
    "--bg-panel": "#0c0c1a",
    "--ink": "#040408",
    "--parchment": "#d4ccd8",
    "--parchment-dim": "#9890a0",
    "--gold": "#c9a961",
    "--gold-bright": "#e8c878",
    "--blood": "#c870c8",
    "--arcane": "#5a5aa8",
    "--rare": "#7a6abf",
    "--uncommon": "#5a8aa8",
    "--common": "#8a8aa0",
  },
};

function sanitizeFontName(name: unknown, fallback: string): string {
  if (typeof name !== "string") return fallback;
  const cleaned = name.replace(/[^A-Za-z0-9 -]/g, "").trim();
  return cleaned || fallback;
}

function validate(parsed: unknown): Partial<Settings> {
  if (!parsed || typeof parsed !== "object") return {};
  const p = parsed as Record<string, unknown>;
  const out: Partial<Settings> = {};
  if (p.palette === "ember" || p.palette === "crimson" || p.palette === "forest" || p.palette === "void") {
    out.palette = p.palette;
  }
  if (p.storyMode === "typewriter" || p.storyMode === "illuminated" || p.storyMode === "instant") {
    out.storyMode = p.storyMode;
  }
  if (typeof p.headingFont === "string") {
    out.headingFont = sanitizeFontName(p.headingFont, DEFAULTS.headingFont);
  }
  if (typeof p.bodyFont === "string") {
    out.bodyFont = sanitizeFontName(p.bodyFont, DEFAULTS.bodyFont);
  }
  if (typeof p.ornamentDensity === "number" && Number.isFinite(p.ornamentDensity)) {
    out.ornamentDensity = Math.min(10, Math.max(0, p.ornamentDensity));
  }
  if (typeof p.soundOn === "boolean") out.soundOn = p.soundOn;
  return out;
}

function load(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...validate(JSON.parse(raw)) };
  } catch {
    return DEFAULTS;
  }
}

function applyToRoot(s: Settings) {
  if (typeof document === "undefined" || !document.documentElement) return;
  const root = document.documentElement;
  const palette = PALETTES[s.palette] ?? PALETTES.ember;
  for (const [k, v] of Object.entries(palette)) {
    root.style.setProperty(k, v);
  }
  const heading = sanitizeFontName(s.headingFont, DEFAULTS.headingFont);
  const body = sanitizeFontName(s.bodyFont, DEFAULTS.bodyFont);
  root.style.setProperty("--font-heading", `"${heading}", serif`);
  root.style.setProperty("--font-body", `"${body}", serif`);
  root.style.setProperty("--ornament-opacity", String(0.2 + (s.ornamentDensity / 10) * 0.8));
  root.dataset.palette = s.palette;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    setSettings(load());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    applyToRoot(settings);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(settings));
    } catch (err) {
      console.error("[settings] failed to persist:", err);
    }
  }, [settings]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((s) => ({ ...s, [key]: value }));

  return { settings, update } as const;
}
