"use client";

/**
 * Shared frame ticker.
 *
 * One rAF loop per document drives every animated surface on the page, so the
 * ASCII reveals, the rain and the banner all step off a single clock instead
 * of each starting its own loop. Subscribers are held weakly by lifecycle:
 * `subscribe` returns the unsubscribe function.
 */

type TickFn = (now: number) => void;

const subscribers = new Set<TickFn>();
let rafId: number | null = null;
let subscriberCount = 0;

function loop(now: number) {
  for (const fn of [...subscribers]) {
    try {
      fn(now);
    } catch {
      // A failing subscriber must not stall the page's other animations.
      subscribers.delete(fn);
    }
  }
  if (subscribers.size > 0) {
    rafId = requestAnimationFrame(loop);
  } else {
    rafId = null;
  }
}

export function subscribe(fn: TickFn): () => void {
  subscribers.add(fn);
  subscriberCount = subscribers.size;

  if (rafId === null) {
    rafId = requestAnimationFrame(loop);
  }

  return () => {
    subscribers.delete(fn);
    subscriberCount = subscribers.size;
    if (subscriberCount === 0 && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}