import { useCallback, useEffect, useMemo, useRef } from "react";

import { BRAILLE_GLYPHS } from "@/lib/art";
import { subscribe } from "@/lib/ticker";

interface ArtHandle {
  start(now?: number): void;
  outro(now?: number, duration?: number): void;
  step(now: number): void;
}

/** Stable façade returned by `useAsciiArt`; safe to call before mount. */
export interface ArtController {
  start(now?: number): void;
  outro(now?: number, duration?: number): void;
  step(now: number): void;
}

export interface ArtOptions {
  /** Glyph set used while characters are scrambled. */
  glyphs: string;
  /** Seconds for the reveal to traverse the whole surface. */
  sweep: number;
  /** Random extra seconds added per cell. */
  jitter: number;
  /** Per-cell reveal order in 0..1. */
  order(r: number, c: number, rows: number, cols: number): number;
  /** Minimum gap between glitch bursts, ms. */
  glitchMin: number;
  /** Random extra gap between glitch bursts, ms. */
  glitchVar: number;
  /** Rows hit per glitch burst. */
  glitchRows: number;
  /** Duration of a scan sweep, ms. */
  sweepDur: number;
  /** Gap between sweeps, ms. */
  sweepEvery: number;
  /** Random extra gap between sweeps, ms. */
  sweepVar: number;
  /** Sweep half-height in rows. */
  sweepWidth: number;
  /** Sweep travels upward when true. */
  up: boolean;
  /** Skip looping behaviour once the reveal finishes. */
  idleOnly: boolean;
}

export interface ArtController {
  /** Begin the reveal. `now` defaults to the current frame clock. */
  start(now?: number): void;
  /** Collapse the surface to nothing over `duration` seconds. */
  outro(now?: number, duration?: number): void;
  /** Advance one frame. Wired to the shared ticker; exposed for tests. */
  step(now: number): void;
}

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion:reduce)").matches === true;

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/**
 * Character-cell reveal engine used by every ASCII surface on the page.
 *
 * React owns the row elements; this hook mutates their textContent directly on
 * the animation frame so a 96-row by 60-column surface does not cause 5760
 * reconciliations per frame. The surface subscribes to the shared ticker in
 * `lib/ticker`, so all reveals step off one rAF loop.
 */
export function useAsciiArt<T extends HTMLElement = HTMLPreElement>(
  source: string,
  options: ArtOptions,
): [React.RefObject<T | null>, ArtController] {
  const hostRef = useRef<T | null>(null);
  const implRef = useRef<ArtHandle | null>(null);

  // Stable façade so consumers can drive the surface from effects without
  // touching refs during render. Stepping is wired to the shared ticker.
  const controller = useMemo<ArtController>(
    () => ({
      start(now?: number) {
        implRef.current?.start(now);
      },
      outro(now?: number, duration?: number) {
        implRef.current?.outro(now, duration);
      },
      step(now: number) {
        implRef.current?.step(now);
      },
    }),
    [],
  );

  const lines = useMemo(() => source.replace(/\n+$/, "").split("\n"), [source]);

  const build = useCallback((): ArtHandle | null => {
    const host = hostRef.current;
    if (!host) return null;
    const opts = options;
    const grid = lines;

    const rowCount = grid.length;
    let colCount = 0;
    for (const line of grid) colCount = Math.max(colCount, line.length);

    host.replaceChildren();
    const rows: HTMLDivElement[] = [];
    const timings: number[][] = [];
    const rowMax: number[] = [];
    const rowDone: boolean[] = new Array(rowCount).fill(false);
    const rowHot: boolean[] = new Array(rowCount).fill(false);

    for (let r = 0; r < rowCount; r++) {
      const el = document.createElement("div");
      host.appendChild(el);
      rows.push(el);

      const cells: number[] = [];
      let max = 0;
      for (let c = 0; c < grid[r].length; c++) {
        const ch = grid[r].charAt(c);
        if (ch === " " || ch === "⠀") {
          cells.push(-1);
        } else {
          const t = opts.order(r, c, rowCount, colCount) * opts.sweep + Math.random() * opts.jitter;
          cells.push(t);
          if (t > max) max = t;
        }
      }
      timings.push(cells);
      rowMax.push(max);
    }

    const glyph = () => opts.glyphs.charAt((Math.random() * opts.glyphs.length) | 0);

    const scramble = (line: string) => {
      let out = "";
      for (let i = 0; i < line.length; i++) {
        const ch = line.charAt(i);
        out += ch === " " || ch === "⠀" || Math.random() > 0.12 ? ch : glyph();
      }
      return out;
    };

    const state = {
      on: false,
      outroing: false,
      done: false,
      t0: 0,
      ot0: 0,
      gnext: 0,
      gend: 0,
      gsel: [] as number[],
      gdirty: false,
      sweeping: false,
      sweepStart: 0,
      sweepNext: 0,
      outroTimings: [] as number[][],
      outroMax: 0,
    };

    const finish = (clear: boolean) => {
      state.on = false;
      state.outroing = false;
      for (let r = 0; r < rowCount; r++) {
        rows[r].textContent = clear ? "" : grid[r];
      }
    };

    const handle: ArtHandle = {
      start(now = performance.now()) {
        state.t0 = now;
        state.on = true;
        state.done = false;
        state.outroing = false;
        state.gnext = now + (opts.sweep + opts.jitter) * 1000 + 2500;
        state.sweepNext = now + (opts.sweep + opts.jitter) * 1000 + 1200;
        if (REDUCED_MOTION) {
          for (let r = 0; r < rowCount; r++) {
            rows[r].textContent = grid[r];
            rowDone[r] = true;
          }
          state.done = true;
        }
      },

      outro(now = performance.now(), duration = 1.1) {
        state.outroTimings = [];
        state.outroMax = 0;
        for (let r = 0; r < rowCount; r++) {
          const cells: number[] = [];
          for (let c = 0; c < grid[r].length; c++) {
            const ch = grid[r].charAt(c);
            if (ch === " " || ch === "⠀") {
              cells.push(-1);
            } else {
              const v = opts.order(r, c, rowCount, colCount) * duration + Math.random() * 0.35;
              cells.push(v);
              if (v > state.outroMax) state.outroMax = v;
            }
          }
          state.outroTimings.push(cells);
        }
        state.on = true;
        state.outroing = true;
        state.ot0 = now;
        state.done = true;
        for (let r = 0; r < rowCount; r++) {
          rows[r].style.transform = "";
          rows[r].classList.remove("hot");
          rowDone[r] = true;
          rowHot[r] = false;
          rows[r].textContent = grid[r];
        }
        if (REDUCED_MOTION) finish(true);
      },

      step(now: number) {
        if (!state.on) return;
        const opts = options;

        if (state.outroing) {
          const u = (now - state.ot0) / 1000;
          for (let r = 0; r < rowCount; r++) {
            const line = grid[r];
            const cells = state.outroTimings[r];
            let out = "";
            for (let c = 0; c < line.length; c++) {
              const v = cells[c];
              if (v < 0 || u < v) out += line.charAt(c);
              else if (u < v + 0.3) out += glyph();
              else out += " ";
            }
            rows[r].textContent = out;
          }
          if (u > state.outroMax + 0.35) finish(true);
          return;
        }

        if (!state.done) {
          let complete = true;
          for (let r = 0; r < rowCount; r++) {
            if (rowDone[r]) continue;
            const t = (now - state.t0) / 1000;
            if (t > rowMax[r] + 0.35) {
              rows[r].textContent = grid[r];
              rowDone[r] = true;
              continue;
            }
            complete = false;
            const line = grid[r];
            const cells = timings[r];
            let out = "";
            for (let c = 0; c < line.length; c++) {
              const v = cells[c];
              if (v < 0) out += line.charAt(c);
              else if (t < v) out += " ";
              else if (t < v + 0.3) out += glyph();
              else out += line.charAt(c);
            }
            rows[r].textContent = out;
          }
          if (complete) state.done = true;
          return;
        }

        if (REDUCED_MOTION || opts.idleOnly) return;

        if (now > state.gnext) {
          state.gend = now + 140;
          state.gnext = now + opts.glitchMin + Math.random() * opts.glitchVar;
          state.gsel = [];
          for (let k = 0; k < opts.glitchRows; k++) state.gsel.push((Math.random() * rowCount) | 0);
        }
        const glitching = now < state.gend;
        if (glitching) {
          state.gdirty = true;
          for (const i of state.gsel) {
            rows[i].style.transform = `translateX(${rand(-0.8, 0.8).toFixed(2)}em)`;
            rows[i].textContent = scramble(grid[i]);
          }
        } else if (state.gdirty) {
          state.gdirty = false;
          for (const i of state.gsel) {
            rows[i].style.transform = "";
            rows[i].textContent = grid[i];
          }
        }

        if (!state.sweeping && now > state.sweepNext) {
          state.sweeping = true;
          state.sweepStart = now;
        }
        if (state.sweeping) {
          const p = (now - state.sweepStart) / opts.sweepDur;
          if (p > 1) {
            state.sweeping = false;
            state.sweepNext = now + opts.sweepEvery + Math.random() * opts.sweepVar;
            for (let r = 0; r < rowCount; r++) {
              if (rowHot[r]) {
                rowHot[r] = false;
                rows[r].classList.remove("hot");
              }
            }
          } else {
            const center = (opts.up ? 1 - p : p) * (rowCount + 2 * opts.sweepWidth) - opts.sweepWidth;
            for (let r = 0; r < rowCount; r++) {
              const hot = Math.abs(r - center) <= opts.sweepWidth;
              if (hot !== rowHot[r]) {
                rowHot[r] = hot;
                rows[r].classList.toggle("hot", hot);
              }
            }
          }
        }
      },
    };

    implRef.current = handle;
    return handle;
  }, [lines, options]);

  useEffect(() => {
    const impl = build();
    implRef.current = impl;
    if (!impl) return;

    const unsubscribe = subscribe((now) => impl.step(now));
    return () => {
      unsubscribe();
      implRef.current = null;
    };
  }, [build]);

  return [hostRef, controller];
}

export function brailleOrderByRow(r: number, _c: number, rows: number) {
  return r / rows;
}

export function brailleOrderDiagonal(r: number, c: number, rows: number, cols: number) {
  const dx = (c - cols / 2) / (cols / 2);
  const dy = (r - rows / 2) / (rows / 2);
  return Math.min(1, Math.sqrt(dx * dx * 0.5 + dy * dy * 0.5) / 0.9);
}

export function brailleOrderSweep(r: number, c: number, rows: number, cols: number) {
  return (c / cols) * 0.8 + (1 - r / rows) * 0.2;
}

export const ENTER_ORDER = brailleOrderDiagonal;
export const BG_ORDER = brailleOrderByRow;
export const BL_ORDER = brailleOrderSweep;
export { BRAILLE_GLYPHS };