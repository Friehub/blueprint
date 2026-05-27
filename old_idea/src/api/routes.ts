import { FastifyInstance } from "fastify";
import { KnowledgeGraph } from "../knowledge/graph";
import { SpecController } from "./spec-controller";
import { sseHandler } from "./sse";

export async function registerRoutes(app: FastifyInstance, graph: KnowledgeGraph) {
  const controller = new SpecController(graph);

  // Spec lifecycle
  app.post("/v1/specs", (req, rep) => controller.createSpec(req, rep));
  app.get("/v1/specs/:id", (req, rep) => controller.getSpec(req, rep));
  app.get("/v1/specs/:id/result", (req, rep) => controller.getSpecResult(req, rep));
  
  // SSE Stream
  app.get("/v1/specs/:id/stream", sseHandler);

  // Clarification
  app.post("/v1/specs/:id/clarifications", (req, rep) => controller.submitClarifications(req, rep));
}
