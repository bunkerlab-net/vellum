import { useEffect, useState } from "react";

export interface Ability {
	score: number;
	modifier: number;
	save: number;
	saveProficient: boolean;
}

export interface Character {
	slug: string;
	name: string;
	player?: string;
	race?: string;
	className: string;
	subclass?: string;
	level: number;
	background?: string;
	abilities: {
		STR: Ability;
		DEX: Ability;
		CON: Ability;
		INT: Ability;
		WIS: Ability;
		CHA: Ability;
	};
	skills: Record<string, number>;
	hp: { current: number; max: number };
	ac: number;
	speed: string;
	initiative: number;
	proficiencyBonus: number;
	hitDice?: { current: number; max: number; die: string };
	spellSlots: { level: number; current: number; max: number }[];
	preparedSpells: string[];
	cantrips: string[];
	equipment: { name: string; qty: number; weight: number }[];
	currency: { gp: number; sp: number; cp: number; ep: number; pp: number };
	totalWeight: number;
	carryCap: number;
	primaryAttackBonus: number;
	portrait: string;
	campaign: string;
	location: string;
	inGameDate: string;
	sessionLabel: string | null;
	inventory: { name: string; qty: number }[];
}

export function useCharacter(
	campaign: string | null,
	character: string | null,
	refreshTrigger: number,
): Character | null {
	const [data, setData] = useState<Character | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshTrigger is the explicit refetch signal
	useEffect(() => {
		if (!campaign || !character) {
			setData(null);
			return;
		}
		let cancelled = false;
		const url = `/api/character?campaign=${encodeURIComponent(campaign)}&character=${encodeURIComponent(character)}`;
		fetch(url)
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
			.then((d: Character) => {
				if (!cancelled) setData(d);
			})
			.catch(() => {
				if (!cancelled) setData(null);
			});
		return () => {
			cancelled = true;
		};
	}, [campaign, character, refreshTrigger]);

	return data;
}

export interface CampaignListing {
	slug: string;
	characters: string[];
}

export function useCampaigns(refreshTrigger: number = 0): CampaignListing[] {
	const [list, setList] = useState<CampaignListing[]>([]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: refreshTrigger is the explicit refetch signal
	useEffect(() => {
		let cancelled = false;
		fetch("/api/campaigns")
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
			.then((d: CampaignListing[]) => {
				if (!cancelled) setList(d);
			})
			.catch(() => {
				if (!cancelled) setList([]);
			});
		return () => {
			cancelled = true;
		};
	}, [refreshTrigger]);
	return list;
}

export interface Selection {
	campaign: string | null;
	character: string | null;
}

const SELECTION_KEY = "vellum.selection";

export function useSelection() {
	const [selection, setSelection] = useState<Selection>({
		campaign: null,
		character: null,
	});

	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			const raw = window.localStorage.getItem(SELECTION_KEY);
			if (raw) setSelection(JSON.parse(raw));
		} catch {
			// ignore
		}
	}, []);

	const choose = (campaign: string, character: string) => {
		const s = { campaign, character };
		setSelection(s);
		if (typeof window !== "undefined") {
			window.localStorage.setItem(SELECTION_KEY, JSON.stringify(s));
		}
	};

	const clear = () => {
		setSelection({ campaign: null, character: null });
		if (typeof window !== "undefined") {
			window.localStorage.removeItem(SELECTION_KEY);
		}
	};

	return { selection, choose, clear } as const;
}
