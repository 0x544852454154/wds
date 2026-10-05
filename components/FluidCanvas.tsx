"use client";

import { useEffect, useRef } from "react";

import { createFluidSimulation, type FluidController } from "@/lib/fluid";

/** WebGL fluid cursor layer. Fills transparent so page content stays visible. */
export function FluidCanvas({ enabled }: { enabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let controller: FluidController | null = null;
    try {
      controller = createFluidSimulation(canvas);
    } catch {
      controller = null;
    }

    return () => {
      controller?.destroy();
    };
  }, [enabled]);

  return <canvas id="fluid" ref={canvasRef} aria-hidden="true" />;
}