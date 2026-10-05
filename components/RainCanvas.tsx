"use client";

import { useEffect, useRef } from "react";

import { subscribe } from "@/lib/ticker";

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion:reduce)").matches === true;

/**
 * Matrix-style glyph rain drawn on a 2D canvas.
 * Columns are sized in device-independent units so density holds across DPR.
 */
export function RainCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const GLYPHS = "01<>/\\|+=*:.#%";
    const COLUMN_WIDTH = 22;
    const ROW_HEIGHT = 14;
    const LINE_LENGTH_MAX = 15;

    interface Column {
      y: number;
      speed: number;
      length: number;
    }

    let columns: Column[] = [];
    let width = 0;
    let height = 0;

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const rebuild = () => {
      const count = Math.ceil(width / COLUMN_WIDTH);
      columns = [];
      for (let i = 0; i < count; i++) {
        columns.push({
          y: Math.random() * height,
          speed: 1 + Math.random() * 2.4,
          length: 6 + (Math.random() * LINE_LENGTH_MAX - 9 | 0),
        });
      }
    };

    resize();
    rebuild();
    window.addEventListener("resize", resize);
    window.addEventListener("resize", rebuild);

    let unsubscribe = () => {};
    const frame = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.font = "12px monospace";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#d9d9d9";

      const count = Math.ceil(width / COLUMN_WIDTH);
      if (columns.length !== count) rebuild();

      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        col.y += col.speed;
        if (col.y - col.length * ROW_HEIGHT > height) {
          col.y = -Math.random() * 200;
          col.speed = 1 + Math.random() * 2.4;
        }
        const row = (col.y / ROW_HEIGHT) | 0;
        for (let k = 0; k < col.length; k++) {
          ctx.globalAlpha = k ? 0.1 * (1 - k / col.length) : 0.24;
          const index = Math.abs(i * 131 + (row - k) * 37) % GLYPHS.length;
          ctx.fillText(GLYPHS.charAt(index), i * COLUMN_WIDTH + 4, col.y - k * ROW_HEIGHT);
        }
      }

      ctx.globalAlpha = 1;
    };

    if (REDUCED_MOTION) {
      ctx.clearRect(0, 0, width, height);
    } else {
      // Steps off the shared page ticker rather than its own rAF loop.
      unsubscribe = subscribe(frame);
    }

    return () => {
      unsubscribe();
      window.removeEventListener("resize", resize);
      window.removeEventListener("resize", rebuild);
    };
  }, []);

  return <canvas id="rain" ref={canvasRef} aria-hidden="true" />;
}