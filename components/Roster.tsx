"use client";

import type { LiveMember } from "@/hooks/usePresence";

export interface RosterSlot {
  index: number;
  fallbackName: string;
}

export interface RosterGroup {
  name: string;
  slots: RosterSlot[];
}

export function Roster({
  groups,
  members,
  onSelect,
}: {
  groups: RosterGroup[];
  members: Map<number, LiveMember>;
  onSelect(index: number): void;
}) {
  return (
    <div id="roster">
      {groups.map((group) => (
        <section className="grp" key={group.name}>
          <div className="grp-h">
            {group.name}
            <i>[{group.slots.length}]</i>
          </div>
          <div className="row">
            {group.slots.map((slot) => {
              const live = members.get(slot.index);
              const name = live?.name ?? slot.fallbackName;
              const status = live?.status ?? "offline";
              const avatar = live?.avatar || "";
              const deco = live?.deco || null;

              return (
                <div
                  className="m"
                  key={slot.index}
                  title={name}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(slot.index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(slot.index);
                    }
                  }}
                >
                  <div className="av">
                    <img
                      className="pic"
                      alt=""
                      referrerPolicy="no-referrer"
                      src={avatar || `/api/avatar/${slot.index}`}
                      loading="lazy"
                    />
                    {deco ? <img className="deco" alt="" referrerPolicy="no-referrer" src={deco} /> : null}
                    <span className={`dot ${status}`} />
                  </div>
                  <div className="nm">{name}</div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}