// SSE Event Bus — in-memory broadcast to all connected clients

export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
};

const clients: SSEClient[] = [];

let clientIdCounter = 0;

export function addClient(controller: ReadableStreamDefaultController): string {
  const id = `client-${++clientIdCounter}`;
  clients.push({ id, controller });
  return id;
}

export function removeClient(id: string) {
  const idx = clients.findIndex((c) => c.id === id);
  if (idx !== -1) clients.splice(idx, 1);
}

export function broadcast(type: string, data: Record<string, unknown>) {
  const payload = `event: ${type}\ndata: ${JSON.stringify({ type, ...data, timestamp: new Date().toISOString() })}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(payload);

  const dead: string[] = [];
  for (const client of clients) {
    try {
      client.controller.enqueue(encoded);
    } catch {
      dead.push(client.id);
    }
  }
  // Clean up dead clients
  for (const id of dead) removeClient(id);
}

export function getClientCount() {
  return clients.length;
}
