import { Icon } from "./icons";

interface Props {
  location: string;
  time: string;
  soundOn: boolean;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  sessionLabel: string | null;
  dayLabel: string | null;
  canSwitchCharacter: boolean;
  onSwitchCharacter: () => void;
}

export default function Header({
  location,
  time,
  soundOn,
  onToggleSound,
  onOpenSettings,
  sessionLabel,
  dayLabel,
  canSwitchCharacter,
  onSwitchCharacter,
}: Props) {
  return (
    <header className="hdr">
      <div className="hdr-side">
        <span className="logo-mark">
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 32 32">
            <path d="M16 2 L 28 9 V 23 L 16 30 L 4 23 V 9 Z" fill="none" stroke="var(--gold)" strokeWidth="1.2" />
            <path d="M16 8 L 22 11 V 21 L 16 24 L 10 21 V 11 Z" fill="none" stroke="var(--gold)" strokeWidth="0.8" />
            <text
              x="16"
              y="19"
              textAnchor="middle"
              fill="var(--gold)"
              fontFamily="Cinzel"
              fontSize="9"
              fontWeight="700"
            >
              V
            </text>
          </svg>
        </span>
        <div className="logo-text">
          <div className="logo-title">VELLVM</div>
          <div className="logo-sub">Chronicles &amp; Tales</div>
        </div>
      </div>

      <div className="hdr-center">
        <div className="loc-row">
          <Icon.Compass s={14} />
          <span className="loc-label">CURRENT LOCATION</span>
        </div>
        <div className="loc-name">{location}</div>
        <div className="loc-time">{time}</div>
      </div>

      <div className="hdr-side hdr-side-right">
        {canSwitchCharacter && (
          <button type="button" className="hdr-btn" onClick={onSwitchCharacter} title="Switch character / campaign">
            <Icon.Scroll s={18} />
            <span>Switch</span>
          </button>
        )}
        <button type="button" className="hdr-btn" onClick={onToggleSound} title="Toggle sound">
          <Icon.Sound s={18} muted={!soundOn} />
          <span>{soundOn ? "Bardic Tune" : "Silenced"}</span>
        </button>
        <button type="button" className="hdr-btn" onClick={onOpenSettings} title="Settings">
          <Icon.Gear s={18} />
          <span>Settings</span>
        </button>
        {sessionLabel && (
          <div className="session-info">
            <div className="session-num">{sessionLabel}</div>
            {dayLabel && <div className="session-day">{dayLabel}</div>}
          </div>
        )}
      </div>
    </header>
  );
}
