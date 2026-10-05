import { MEMBER_ROWS } from "@/lib/member-table.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DISCORD_CDN = "https://cdn.discordapp.com";
const CACHE_TTL_SECONDS = 60 * 60 * 24;

/**
 * Avatar proxy.
 *
 * Discord avatar URLs embed the user snowflake in the path, so serving them
 * straight to the browser publishes the member table in the HTML. This route
 * resolves the index to a snowflake server-side and streams the bytes, so the
 * client only ever holds `/api/avatar/<index>`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ index: string }> },
) {
  const { index } = await params;
  const slot = Number.parseInt(index, 10);

  if (!Number.isInteger(slot) || slot < 0 || slot >= MEMBER_ROWS.length) {
    return new Response("not found", { status: 404 });
  }

  const id = MEMBER_ROWS[slot].id;
  const fallback = `${DISCORD_CDN}/embed/avatars/${numberFromSnowflake(id) % 6}.png`;

  try {
    const presence = await fetch(
      `https://api.lanyard.rest/v1/users/${id}`,
      { headers: { accept: "application/json" }, next: { revalidate: 30 } },
    );
    const json = (await presence.json()) as {
      data?: { discord_user?: { avatar?: string | null } };
    };
    const avatar = json?.data?.discord_user?.avatar;

    if (!avatar) {
      return proxyImage(fallback, true);
    }

    const ext = avatar.startsWith("a_") ? "gif" : "png";
    return proxyImage(`${DISCORD_CDN}/avatars/${id}/${avatar}.${ext}?size=256`, false);
  } catch {
    return proxyImage(fallback, true);
  }
}

async function proxyImage(target: string, isFallback: boolean) {
  try {
    const upstream = await fetch(target, { next: { revalidate: CACHE_TTL_SECONDS } });
    if (!upstream.ok || !upstream.body) throw new Error(`upstream ${upstream.status}`);

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
        "Cache-Control": isFallback
          ? "public, max-age=86400, stale-while-revalidate=604800"
          : "public, max-age=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("unavailable", { status: 502 });
  }
}

function numberFromSnowflake(id: string): number {
  try {
    return Number((BigInt(id) >> BigInt(22)) % BigInt(6));
  } catch {
    return 0;
  }
}