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
  equipped: { slot: string; name: string; stats: string; weight: number }[];
  inventory: { name: string; qty: number; weight: number; notes: string }[];
  currency: { gp: number; sp: number; cp: number; ep: number; pp: number };
  totalWeight: number;
  carryCap: number;
  primaryAttackBonus: number;
  portrait: string;
  bigPortrait: string;
  hasSmallPortrait: boolean;
  hasBigPortrait: boolean;
  campaign: string;
  location: string;
  inGameDate: string;
  sessionLabel: string | null;
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
      .catch((err) => {
        console.error(`[useCharacter] fetch failed for ${campaign}/${character}:`, err);
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
      .catch((err) => {
        console.error("[useCampaigns] fetch /api/campaigns failed:", err);
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

function isSelection(value: unknown): value is Selection {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const okCampaign = v.campaign === null || typeof v.campaign === "string";
  const okCharacter = v.character === null || typeof v.character === "string";
  return okCampaign && okCharacter;
}

export function useSelection() {
  const [selection, setSelection] = useState<Selection>({
    campaign: null,
    character: null,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SELECTION_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (isSelection(parsed)) setSelection(parsed);
    } catch {
      // ignore corrupted value
    }
  }, []);

  const choose = (campaign: string, character: string) => {
    const s: Selection = { campaign, character };
    setSelection(s);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SELECTION_KEY, JSON.stringify(s));
    } catch (err) {
      console.warn("[selection] failed to persist:", err);
    }
  };

  const clear = () => {
    setSelection({ campaign: null, character: null });
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(SELECTION_KEY);
    } catch (err) {
      console.warn("[selection] failed to clear:", err);
    }
  };

  return { selection, choose, clear } as const;
}
