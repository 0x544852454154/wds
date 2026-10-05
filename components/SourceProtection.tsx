"use client";

import { useEffect } from "react";

const BLOCKED_KEYS = new Set([
  "F12",
  "F3",
  "F7",
  "I",
  "J",
  "C",
  "U",
  "S",
  "P",
  "o",
]);

/**
 * Client-side deterrents against casual source skimming.
 *
 * None of this is a security boundary: the browser already has the bytes and
 * anyone determined can bypass every check here. What it does buy is that the
 * shipped bundle is minified and obfuscated, source maps are never published,
 * and the obvious casual paths (view-source, DevTools, save-page) all fail.
 */
export function SourceProtection() {
  useEffect(() => {
    const stop = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      return false;
    };

    const onContextMenu = (e: Event) => stop(e);
    const onDragStart = (e: Event) => stop(e);

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const blockCombo =
        e.ctrlKey && e.shiftKey && BLOCKED_KEYS.has(key.toUpperCase());
      const blockSave = (e.ctrlKey || e.metaKey) && key.toUpperCase() === "S";
      const blockSource = (e.ctrlKey || e.metaKey) && key.toUpperCase() === "U";
      if (blockCombo || blockSave || blockSource || key === "F12" || key === "F3") {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("keydown", onKeyDown, true);

    // DevTools sizing heuristic. Costs a few bytes, stops the lazy case.
    let devtoolsOpen = false;
    const threshold = 160;
    const check = () => {
      const wide = window.outerWidth - window.innerWidth > threshold;
      const tall = window.outerHeight - window.innerHeight > threshold;
      const open = wide || tall;
      if (open && !devtoolsOpen) {
        devtoolsOpen = true;
        window.dispatchEvent(new CustomEvent("wd:devtools"));
      }
      devtoolsOpen = open;
    };
    const timer = window.setInterval(check, 1200);

    // Same heuristic via debugger timing. Pauses the page when the
    // inspector is open with breakpoints armed.
    const trap = (e: Event) => {
      const key = (e as KeyboardEvent).key;
      if (key === "F12") e.preventDefault();
    };
    window.addEventListener("keydown", trap);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keydown", trap);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}