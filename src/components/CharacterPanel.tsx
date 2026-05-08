import type { ReactNode } from "react";
import type { Character } from "../client/character";
import { Icon } from "./icons";

function StatPip({
	label,
	cur,
	max,
	color,
}: {
	label: string;
	cur: number;
	max: number;
	color: string;
}) {
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

function SectionHeader({ children }: { children: ReactNode }) {
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
	onRoll: () => void;
}

export default function CharacterPanel({ character, onRoll }: Props) {
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
	const persuasion = c.skills?.persuasion;
	const persuasionStr = persuasion >= 0 ? `+${persuasion}` : `${persuasion}`;
	const toHit = c.primaryAttackBonus;
	const toHitStr = toHit >= 0 ? `+${toHit}` : `${toHit}`;

	const inventoryCells = c.inventory.slice(0, 12);
	const blanks = Math.max(0, 12 - inventoryCells.length);

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
							(e.currentTarget as HTMLImageElement).src =
								"/assets/portrait-default.png";
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
				<StatPip
					label="HIT POINTS"
					cur={c.hp.current}
					max={c.hp.max}
					color="var(--blood)"
				/>
				{c.hitDice && (
					<StatPip
						label="HIT DICE"
						cur={c.hitDice.current}
						max={c.hitDice.max}
						color="var(--gold)"
					/>
				)}
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
							<div className="slot-info-lbl">
								{firstSlot.level}st-level slots · long rest
							</div>
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
						return (
							<AbilityScore
								key={k}
								name={k}
								score={a.score}
								modifier={a.modifier}
								save={a.save}
							/>
						);
					})}
				</div>
				<button type="button" className="roll-btn" onClick={onRoll}>
					<Icon.D20 s={16} />
					<span>Roll Charisma (Persuasion)</span>
					<span className="roll-btn-mod">{persuasionStr}</span>
				</button>
			</div>

			<div className="char-section">
				<SectionHeader>Equipment</SectionHeader>
				<div className="equip-list">
					{c.equipment.map((e) => (
						<div key={e.name} className="equip-row q-common">
							<span className="equip-slot">{e.qty > 1 ? `×${e.qty}` : ""}</span>
							<span className="equip-name">{e.name}</span>
						</div>
					))}
				</div>
			</div>

			<div className="char-section">
				<SectionHeader>Inventory</SectionHeader>
				<div className="inv-grid">
					{inventoryCells.map((it) => (
						<div key={it.name} className="inv-cell kind-gear" title={it.name}>
							<div className="inv-icon">◈</div>
							<div className="inv-qty">{it.qty}</div>
						</div>
					))}
					{Array.from({ length: blanks }, (_, i) => `blank-${i}`).map((id) => (
						<div key={id} className="inv-cell empty"></div>
					))}
				</div>
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
			</div>
		</aside>
	);
}
