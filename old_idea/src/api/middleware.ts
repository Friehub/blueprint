import { FastifyRequest, FastifyReply } from "fastify";

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const auth = request.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "UNAUTHORIZED", message: "Bearer token required" });
    return;
  }
  const token = auth.slice(7);
  // Token format: ebp_live_sk_ or ebp_test_sk_
  if (!token.startsWith("ebp_")) {
    reply.code(401).send({ error: "INVALID_TOKEN", message: "Token must start with ebp_" });
    return;
  }
  // Attach environment to request
  (request as any).isTestEnv = token.startsWith("ebp_test_");
  // Hardcoded user for MVP
  (request as any).user = { id: "user_default" };
}
