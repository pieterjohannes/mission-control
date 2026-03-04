// SSE endpoint alias — forwards to the same event stream as /api/events
import { addClient, removeClient } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  let clientId: string;

  const stream = new ReadableStream({
    start(controller) {
      clientId = addClient(controller);
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`)
      );
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(keepalive);
        }
      }, 15000);
    },
    cancel() {
      if (clientId) removeClient(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
