"use client";

import { useEffect, useState } from "react";

import type { LiveMember } from "@/hooks/usePresence";
import { activityLabel, emojiUrl, formatElapsed } from "@/lib/roster";

const STATUS_TEXT: Record<string, string> = {
  online: "online",
  idle: "idle",
  dnd: "do not disturb",
  offline: "offline",
};

export function ProfileModal({
  member,
  fallbackName,
  role,
  onClose,
}: {
  member: LiveMember | undefined;
  fallbackName: string;
  role: string;
  onClose(): void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const status = member?.status ?? "offline";
  const name = member?.name ?? fallbackName;
  const handle = member?.handle ?? fallbackName;
  const activities = member?.activities ?? null;

  const hasActivities = activities && activities.length > 0;

  return (
    <div id="pf" role="dialog" aria-modal="true" aria-label="Member profile">
      <div id="pfbk" onClick={onClose} />
      <div id="pfc">
        <button id="pfx" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <div id="pfav">
          <img
            id="pfimg"
            alt=""
            referrerPolicy="no-referrer"
            src={member?.avatar || `/api/avatar/${member?.i ?? 0}`}
          />
          {member?.deco ? <img id="pfdeco" alt="" referrerPolicy="no-referrer" src={member.deco} /> : null}
          <span id="pfdot" className={status} />
        </div>
        <div id="pfn">{name}</div>
        <div id="pfu">@{handle}</div>
        <div id="pfr">{role}</div>
        <div id="pfs">
          <span id="pfsd" className={status} />
          <span id="pfst">{member ? (STATUS_TEXT[status] ?? "not tracked") : "not tracked"}</span>
        </div>
        <div id="pfa">
          {!member ? (
            <div className="none">presence unavailable</div>
          ) : !hasActivities ? (
            <div className="none">no activity right now</div>
          ) : (
            activities.slice(0, 4).map((activity, i) => (
              <ActivityRow
                key={`${activity.type}-${i}`}
                activity={activity}
                presence={member}
                now={now}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface ActivityLike {
  type: number;
  name?: string;
  details?: string;
  state?: string;
  emoji?: { id?: string; name?: string; animated?: boolean };
  timestamps?: { start?: number };
  art?: string | null;
}

function ActivityRow({
  activity,
  presence,
  now,
}: {
  activity: ActivityLike;
  presence: LiveMember;
  now: number;
}) {
  if (activity.type === 4) {
    const label = (activity.state || "").trim();
    const emoji = emojiUrl(activity.emoji ?? {});
    if (!label && !emoji && !activity.emoji?.name) return null;
    return (
      <div className="cs">
        {emoji ? <img alt="" referrerPolicy="no-referrer" src={emoji} /> : null}
        {!emoji && activity.emoji?.name ? `${activity.emoji.name} ` : null}
        {label}
      </div>
    );
  }

  const art = activity.art;
  const caption = `${activityLabel(activity.type)} ${activity.name ?? ""}`.trim();
  const started = activity.timestamps?.start;

  return (
    <div className="act">
      {art ? <img alt="" referrerPolicy="no-referrer" src={art} /> : null}
      <div className="t">
        <b>{caption}</b>
        {activity.name === "Spotify" && presence.spotify ? (
          <>
            {presence.spotify.song ? <span>{presence.spotify.song}</span> : null}
            {presence.spotify.artist ? <span>{presence.spotify.artist}</span> : null}
          </>
        ) : (
          <>
            {activity.details ? <span>{activity.details}</span> : null}
            {activity.state ? <span>{activity.state}</span> : null}
          </>
        )}
        {started ? <span className="el">{formatElapsed(now - started)} elapsed</span> : null}
      </div>
    </div>
  );
}