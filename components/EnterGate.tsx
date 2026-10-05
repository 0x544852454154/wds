"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAsciiArt } from "@/hooks/useAsciiArt";
import { BGM_SRC } from "@/lib/roster";

/**
 * Full-screen enter gate. The skull surface collapses on click, which is what
 * arms the rest of the page (banner decode, ambient art, audio).
 */
export function EnterGate({
  enterArt: enterArtSource,
  onEnter,
}: {
  enterArt: string;
  onEnter(): void;
}) {
  const options = useMemo(
    () => ({
      glyphs: ".:-=+*#%@",
      sweep: 2.2,
      jitter: 0.6,
      order: diagonal,
      glitchMin: 2500,
      glitchVar: 2500,
      glitchRows: 4,
      sweepDur: 2200,
      sweepEvery: 3000,
      sweepVar: 2500,
      sweepWidth: 2,
      up: false,
      idleOnly: false,
    }),
    [],
  );

  const [enterRef, enterArt] = useAsciiArt(enterArtSource, options);

  const [dismissed, setDismissed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    enterArt.start();
  }, [enterArt]);

  const dismiss = useCallback(() => {
    if (dismissed) return;
    setDismissed(true);

    enterArt.outro(performance.now(), 1.1);

    window.setTimeout(() => onEnter(), 1150);
    void audioRef.current?.play().catch(() => {});
  }, [dismissed, enterArt, onEnter]);

  return (
    <>
      <audio ref={audioRef} src={BGM_SRC} loop preload="auto" />
      <div
        id="enter"
        aria-label="Enter"
        data-dismissed={dismissed ? "" : undefined}
        onClick={dismiss}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            dismiss();
          }
        }}
        role="button"
        tabIndex={-1}
      >
        <pre id="enterart" className="art" ref={enterRef} />
      </div>
    </>
  );
}

function diagonal(r: number, c: number, rows: number, cols: number) {
  const dx = (c - cols / 2) / (cols / 2);
  const dy = (r - rows / 2) / (rows / 2);
  return Math.min(1, Math.sqrt(dx * dx * 0.5 + dy * dy * 0.5) / 0.9);
}