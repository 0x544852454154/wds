"use client";

import { useEffect, useMemo, useState } from "react";

import type { PublicPresence } from "@/lib/public";

export interface LiveMember extends PublicPresence {
  /** Client clock at first sight of the activity, for elapsed timers. */
  seenAt?: number;
}

const STATUSES = new Set(["online", "idle", "dnd", "offline"]);

function normalize(raw: PublicPresence): LiveMember {
  return {
    ...raw,
    status: (STATUSES.has(raw.status) ? raw.status : "offline") as LiveMember["status"],
  };
}

/**
 * Subscribes to the server presence relay.
 *
 * Every payload is keyed by an anonymous server-assigned index; the Discord
 * snowflake table stays in `lib/presence.server.ts` and is never shipped.
 */
export function usePresence(seed: PublicPresence[]) {
  const seedKey = useMemo(() => seed.length, [seed]);

  const [members, setMembers] = useState<Map<number, LiveMember>>(() => {
    const map = new Map<number, LiveMember>();
    for (const raw of seed) map.set(raw.i, normalize(raw));
    return map;
  });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let cycle: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      // The relay is a serverless function and the platform will cut it off
      // when its duration budget runs out. EventSource reports that as an
      // error, so reconnect before the platform does: cycle at 8s, which sits
      // under the 10s free-tier cap with room for cold-start drift.
      const CYCLE_MS = 8000;
      source = new EventSource("/api/presence/stream");

      source.onopen = () => setConnected(true);

      source.addEventListener("presence", (event) => {
        let raw: PublicPresence;
        try {
          raw = JSON.parse((event as MessageEvent).data) as PublicPresence;
        } catch {
          return;
        }
        if (typeof raw?.i !== "number") return;
        const member = normalize(raw);
        setMembers((prev) => {
          const next = new Map(prev);
          const existing = next.get(member.i);
          next.set(member.i, { ...member, seenAt: existing?.seenAt });
          return next;
        });
      });

      source.onerror = () => {
        setConnected(false);
        source?.close();
        source = null;
        if (!closed) retry = setTimeout(connect, 1000);
      };

      // Re-cycle the connection ahead of the platform's cutoff.
      cycle = setTimeout(() => {
        if (closed) return;
        source?.close();
        source = null;
        setConnected(false);
        retry = setTimeout(connect, 150);
      }, CYCLE_MS);
    };

    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      if (cycle) clearTimeout(cycle);
      source?.close();
    };
  }, [seedKey]);

  return { members, connected };
}