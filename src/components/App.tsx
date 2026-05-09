import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCampaigns, useCharacter, useSelection } from "../client/character";
import { useSettings } from "../client/settings";
import { type ServerMsg, useTransport } from "../client/transport";
import CampaignPicker from "./CampaignPicker";
import CharacterPanel from "./CharacterPanel";
import Header from "./Header";
import InputBar from "./InputBar";
import { CornerOrnament } from "./icons";
import SettingsMenu from "./SettingsMenu";
import StoryView, { type AskQuestion, type Entry, type RevealMode } from "./StoryView";

const MUTATING_TOOLS = new Set(["Edit", "Write", "NotebookEdit", "MultiEdit", "Bash"]);

export default function App() {
  const { settings, update } = useSettings();
  const { selection, choose, clear } = useSelection();
  const [campaignsRefresh, setCampaignsRefresh] = useState(0);
  const campaigns = useCampaigns(campaignsRefresh);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [thinking, setThinking] = useState(false);
  const [agentLabel, setAgentLabel] = useState<string>("claude");
  const [permissionMode, setPermissionModeState] = useState<string>("default");
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [characterRefresh, setCharacterRefresh] = useState(0);
  const [transientSession, setTransientSession] = useState(false);
  const idCounter = useRef(100);
  const partialEntryId = useRef<number | null>(null);

  const nextId = useCallback(() => ++idCounter.current, []);

  const character = useCharacter(selection.campaign, selection.character, characterRefresh);

  const handleMessage = useCallback(
    (msg: ServerMsg) => {
      switch (msg.type) {
        case "ready":
          setAgentLabel(msg.agent);
          if (msg.permissionMode) setPermissionModeState(msg.permissionMode);
          setErrorBanner(null);
          break;
        case "permission_mode":
          setPermissionModeState(msg.mode);
          break;
        case "user_echo":
          setEntries((es) => {
            const last = es[es.length - 1];
            if (last?.type === "user" && last.text === msg.text) return es;
            return [...es, { id: nextId(), type: "user", text: msg.text }];
          });
          setThinking(true);
          break;
        case "assistant_partial": {
          setThinking(true);
          setEntries((es) => {
            if (partialEntryId.current != null) {
              return es.map((e) =>
                e.id === partialEntryId.current && e.type === "narrator" ? { ...e, text: e.text + msg.text } : e,
              );
            }
            const id = nextId();
            partialEntryId.current = id;
            return [...es, { id, type: "narrator", text: msg.text }];
          });
          break;
        }
        case "assistant_text": {
          setEntries((es) => {
            if (partialEntryId.current != null) {
              const id = partialEntryId.current;
              partialEntryId.current = null;
              return es.map((e) => (e.id === id && e.type === "narrator" ? { ...e, text: msg.text } : e));
            }
            return [...es, { id: nextId(), type: "narrator", text: msg.text }];
          });
          setThinking(false);
          break;
        }
        case "tool_use":
          setThinking(true);
          if (msg.name === "AskUserQuestion") {
            const toolUseId = msg.toolUseId;
            if (!toolUseId) {
              console.warn("[app] AskUserQuestion missing toolUseId; skipping");
              break;
            }
            const questions = parseAskQuestions(msg.input);
            if (questions.length > 0) {
              setEntries((es) => [
                ...es,
                {
                  id: nextId(),
                  type: "ask",
                  toolUseId,
                  questions,
                  answers: questions.map(() => null),
                  submitted: false,
                },
              ]);
              setThinking(false);
            }
          }
          break;
        case "restart":
          setEntries([]);
          partialEntryId.current = null;
          setThinking(false);
          setErrorBanner(null);
          break;
        case "tool_result":
          if (MUTATING_TOOLS.has(msg.name)) {
            setCharacterRefresh((n) => n + 1);
            setCampaignsRefresh((n) => n + 1);
          }
          break;
        case "error":
          setErrorBanner(msg.message);
          if (msg.fatal) setThinking(false);
          break;
        case "agent_exit":
          setThinking(false);
          setErrorBanner((b) => b ?? "Agent exited. Click Restart to respawn.");
          break;
      }
    },
    [nextId],
  );

  const { state, send, setPermissionMode, interrupt, restart } = useTransport(handleMessage);

  const togglePermissionMode = () => {
    const next = permissionMode === "acceptEdits" ? "default" : "acceptEdits";
    setPermissionMode(next);
  };

  const submitAskAnswers = (questions: AskQuestion[], answers: (string[] | null)[]) => {
    const lines = questions.map((q, i) => {
      const ans = answers[i] ?? [];
      const heading = q.header || q.question;
      return `${heading}: ${ans.join(", ")}`;
    });
    const text = lines.length === 1 ? (answers[0]?.join(", ") ?? "") : lines.join("\n");
    send(text);
    setThinking(true);
  };

  const handleAskPick = (entryId: number, questionIdx: number, label: string) => {
    setEntries((es) =>
      es.map((e) => {
        if (e.id !== entryId || e.type !== "ask" || e.submitted) return e;
        const q = e.questions[questionIdx];
        if (!q) return e;
        const current = e.answers[questionIdx] ?? [];
        let next: string[];
        if (q.multiSelect) {
          next = current.includes(label) ? current.filter((l) => l !== label) : [...current, label];
        } else {
          next = [label];
        }
        const answers = [...e.answers];
        answers[questionIdx] = next.length ? next : null;

        const anyMulti = e.questions.some((qq) => qq.multiSelect);
        const allAnswered = answers.every((a) => a !== null && a.length > 0);
        if (!anyMulti && allAnswered) {
          submitAskAnswers(e.questions, answers);
          return { ...e, answers, submitted: true };
        }
        return { ...e, answers };
      }),
    );
  };

  const handleAskSubmit = (entryId: number) => {
    setEntries((es) =>
      es.map((e) => {
        if (e.id !== entryId || e.type !== "ask" || e.submitted) return e;
        const allAnswered = e.answers.every((a) => a !== null && a.length > 0);
        if (!allAnswered) return e;
        submitAskAnswers(e.questions, e.answers);
        return { ...e, submitted: true };
      }),
    );
  };

  useEffect(() => {
    if (state === "open") setErrorBanner(null);
  }, [state]);

  useEffect(() => {
    if (!thinking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        interrupt();
        const partialId = partialEntryId.current;
        partialEntryId.current = null;
        if (partialId != null) {
          setEntries((es) =>
            es.map((entry) =>
              entry.id === partialId && entry.type === "narrator"
                ? { ...entry, text: `${entry.text} _(interrupted)_` }
                : entry,
            ),
          );
        }
        setThinking(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [thinking, interrupt]);

  const sendMessage = (text: string) => {
    setEntries((es) => [...es, { id: nextId(), type: "user", text }]);
    setThinking(true);
    send(text);
  };

  const rollD20 = (label = "Charisma (Persuasion)", modifier?: number) => {
    const mod = modifier ?? character?.skills?.persuasion ?? character?.abilities?.CHA?.modifier ?? 0;
    const result = 1 + Math.floor(Math.random() * 20);
    setEntries((es) => [
      ...es,
      {
        id: nextId(),
        type: "roll",
        label,
        modifier: mod,
        result,
        total: result + mod,
      },
    ]);
  };

  const hasSelection = selection.campaign != null && selection.character != null;
  const showChat = hasSelection || transientSession;

  const startNewCampaign = () => {
    setTransientSession(true);
    setEntries([]);
    send("/campaign-creation");
    setThinking(true);
  };

  const beginSession = (campaign: string, character: string) => {
    setEntries([]);
    setTransientSession(false);
    choose(campaign, character);
    send(`Give a summary of the events so far in ${campaign} for character ${character}.`);
    setThinking(true);
  };
  const playerName = character?.name ?? "You";
  const location = hasSelection ? (character?.location ?? "Somewhere in the world") : "";
  const time = character?.inGameDate ?? "";
  const sessionLabel = character?.sessionLabel ?? null;
  const dayLabel = useMemo(
    () => (character?.sessionLabel && character?.campaign ? character.campaign.replace(/-/g, " ") : null),
    [character],
  );
  const chapterLabel = character?.campaign
    ? `${character.campaign.toUpperCase()} · ${agentLabel}`
    : `Vellum · ${agentLabel}`;

  return (
    <div className="app">
      <div className="bg-layer bg-vellum"></div>
      <div className="bg-layer bg-vignette"></div>

      <Header
        location={location}
        time={time}
        soundOn={settings.soundOn}
        onToggleSound={() => update("soundOn", !settings.soundOn)}
        onOpenSettings={() => setSettingsOpen((o) => !o)}
        sessionLabel={sessionLabel}
        dayLabel={dayLabel}
        agent={agentLabel}
        permissionMode={permissionMode}
        onTogglePermissionMode={togglePermissionMode}
        canSwitchCharacter={showChat}
        onSwitchCharacter={() => {
          setEntries([]);
          setTransientSession(false);
          setCampaignsRefresh((n) => n + 1);
          clear();
        }}
      />

      {errorBanner && (
        <div className="error-banner">
          <span>{errorBanner}</span>
          <button type="button" onClick={restart}>
            Restart
          </button>
        </div>
      )}

      <main className={`main-grid ${hasSelection ? "" : "single-col"}`}>
        <section className="story-col">
          <div className="story-frame">
            <div className="story-frame-corner tl">
              <CornerOrnament size={56} />
            </div>
            <div className="story-frame-corner tr">
              <CornerOrnament size={56} flip="scaleX(-1)" />
            </div>
            <div className="story-frame-corner bl">
              <CornerOrnament size={56} flip="scaleY(-1)" />
            </div>
            <div className="story-frame-corner br">
              <CornerOrnament size={56} flip="scale(-1,-1)" />
            </div>
            {showChat ? (
              <StoryView
                entries={entries}
                revealMode={settings.storyMode as RevealMode}
                playerName={playerName}
                chapterLabel={chapterLabel}
                onAsk={handleAskPick}
                onAskSubmit={handleAskSubmit}
              />
            ) : (
              <CampaignPicker campaigns={campaigns} onPick={beginSession} onNewCampaign={startNewCampaign} />
            )}
            {showChat && thinking && (
              <div className="thinking-row">
                <span className="thinking-dot"></span>
                <span className="thinking-dot"></span>
                <span className="thinking-dot"></span>
                <span className="thinking-text">The Storyteller weaves...</span>
                <span className="thinking-hint">ESC to interrupt</span>
              </div>
            )}
          </div>

          {showChat && (
            <>
              <div className="story-toggles">
                <span className="toggles-label">NARRATIVE STYLE</span>
                {[
                  { v: "typewriter" as const, l: "Typewriter" },
                  { v: "illuminated" as const, l: "Illuminated" },
                  { v: "instant" as const, l: "Plain Serif" },
                ].map((m) => (
                  <button
                    key={m.v}
                    type="button"
                    className={`toggle-pill ${settings.storyMode === m.v ? "active" : ""}`}
                    onClick={() => update("storyMode", m.v)}
                  >
                    {m.l}
                  </button>
                ))}
              </div>

              <InputBar onSend={sendMessage} onRoll={() => rollD20()} disabled={thinking || state !== "open"} />
            </>
          )}
        </section>

        {hasSelection && <CharacterPanel character={character} />}
      </main>

      <SettingsMenu open={settingsOpen} settings={settings} onChange={update} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function parseAskQuestions(input: unknown): AskQuestion[] {
  if (!input || typeof input !== "object") return [];
  const raw = (input as { questions?: unknown }).questions;
  if (!Array.isArray(raw)) return [];
  const out: AskQuestion[] = [];
  for (const q of raw) {
    if (!q || typeof q !== "object") continue;
    const obj = q as Record<string, unknown>;
    const question = typeof obj.question === "string" ? obj.question : "";
    const options: { label: string; description?: string }[] = Array.isArray(obj.options)
      ? (obj.options as unknown[]).flatMap((o) => {
          if (!o || typeof o !== "object") return [];
          const oo = o as Record<string, unknown>;
          const label = typeof oo.label === "string" ? oo.label : "";
          if (!label) return [];
          const opt: { label: string; description?: string } = { label };
          if (typeof oo.description === "string") opt.description = oo.description;
          return [opt];
        })
      : [];
    if (question && options.length > 0) {
      out.push({
        question,
        header: typeof obj.header === "string" ? obj.header : undefined,
        multiSelect: typeof obj.multiSelect === "boolean" ? obj.multiSelect : false,
        options,
      });
    }
  }
  return out;
}
