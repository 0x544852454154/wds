import { useCallback, useEffect, useRef } from "react";

import { BANNER_ART, BANNER_CHARS, bannerFontSize } from "@/lib/banner";
import { subscribe } from "@/lib/ticker";

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion:reduce)").matches === true;

function randomGlyph() {
  return BANNER_CHARS.charAt((Math.random() * BANNER_CHARS.length) | 0);
}

function decodeRow(line: string, reveal: number): string {
  let out = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (i < reveal) out += ch;
    else if (i < reveal + 10) out += ch === " " ? " " : randomGlyph();
    else out += " ";
  }
  return out;
}

/**
 * Rebuilds the ASCII banner one row at a time, then runs periodic glitch
 * bursts. The reveal clock is re-armed by `armed` so the gate screen can
 * hand control to the page after the user clicks through.
 */
export function useBannerReveal(armed: boolean) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const clockRef = useRef({ t0: 1e12, gnext: 5, gend: 0, gsel: [] as number[] });

  const paintStatic = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    for (const line of BANNER_ART) {
      const el = document.createElement("div");
      el.textContent = line;
      host.appendChild(el);
    }
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();

    const rows: HTMLDivElement[] = [];
    for (let i = 0; i < BANNER_ART.length; i++) {
      const el = document.createElement("div");
      host.appendChild(el);
      rows.push(el);
    }

    const done: boolean[] = new Array(BANNER_ART.length).fill(false);

    const unsubscribe = subscribe((now) => {
      const clock = clockRef.current;
      const t = (now - clock.t0) / 1000;

      for (let r = 0; r < BANNER_ART.length; r++) {
        const line = BANNER_ART[r];
        const reveal = (t - 0.3 - r * 0.14) * 75;
        if (reveal >= line.length + 10) {
          if (!done[r]) {
            rows[r].textContent = line;
            done[r] = true;
          }
        } else {
          done[r] = false;
          rows[r].textContent = decodeRow(line, reveal);
        }
      }

      if (t > 5) {
        if (now > clock.gnext) {
          clock.gend = now + 140;
          clock.gnext = now + 3500 + Math.random() * 3500;
          clock.gsel = [];
          for (let k = 0; k < 4; k++) clock.gsel.push((Math.random() * BANNER_ART.length) | 0);
        }
        const glitching = now < clock.gend;
        for (let r = 0; r < BANNER_ART.length; r++) {
          const hit = glitching && clock.gsel.indexOf(r) > -1;
          rows[r].style.transform = hit
            ? `translateX(${((Math.random() - 0.5) * 26).toFixed(2)}px)`
            : "";
          if (hit) {
            let text = "";
            for (let i = 0; i < BANNER_ART[r].length; i++) {
              text += Math.random() < 0.12 ? randomGlyph() : BANNER_ART[r].charAt(i);
            }
            rows[r].textContent = text;
          } else if (!glitching && done[r] && rows[r].textContent !== BANNER_ART[r]) {
            rows[r].textContent = BANNER_ART[r];
          }
        }
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!armed) return;
    if (REDUCED_MOTION) {
      paintStatic();
      return;
    }
    const now = performance.now();
    clockRef.current.t0 = now + 1000;
    clockRef.current.gnext = now + 9000;
  }, [armed, paintStatic]);

  useEffect(() => {
    const fit = () => {
      const host = hostRef.current;
      if (host) host.style.fontSize = `${bannerFontSize()}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return { hostRef };
}
