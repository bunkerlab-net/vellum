import { useState } from "react";
import type { CampaignListing } from "../client/character";

interface Props {
	campaigns: CampaignListing[];
	onPick: (campaign: string, character: string) => void;
	onNewCampaign: () => void;
}

export default function CampaignPicker({
	campaigns,
	onPick,
	onNewCampaign,
}: Props) {
	const [campaign, setCampaign] = useState<string | null>(null);

	const newButton = (
		<button
			type="button"
			className="picker-new-btn"
			onClick={onNewCampaign}
			title="Start a new chronicle (runs /campaign-creation)"
		>
			<span className="picker-new-mark">✦</span>
			<span className="picker-new-text">Forge a new chronicle</span>
			<span className="picker-new-meta">/campaign-creation</span>
		</button>
	);

	if (campaigns.length === 0) {
		return (
			<div className="picker">
				<div className="picker-empty">
					<p>
						No campaigns found in <code>campaigns/</code>. Begin one to start
						playing.
					</p>
				</div>
				{newButton}
			</div>
		);
	}

	const active = campaigns.find((c) => c.slug === campaign);

	return (
		<div className="picker">
			<div className="picker-step">
				<div className="picker-label">Choose a chronicle</div>
				<div className="picker-options">
					{campaigns.map((c) => (
						<button
							key={c.slug}
							type="button"
							className={`picker-option ${campaign === c.slug ? "active" : ""}`}
							onClick={() => setCampaign(c.slug)}
						>
							<span className="picker-option-name">{prettify(c.slug)}</span>
							<span className="picker-option-meta">
								{c.characters.length === 1
									? "1 character"
									: `${c.characters.length} characters`}
							</span>
						</button>
					))}
				</div>
			</div>

			{active && (
				<div className="picker-step">
					<div className="picker-label">Choose a character</div>
					{active.characters.length === 0 ? (
						<p className="picker-hint">
							No characters yet in <code>{active.slug}</code>. Run the{" "}
							<code>character-creation</code> skill to roll one up.
						</p>
					) : (
						<div className="picker-options">
							{active.characters.map((ch) => (
								<button
									key={ch}
									type="button"
									className="picker-option"
									onClick={() => onPick(active.slug, ch)}
								>
									<span className="picker-option-name">{prettify(ch)}</span>
									<span className="picker-option-meta">{ch}</span>
								</button>
							))}
						</div>
					)}
				</div>
			)}

			{newButton}
		</div>
	);
}

function prettify(slug: string): string {
	return slug
		.split("-")
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join(" ");
}
