import fastify from "fastify";
import { loadConfig } from "./config";
import { registerRoutes } from "./api/routes";
import { authMiddleware } from "./api/middleware";
import { KnowledgeGraph } from "./knowledge/graph";
import { loadFromMarkdown } from "./knowledge/loader";
import * as path from "path";

const config = loadConfig();
const app = fastify({ logger: true });

// Register Auth Middleware
app.addHook("preHandler", async (request, reply) => {
  if (request.url === "/health") return;
  return authMiddleware(request, reply);
});

app.get("/health", async () => {
  return { status: "ok", domain: "fintech" };
});

async function bootstrap() {
  try {
    // 1. Initialize Knowledge Base
    const kbPath = path.join(process.cwd(), "KNOWLEDGE_BASE.md");
    const graph = await loadFromMarkdown(kbPath);
    console.log(`Knowledge Base loaded: ${graph.getAllFailureModes().length} failure modes.`);

    // 2. Register Routes (passing the graph singleton)
    await registerRoutes(app, graph);

    // 3. Start Server
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    console.log(`Engineering Blueprinter API running on port ${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
