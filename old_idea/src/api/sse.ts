import { FastifyReply } from "fastify";

type SseEvent = Record<string, unknown>;

export class SseEmitter {
  private connections: Map<string, FastifyReply[]> = new Map();

  register(specId: string, reply: FastifyReply): void {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    const existing = this.connections.get(specId) ?? [];
    this.connections.set(specId, [...existing, reply]);

    reply.raw.on("close", () => {
      const current = this.connections.get(specId) ?? [];
      this.connections.set(specId, current.filter((r) => r !== reply));
    });
  }

  emit(specId: string, eventType: string, data: SseEvent): void {
    const connections = this.connections.get(specId) ?? [];
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const conn of connections) {
      conn.raw.write(payload);
      if (eventType === "completed" || eventType === "failed") {
        conn.raw.end();
      }
    }
  }
}

export const sseEmitter = new SseEmitter();
