import { type ReactNode, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Character } from "../client/character";
import { Icon } from "./icons";

function HoverDetails({ children, details }: { children: ReactNode; details: ReactNode | null }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLButtonElement>(null);

  if (details == null) {
    return <div className="hover-anchor">{children}</div>;
  }

  const open = () => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.top, left: rect.left });
    setShow(true);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="hover-anchor is-hoverable"
        onMouseEnter={open}
        onMouseLeave={() => setShow(false)}
        onFocus={open}
        onBlur={() => setShow(false)}
      >
        {children}
      </button>
      {show &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="hover-popover" style={{ top: pos.top, left: pos.left }}>
            {details}
          </div>,
          document.body,
        )}
    </>
  );
}

function StatPip({ label, cur, max, color }: { label: string; cur: number; max: number; color: string }) {
  const pct = max > 0 ? (cur / max) * 100 : 0;
  return (
    <div className="stat-pip">
      <div className="stat-pip-row">
        <span className="stat-pip-label" style={{ color }}>
          {label}
        </span>
        <span className="stat-pip-val" style={{ color }}>
          {cur} / {max}
        </span>
      </div>
      <div className="stat-pip-bar">
        <div
          className="stat-pip-fill"
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: `0 0 8px ${color}88`,
          }}
        ></div>
        <div className="stat-pip-bar-deco"></div>
      </div>
    </div>
  );
}

function AbilityScore({
  name,
  score,
  modifier,
  save,
}: {
  name: string;
  score: number;
  modifier: number;
  save: number;
}) {
  const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
  const saveStr = save >= 0 ? `+${save}` : `${save}`;
  return (
    <div className="abil">
      <div className="abil-name">{name}</div>
      <div className="abil-score">{score}</div>
      <div className="abil-mod">{modStr}</div>
      <div className="abil-save">SAVE {saveStr}</div>
    </div>
  );
}

function ordinalSuffix(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function SectionHeader({
  children,
  collapsible,
  collapsed,
  onToggle,
}: {
  children: ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  if (collapsible) {
    return (
      <button
        type="button"
        className={`sec-hdr sec-hdr-toggle ${collapsed ? "is-collapsed" : ""}`}
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <span className="sec-hdr-flank">{collapsed ? "▸" : "▾"}</span>
        <span className="sec-hdr-text">{children}</span>
        <span className="sec-hdr-flank">{collapsed ? "◂" : "▾"}</span>
      </button>
    );
  }
  return (
    <div className="sec-hdr">
      <span className="sec-hdr-flank">⊰</span>
      <span className="sec-hdr-text">{children}</span>
      <span className="sec-hdr-flank">⊱</span>
    </div>
  );
}

interface Props {
  character: Character | null;
}

const INVENTORY_COLLAPSED_KEY = "vellum.inventoryCollapsed";

function loadCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(INVENTORY_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export default function CharacterPanel({ character }: Props) {
  const [inventoryCollapsed, setInventoryCollapsed] = useState(loadCollapsed);

  const toggleInventory = () => {
    setInventoryCollapsed((prev) => {
      const next = !prev;
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(INVENTORY_COLLAPSED_KEY, next ? "1" : "0");
        }
      } catch {
        // ignore quota errors
      }
      return next;
    });
  };

  if (!character) {
    return (
      <aside className="char-panel">
        <div className="char-bg-paper"></div>
        <div
          style={{
            padding: "2rem",
            color: "var(--parchment-dim)",
            textAlign: "center",
          }}
        >
          Awaiting character sheet…
        </div>
      </aside>
    );
  }

  const c = character;
  const firstSlot = c.spellSlots[0];
  const toHit = c.primaryAttackBonus;
  const toHitStr = toHit >= 0 ? `+${toHit}` : `${toHit}`;

  return (
    <aside className="char-panel">
      <div className="char-bg-paper"></div>

      <div className="char-portrait-frame">
        <div className="char-portrait">
          <img
            src={c.portrait}
            alt={c.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/assets/portrait-default.png";
            }}
          />
        </div>
        <div className="char-portrait-banner">
          <div className="char-name">{c.name}</div>
          <div className="char-sub">
            {c.race}
            {c.race && " · "}
            {c.className}
            {c.subclass ? ` (${c.subclass})` : ""}
            {c.background ? ` · ${c.background}` : ""}
          </div>
        </div>
        <div className="char-level-badge">
          <span className="char-level-num">{c.level}</span>
          <span className="char-level-lbl">LVL</span>
        </div>
      </div>

      <div className="char-section">
        <SectionHeader>Vitals</SectionHeader>
        <StatPip label="HIT POINTS" cur={c.hp.current} max={c.hp.max} color="var(--blood)" />
        {c.hitDice && <StatPip label="HIT DICE" cur={c.hitDice.current} max={c.hitDice.max} color="var(--gold)" />}
        <div className="def-row">
          <div className="def-cell">
            <Icon.Shield s={18} />
            <div>
              <div className="def-num">{c.ac}</div>
              <div className="def-lbl">Armor</div>
            </div>
          </div>
          <div className="def-cell">
            <Icon.Sword s={18} />
            <div>
              <div className="def-num">{toHitStr}</div>
              <div className="def-lbl">To Hit</div>
            </div>
          </div>
          <div className="def-cell">
            <Icon.D20 s={18} />
            <div>
              <div className="def-num">{c.speed}</div>
              <div className="def-lbl">Speed</div>
            </div>
          </div>
        </div>
      </div>

      {firstSlot && (
        <div className="char-section">
          <SectionHeader>Divine Magic</SectionHeader>
          <div className="slots-row">
            {Array.from({ length: firstSlot.max }, (_, i) => i).map((i) => (
              <div
                key={`slot-${firstSlot.level}-${i}`}
                className={`slot-orb ${i < firstSlot.current ? "ready" : "spent"}`}
              >
                <div className="slot-orb-inner"></div>
                <div className="slot-orb-num">I</div>
              </div>
            ))}
            <div className="slot-info">
              <div className="slot-info-num">
                {firstSlot.current} / {firstSlot.max}
              </div>
              <div className="slot-info-lbl">{ordinalSuffix(firstSlot.level)}-level slots · long rest</div>
            </div>
          </div>
          <div className="invocations">
            {c.preparedSpells.map((sp) => (
              <div key={sp} className="invo">
                <strong>{sp}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="char-section">
        <SectionHeader>Abilities</SectionHeader>
        <div className="abil-grid">
          {(["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const).map((k) => {
            const a = c.abilities[k];
            return <AbilityScore key={k} name={k} score={a.score} modifier={a.modifier} save={a.save} />;
          })}
        </div>
      </div>

      <div className="char-section">
        <SectionHeader>Equipped</SectionHeader>
        {c.equipped.length === 0 ? (
          <div className="gear-empty">Nothing equipped.</div>
        ) : (
          <div className="gear-list">
            {c.equipped.map((e) => (
              <HoverDetails
                key={`${e.slot}-${e.name}`}
                details={
                  e.stats ? (
                    <>
                      <div className="hover-popover-head">{e.name}</div>
                      <div className="hover-popover-meta">{e.slot}</div>
                      <div className="hover-popover-body">{e.stats}</div>
                      {e.weight > 0 && <div className="hover-popover-foot">{e.weight} lb</div>}
                    </>
                  ) : null
                }
              >
                <div className="gear-row">
                  <span className="gear-slot">{e.slot}</span>
                  <span className="gear-name">{e.name}</span>
                </div>
              </HoverDetails>
            ))}
          </div>
        )}
      </div>

      <div className="char-section">
        <SectionHeader collapsible collapsed={inventoryCollapsed} onToggle={toggleInventory}>
          Inventory ({c.inventory.length})
        </SectionHeader>
        {!inventoryCollapsed && (
          <>
            {c.inventory.length === 0 ? (
              <div className="gear-empty">Pack is empty.</div>
            ) : (
              <div className="gear-list">
                {c.inventory.map((it) => (
                  <HoverDetails
                    key={it.name}
                    details={
                      it.notes || it.weight > 0 ? (
                        <>
                          <div className="hover-popover-head">{it.name}</div>
                          {it.notes && <div className="hover-popover-body">{it.notes}</div>}
                          {it.weight > 0 && (
                            <div className="hover-popover-foot">
                              {it.weight} lb
                              {it.qty > 1 ? ` each · ${it.weight * it.qty} lb total` : ""}
                            </div>
                          )}
                        </>
                      ) : null
                    }
                  >
                    <div className="gear-row">
                      <span className="gear-qty">{it.qty > 1 ? `×${it.qty}` : ""}</span>
                      <span className="gear-name">{it.name}</span>
                      {it.notes && (
                        <span className="gear-hint" aria-hidden="true">
                          ·
                        </span>
                      )}
                    </div>
                  </HoverDetails>
                ))}
              </div>
            )}
            <div className="purse-row">
              <span className="purse-pip gp">
                <Icon.Coin s={12} /> {c.currency.gp}
                <small>gp</small>
              </span>
              <span className="purse-pip sp">
                {c.currency.sp}
                <small>sp</small>
              </span>
              <span className="purse-pip cp">
                {c.currency.cp}
                <small>cp</small>
              </span>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
