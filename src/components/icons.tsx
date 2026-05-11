/** biome-ignore-all lint/a11y/noSvgWithoutTitle: a11y attributes are added dynamically via the a11y() spread (aria-hidden by default; aria-label + role="img" when an ariaLabel is provided), which biome's static check cannot see through. */

import type { CSSProperties, ReactNode } from "react";

interface IconProps {
  size?: number;
  /** Accessible label. When set, the icon is exposed to assistive tech as `role="img"`. */
  ariaLabel?: string;
  /** When true (default) the icon is hidden from assistive tech with aria-hidden. */
  decorative?: boolean;
}

function a11y(p: IconProps): { "aria-hidden"?: "true"; "aria-label"?: string; role?: "img" } {
  if (p.ariaLabel) return { "aria-label": p.ariaLabel, role: "img" };
  if (p.decorative === false && process.env.NODE_ENV !== "production") {
    console.warn("[icons] icon flagged decorative={false} without an ariaLabel; falling back to aria-hidden");
  }
  return { "aria-hidden": "true" };
}

export const CornerOrnament = ({
  size = 48,
  color = "var(--gold)",
  flip = "",
}: {
  size?: number;
  color?: string;
  flip?: string;
}) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 48 48" style={{ transform: flip, opacity: 0.85 }}>
    <path d="M2 2 L20 2 M2 2 L2 20" stroke={color} strokeWidth="1.2" fill="none" />
    <path d="M2 2 L14 14" stroke={color} strokeWidth="0.8" fill="none" />
    <circle cx="2" cy="2" r="2.5" fill="none" stroke={color} strokeWidth="1" />
    <path d="M8 2 Q12 4 12 8 Q14 6 16 8 M2 8 Q4 12 8 12 Q6 14 8 16" stroke={color} strokeWidth="0.7" fill="none" />
    <circle cx="14" cy="14" r="1.2" fill={color} />
  </svg>
);

export const Fleuron = ({ size = 24, color = "var(--gold)" }: { size?: number; color?: string }) => (
  <svg aria-hidden="true" width={size * 3} height={size} viewBox="0 0 72 24">
    <line x1="0" y1="12" x2="22" y2="12" stroke={color} strokeWidth="0.6" opacity="0.5" />
    <line x1="50" y1="12" x2="72" y2="12" stroke={color} strokeWidth="0.6" opacity="0.5" />
    <path d="M36 4 Q32 8 28 12 Q32 16 36 20 Q40 16 44 12 Q40 8 36 4 Z" fill="none" stroke={color} strokeWidth="0.8" />
    <circle cx="36" cy="12" r="1.5" fill={color} />
    <path d="M28 12 L24 12 M44 12 L48 12" stroke={color} strokeWidth="0.6" />
    <circle cx="24" cy="12" r="1" fill={color} opacity="0.7" />
    <circle cx="48" cy="12" r="1" fill={color} opacity="0.7" />
  </svg>
);

export const FramedPanel = ({
  children,
  ornaments = true,
  style = {},
  className = "",
}: {
  children: ReactNode;
  ornaments?: boolean;
  style?: CSSProperties;
  className?: string;
}) => (
  <div className={`framed-panel ${className}`} style={{ ...style, position: "relative" }}>
    <div className="framed-panel-inner">{children}</div>
    {ornaments && (
      <>
        <div style={{ position: "absolute", top: -2, left: -2 }}>
          <CornerOrnament />
        </div>
        <div style={{ position: "absolute", top: -2, right: -2 }}>
          <CornerOrnament flip="scaleX(-1)" />
        </div>
        <div style={{ position: "absolute", bottom: -2, left: -2 }}>
          <CornerOrnament flip="scaleY(-1)" />
        </div>
        <div style={{ position: "absolute", bottom: -2, right: -2 }}>
          <CornerOrnament flip="scale(-1,-1)" />
        </div>
      </>
    )}
  </div>
);

export const Icon = {
  HP: (p: IconProps = {}) => (
    <svg {...a11y(p)} width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21 C 4 14 4 8 8 6 C 10 5 12 7 12 9 C 12 7 14 5 16 6 C 20 8 20 14 12 21 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.3"
      />
    </svg>
  ),
  Mana: (p: IconProps = {}) => (
    <svg {...a11y(p)} width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3 L20 14 C 20 19 16 22 12 22 C 8 22 4 19 4 14 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.3"
      />
    </svg>
  ),
  Shield: (p: IconProps = {}) => (
    <svg {...a11y(p)} width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2 L20 5 V12 C 20 17 16 21 12 22 C 8 21 4 17 4 12 V 5 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <path d="M9 12 L11 14 L15 9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  Sword: (p: IconProps = {}) => (
    <svg {...a11y(p)} width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none">
      <path
        d="M14 2 L20 2 L20 8 L9 19 L7 21 L3 21 L3 17 L5 15 L16 4 Z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <path d="M5 15 L9 19" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  Coin: (p: IconProps = {}) => (
    <svg {...a11y(p)} width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.3" fill="currentColor" fillOpacity="0.15" />
      <path d="M9 12 H 15 M 12 8 V 16" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  Scroll: (p: IconProps = {}) => (
    <svg {...a11y(p)} width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none">
      <path
        d="M5 5 H 17 V 19 H 5 A 2 2 0 0 1 5 15 H 15"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <path d="M19 5 V 17 A 2 2 0 0 0 21 19 H 7" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  D20: (p: IconProps = {}) => (
    <svg {...a11y(p)} width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2 L21 8 V 16 L 12 22 L 3 16 V 8 Z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <path d="M3 8 L 12 14 L 21 8 M 12 14 V 22 M 12 2 V 14" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  ),
  Sound: (p: IconProps & { muted?: boolean } = {}) => (
    <svg {...a11y(p)} width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 9 V 15 H 7 L 12 19 V 5 L 7 9 Z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="currentColor"
        fillOpacity="0.2"
      />
      {!p.muted && <path d="M16 9 Q 18 12 16 15 M 18 6 Q 22 12 18 18" stroke="currentColor" strokeWidth="1.3" />}
      {p.muted && <path d="M16 9 L 21 14 M 21 9 L 16 14" stroke="currentColor" strokeWidth="1.3" />}
    </svg>
  ),
  Send: (p: IconProps = {}) => (
    <svg {...a11y(p)} width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 12 L 21 4 L 16 21 L 12 13 Z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path d="M3 12 L 12 13" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  Compass: (p: IconProps = {}) => (
    <svg {...a11y(p)} width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.3" fill="currentColor" fillOpacity="0.1" />
      <path
        d="M12 5 L 14 12 L 12 19 L 10 12 Z"
        fill="currentColor"
        fillOpacity="0.5"
        stroke="currentColor"
        strokeWidth="0.8"
      />
    </svg>
  ),
  Seal: (p: IconProps = {}) => (
    <svg {...a11y(p)} width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="10" r="6" stroke="currentColor" strokeWidth="1.3" fill="currentColor" fillOpacity="0.25" />
      <path d="M9 9 L 12 13 L 15 9" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path
        d="M8 14 L 6 22 L 12 18 L 18 22 L 16 14"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="currentColor"
        fillOpacity="0.15"
      />
    </svg>
  ),
  Gear: (p: IconProps = {}) => (
    <svg {...a11y(p)} width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 8 a4 4 0 1 0 0.001 0 M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M4.9 4.9 L7 7 M17 17 L19.1 19.1 M4.9 19.1 L7 17 M17 7 L19.1 4.9"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  ),
};
