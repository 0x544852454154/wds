export interface PublicPresence {
  i: number;
  status: string;
  name: string;
  handle: string;
  /** Proxy path. Never a direct CDN URL, which would embed the snowflake. */
  avatar: string;
  deco: string | null;
  activities: import("@/lib/roster").Activity[] | null;
  spotify: import("@/lib/roster").SpotifyInfo | null;
}