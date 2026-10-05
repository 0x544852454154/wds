import { MEMBER_IDS } from "@/lib/member-table.server";
import { publicPresenceFromUnknown } from "@/lib/presence.server";
import { LANYARD_SOCKET } from "@/lib/roster";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Presence relay.
 *
 * The browser subscribes here instead of talking to Lanyard directly. The
 * upstream gateway only ever receives server-held snowflake IDs, and clients
 * only ever receive the anonymous index plus public profile fields, so the
 * member table never exists in client-controlled memory.
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const abort = new AbortController();
  const signal = abort.signal;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let socket: WebSocket | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let reconnect: ReturnType<typeof setTimeout> | null = null;
      let closed = false;

      const enqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      // Flush immediately. Without a first write, the runtime holds the
      // response headers until the first upstream frame or keep-alive, which
      // is up to 20s of apparent hang for the client and for any intermediary
      // that buffers.
      enqueue(": connected\nretry: 3000\n\n");

      const send = (event: string, data: unknown) => {
        enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const teardown = () => {
        if (heartbeat) clearInterval(heartbeat);
        if (reconnect) clearTimeout(reconnect);
        heartbeat = null;
        reconnect = null;
        if (socket) {
          socket.onopen = null;
          socket.onmessage = null;
          socket.onclose = null;
          socket.onerror = null;
          try {
            socket.close();
          } catch {
            /* upstream already closed */
          }
          socket = null;
        }
      };

      const connect = () => {
        if (closed) return;
        try {
          socket = new WebSocket(LANYARD_SOCKET);
        } catch {
          reconnect = setTimeout(connect, 3000);
          return;
        }

        socket.onmessage = (event) => {
          let message: { op?: number; d?: Record<string, unknown> };
          try {
            message = JSON.parse(String(event.data));
          } catch {
            return;
          }

          if (message.op === 1) {
            const interval =
              (message.d as { heartbeat_interval?: number } | undefined)?.heartbeat_interval ??
              45000;
            if (heartbeat) clearInterval(heartbeat);
            heartbeat = setInterval(() => {
              try {
                socket?.send(JSON.stringify({ op: 3 }));
              } catch {
                /* closed mid-interval */
              }
            }, interval);
            // Subscribe with the real ID list. An empty array is not a
            // wildcard here: Lanyard accepts it and then never sends a frame.
            // These IDs never leave the server.
            socket?.send(JSON.stringify({ op: 2, d: { subscribe_to_ids: MEMBER_IDS } }));
            return;
          }

          if (message.op === 0 && message.d) {
            const frame = message.d as Record<string, unknown>;
            const candidates = frame.discord_user
              ? [frame]
              : (Object.values(frame) as Record<string, unknown>[]);

            for (const candidate of candidates) {
              const presence = publicPresenceFromUnknown(candidate);
              if (presence) send("presence", presence);
            }
          }
        };

        socket.onclose = () => {
          if (heartbeat) clearInterval(heartbeat);
          if (!closed) reconnect = setTimeout(connect, 3000);
        };

        socket.onerror = () => {
          try {
            socket?.close();
          } catch {
            /* nothing to close */
          }
        };
      };

      connect();

      const keepAlive = setInterval(() => enqueue(": ping\n\n"), 20000);

      const onAbort = () => {
        closed = true;
        clearInterval(keepAlive);
        teardown();
        try {
          controller.close();
        } catch {
          /* already closed by the runtime */
        }
      };

      signal.addEventListener("abort", onAbort);
      request.signal.addEventListener("abort", onAbort);
    },

    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}