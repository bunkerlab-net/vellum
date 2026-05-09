import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Character } from "../client/character";

const PORTRAIT_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const PORTRAIT_MAX_BYTES = 5 * 1024 * 1024;

type Variant = "small" | "big";

interface Props {
  character: Character;
  onClose: () => void;
  onUploaded: () => void;
}

export default function PortraitViewer({ character, onClose, onUploaded }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        // capture-phase + stop propagation so the App-level ESC (mid-stream
        // interrupt) doesn't fire when the player is just dismissing this overlay.
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="portrait-viewer-root" role="presentation">
      <button type="button" aria-label="Close portraits" className="portrait-viewer-scrim" onClick={onClose} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="portrait-viewer-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${character.name} portraits`}
      >
        <button type="button" className="portrait-viewer-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <div className="portrait-viewer-grid">
          <PortraitTile
            character={character}
            variant="small"
            label="Small"
            hint="Used in the character panel"
            url={character.portrait}
            present={character.hasSmallPortrait}
            onUploaded={onUploaded}
          />
          <PortraitTile
            character={character}
            variant="big"
            label="Big"
            hint="Full-size portrait"
            url={character.bigPortrait}
            present={character.hasBigPortrait}
            onUploaded={onUploaded}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PortraitTile({
  character,
  variant,
  label,
  hint,
  url,
  present,
  onUploaded,
}: {
  character: Character;
  variant: Variant;
  label: string;
  hint: string;
  url: string;
  present: boolean;
  onUploaded: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    if (file.size > PORTRAIT_MAX_BYTES) {
      setError(`Image too large (max ${Math.floor(PORTRAIT_MAX_BYTES / (1024 * 1024))}MB)`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        campaign: character.campaign,
        character: character.slug,
        variant,
      });
      const r = await fetch(`/api/portrait?${params.toString()}`, {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => "");
        throw new Error(detail || `${r.status}`);
      }
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`portrait-tile portrait-tile-${variant}`}>
      <div className="portrait-tile-head">
        <div className="portrait-tile-label">{label}</div>
        <div className="portrait-tile-hint">{hint}</div>
      </div>
      {present ? (
        <img className="portrait-tile-img" src={url} alt={`${character.name} ${label.toLowerCase()} portrait`} />
      ) : (
        <div className="portrait-tile-placeholder">No {label.toLowerCase()} portrait yet</div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={PORTRAIT_ACCEPT}
        onChange={onPickFile}
        style={{ display: "none" }}
      />
      <button
        type="button"
        className="portrait-tile-upload"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? "Uploading…" : "Update"}
      </button>
      {error && <div className="portrait-tile-err">{error}</div>}
    </div>
  );
}
