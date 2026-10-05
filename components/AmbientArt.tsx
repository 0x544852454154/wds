"use client";

import { useEffect, useMemo } from "react";

import { useAsciiArt } from "@/hooks/useAsciiArt";

/**
 * One fixed ASCII surface (right edge / bottom edge) driven by the shared
 * reveal engine. Font sizing is derived from the viewport so the glyph grid
 * fills the same relative area on every screen size.
 */
export function AmbientArt({
  source,
  glyphs,
  id,
  variant,
}: {
  source: string;
  glyphs: string;
  id: string;
  variant: "bg" | "bl";
}) {
  const options = useMemo(
    () => ({
      glyphs,
      sweep: variant === "bg" ? 2.4 : 1.6,
      jitter: variant === "bg" ? 0.5 : 0.4,
      order: variant === "bg" ? byRow : bySweep,
      glitchMin: variant === "bg" ? 3000 : 3500,
      glitchVar: 4000,
      glitchRows: variant === "bg" ? 5 : 3,
      sweepDur: variant === "bg" ? 3200 : 2600,
      sweepEvery: variant === "bg" ? 4000 : 5500,
      sweepVar: 3000,
      sweepWidth: variant === "bg" ? 4 : 2,
      up: variant === "bl",
      idleOnly: false,
    }),
    [glyphs, variant],
  );

  const [hostRef, art] = useAsciiArt(source, options);

  const rowCount = useMemo(() => source.replace(/\n+$/, "").split("\n").length, [source]);
  const colCount = useMemo(
    () => source.replace(/\n+$/, "").split("\n").reduce((m, l) => Math.max(m, l.length), 0),
    [source],
  );

  useEffect(() => {
    const base = performance.now();
    const offset = variant === "bg" ? 350 : 700;
    const timer = window.setTimeout(() => art.start(base + offset), offset);
    return () => window.clearTimeout(timer);
  }, [art, variant]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const fit = () => {
      if (variant === "bg") {
        const heightBudget = window.innerHeight / rowCount;
        const widthBudget =
          (window.innerWidth * (window.innerWidth < 700 ? 0.42 : 0.2)) / (colCount * 0.6);
        host.style.fontSize = `${Math.max(4, Math.min(heightBudget, widthBudget))}px`;
      } else {
        const heightBudget = (window.innerHeight * 0.3) / rowCount;
        const widthBudget =
          (window.innerWidth * (window.innerWidth < 700 ? 0.5 : 0.24)) / (colCount * 0.6);
        host.style.fontSize = `${Math.max(4, Math.min(heightBudget, widthBudget))}px`;
      }
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [hostRef, variant, rowCount, colCount]);

  return <pre id={id} className="art" ref={hostRef} aria-hidden="true" />;
}

function byRow(r: number, _c: number, rows: number) {
  return r / rows;
}

function bySweep(r: number, c: number, rows: number, cols: number) {
  return (c / cols) * 0.8 + (1 - r / rows) * 0.2;
}