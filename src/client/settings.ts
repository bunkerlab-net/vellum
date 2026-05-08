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

function load(): Settings {
	if (typeof window === "undefined") return DEFAULTS;
	try {
		const raw = window.localStorage.getItem(KEY);
		if (!raw) return DEFAULTS;
		const parsed = JSON.parse(raw);
		return { ...DEFAULTS, ...parsed };
	} catch {
		return DEFAULTS;
	}
}

function applyToRoot(s: Settings) {
	const root = document.documentElement;
	const palette = PALETTES[s.palette] ?? PALETTES.ember;
	for (const [k, v] of Object.entries(palette)) {
		root.style.setProperty(k, v);
	}
	root.style.setProperty("--font-heading", `"${s.headingFont}", serif`);
	root.style.setProperty("--font-body", `"${s.bodyFont}", serif`);
	root.style.setProperty(
		"--ornament-opacity",
		String(0.2 + (s.ornamentDensity / 10) * 0.8),
	);
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
		window.localStorage.setItem(KEY, JSON.stringify(settings));
	}, [settings]);

	const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
		setSettings((s) => ({ ...s, [key]: value }));

	return { settings, update } as const;
}
