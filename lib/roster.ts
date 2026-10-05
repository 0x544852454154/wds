export type PresenceStatus = "online" | "idle" | "dnd" | "offline";

export interface EmojiInfo {
  id?: string;
  name?: string;
  animated?: boolean;
}

export interface ActivityAssets {
  large_image?: string;
  large_text?: string;
}

export interface Activity {
  type: number;
  name?: string;
  details?: string;
  state?: string;
  emoji?: EmojiInfo;
  /** Resolved server-side so `application_id` never reaches the client. */
  art?: string | null;
  timestamps?: { start?: number; end?: number };
}

export interface SpotifyInfo {
  song?: string;
  artist?: string;
  album_art_url?: string;
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  display_name?: string | null;
  avatar?: string | null;
  avatar_decoration_data?: { asset?: string } | null;
}

export interface PresencePayload {
  discord_user: DiscordUser;
  discord_status?: PresenceStatus;
  activities?: RawActivity[];
  spotify?: SpotifyInfo | null;
}

const DISCORD_CDN = "https://cdn.discordapp.com";

/** Deterministic default avatar derived from a snowflake. Server-side only. */
export function defaultAvatarUrl(id: string): string {
  try {
    const index = Number((BigInt(id) >> BigInt(22)) % BigInt(6));
    return `${DISCORD_CDN}/embed/avatars/${index}.png`;
  } catch {
    return `${DISCORD_CDN}/embed/avatars/0.png`;
  }
}

export function avatarUrl(user: DiscordUser, size = 128): string {
  if (!user.avatar) return defaultAvatarUrl(user.id);
  const ext = user.avatar.startsWith("a_") ? "gif" : "png";
  return `${DISCORD_CDN}/avatars/${user.id}/${user.avatar}.${ext}?size=${size}`;
}

export function decorationUrl(user: DiscordUser | null | undefined): string | null {
  const asset = user?.avatar_decoration_data?.asset;
  if (!asset) return null;
  return `${DISCORD_CDN}/avatar-decoration-presets/${asset}.png?size=160&passthrough=true`;
}

export function emojiUrl(emoji: EmojiInfo): string | null {
  if (!emoji.id) return null;
  return `${DISCORD_CDN}/emojis/${emoji.id}${emoji.animated ? ".gif" : ".png"}`;
}

const ACTIVITY_LABELS: Record<number, string> = {
  0: "Playing",
  1: "Streaming",
  2: "Listening to",
  3: "Watching",
  4: "",
  5: "Competing in",
};

export function activityLabel(type: number): string {
  return ACTIVITY_LABELS[type] ?? "";
}

/** Upstream shape, used server-side before the payload is sanitised. */
export interface RawActivity extends Activity {
  assets?: ActivityAssets;
  application_id?: string;
}

export function activityArtwork(
  activity: RawActivity,
  spotify: SpotifyInfo | null | undefined,
): string | null {
  if (activity.name === "Spotify" && spotify?.album_art_url) return spotify.album_art_url;

  const image = activity.assets?.large_image;
  if (!image) return null;
  if (image.startsWith("mp:external/")) return `https://media.discordapp.net/external/${image.slice(12)}`;
  if (image.startsWith("mp:")) return `https://media.discordapp.net/${image.slice(3)}`;
  if (image.startsWith("spotify:")) return `https://i.scdn.co/image/${image.slice(8)}`;
  return activity.application_id
    ? `${DISCORD_CDN}/app-assets/${activity.application_id}/${image}.png`
    : null;
}

export function statusLabel(status: PresenceStatus | undefined): string {
  if (!status) return "not tracked";
  if (status === "dnd") return "do not disturb";
  return status;
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => (n < 10 ? "0" : "") + n;
  return (h ? `${pad(h)}:` : "") + `${pad(m)}:${pad(s)}`;
}

export const BGM_SRC =
  "https://file.garden/am9m147l3hw3nqT1/snaptik_7660817627039796487_v3.mp4";

export const LANYARD_SOCKET = "wss://api.lanyard.rest/socket";