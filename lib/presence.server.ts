import "server-only";

import { MEMBER_IDS, resolveIndex } from "@/lib/member-table.server";
import type { Activity, PresencePayload, SpotifyInfo } from "@/lib/roster";
import { activityArtwork } from "@/lib/roster";
import type { PublicPresence } from "@/lib/public";

/**
 * Server-only presence translation.
 *
 * Snowflake IDs are resolved to anonymous indexes here, so no client bundle,
 * RSC payload, or API response ever contains the member table.
 */
export type { PublicPresence };

const LANYARD_REST = "https://api.lanyard.rest/v1/users";
const DISCORD_CDN = "https://cdn.discordapp.com";

export async function fetchPresence(ids: string[], timeoutMs = 6000): Promise<PublicPresence[]> {
  const results = await Promise.all(
    ids.map(async (id) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(`${LANYARD_REST}/${id}`, {
          signal: controller.signal,
          headers: { accept: "application/json" },
          next: { revalidate: 30 },
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { success?: boolean; data?: PresencePayload };
        return json?.success && json.data ? json.data : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  const out: PublicPresence[] = [];
  results.forEach((presence, index) => {
    if (presence) out.push(toPublic(presence, index));
  });
  return out;
}

/**
 * Whitelist copy of an activity, with artwork resolved here.
 *
 * The raw upstream object carries `application_id` and `assets.large_image`,
 * and `application_id` is itself a snowflake. Resolving the CDN URL on the
 * server and dropping both keeps identifiers out of the client payload.
 */
function sanitizeActivity(activity: Activity, spotify: SpotifyInfo | null | undefined): Activity {
  const out: Activity = { type: activity.type };
  if (activity.name) out.name = activity.name;
  if (activity.details) out.details = activity.details;
  if (activity.state) out.state = activity.state;
  if (activity.timestamps?.start) out.timestamps = { start: activity.timestamps.start };
  if (activity.emoji?.id || activity.emoji?.name) out.emoji = activity.emoji;
  out.art = activityArtwork(activity, spotify) ?? undefined;
  return out;
}

/** Strips server-only fields and rewrites the member key to an index. */
export function toPublic(presence: PresencePayload, index: number): PublicPresence {
  const user = presence.discord_user;
  return {
    i: index,
    status: presence.discord_status ?? "offline",
    name: user.global_name || user.display_name || user.username,
    handle: user.username,
    // Avatars go through the proxy: Discord CDN paths embed the snowflake.
    // Decoration presets do not, so those can be passed through directly.
    avatar: user.avatar ? `/api/avatar/${index}` : "",
    deco: user.avatar_decoration_data?.asset
      ? `${DISCORD_CDN}/avatar-decoration-presets/${user.avatar_decoration_data.asset}.png?size=160&passthrough=true`
      : null,
    activities: presence.activities
      ?.slice(0, 8)
      .map((activity) => sanitizeActivity(activity, presence.spotify)) ?? null,
    spotify: presence.spotify
      ? {
          song: presence.spotify.song,
          artist: presence.spotify.artist,
          album_art_url: presence.spotify.album_art_url,
        }
      : null,
  };
}

export function publicPresenceFromUnknown(payload: unknown): PublicPresence | null {
  const candidate = payload as { discord_user?: { id?: string } };
  const id = candidate?.discord_user?.id;
  if (!id) return null;
  const index = resolveIndex(id);
  if (index === undefined) return null;
  return toPublic(payload as PresencePayload, index);
}