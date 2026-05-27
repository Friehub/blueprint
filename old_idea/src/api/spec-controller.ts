import { FastifyRequest, FastifyReply } from "fastify";
import { KnowledgeGraph } from "../knowledge/graph";
import { runPipeline } from "../pipeline/orchestrator";
import { sseEmitter } from "./sse";
import * as storage from "../storage";
import { z } from "zod";

const CreateSpecSchema = z.object({
  prompt: z.string().min(10),
  user_context: z.string().optional(),
  options: z.object({
    scaffold_target: z.enum(["typescript-node", "rust-axum", "solidity"]).optional(),
    parent_spec_id: z.string().optional(),
  }).optional(),
});

export class SpecController {
  constructor(private graph: KnowledgeGraph) {}

  async createSpec(request: FastifyRequest, reply: FastifyReply) {
    const body = CreateSpecSchema.parse(request.body);
    const userId = (request as any).user.id;

    const specId = await storage.specRuns.create({
      userId,
      prompt: body.prompt,
      domain: "fintech",
      options: body.options || {},
      parentSpecId: body.options?.parent_spec_id,
    });

    // Start pipeline in background
    runPipeline({
      specRunId: specId,
      prompt: body.prompt,
      userContext: body.user_context,
      knowledgeGraph: this.graph,
      emitter: sseEmitter,
      scaffoldTarget: body.options?.scaffold_target,
    }).catch(console.error);

    return reply.status(202).send({
      id: specId,
      status: "running",
      stream_url: `/v1/specs/${specId}/stream`
    });
  }

  async getSpec(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const spec = await storage.specRuns.get(id);
    if (!spec) return reply.status(404).send({ error: "Spec not found" });
    return spec;
  }

  async getSpecResult(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const rendered = await storage.renderedSpecs.get(id);
    if (!rendered) return reply.status(404).send({ error: "Result not available yet" });
    return { markdown: rendered.markdown };
  }

  async submitClarifications(request: FastifyRequest, reply: FastifyReply) {
    // TODO: Implement clarification resumption logic
    return reply.status(501).send({ error: "Not implemented" });
  }
}
