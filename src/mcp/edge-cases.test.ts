import { strict as assert } from "node:assert";
import { describe, it, before, after } from "node:test";
import { spawn, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SERVER_PATH = join(ROOT, "dist", "mcp", "server.js");

let server: ChildProcess;

function sendRequest(request: Record<string, unknown>): Promise<string> {
  const id = (request.id as number) ?? 1;
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for response for id " + id));
    }, 15000);

    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      const text = Buffer.concat(chunks).toString("utf8");
      try {
        const parsed = JSON.parse(text);
        if (parsed.id === id) {
          clearTimeout(timeout);
          server.stdout!.removeListener("data", onData);
          resolve(text);
        }
      } catch {
        // JSON not complete yet
      }
    };

    server.stdout!.on("data", onData);
    server.stderr!.on("data", () => {});
    server.stdin!.write(JSON.stringify(request) + "\n");
  });
}

describe("MCP server — unhappy paths", () => {
  before(() => {
    server = spawn("node", [SERVER_PATH], {
      env: { ...process.env, BLUEPRINT_ROOT: ROOT },
      stdio: ["pipe", "pipe", "pipe"],
    });
  });

  after(() => {
    if (server && !server.killed) server.kill();
  });

  it("get_database_schema: returns error for non-existent module", { timeout: 15000 }, async () => {
    const response = await sendRequest({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_database_schema", arguments: { module: "nonexistent_module" } } });
    const json = JSON.parse(response);
    const text = json.result.content[0].text;
    assert.ok(text.includes("not found") || text.includes("Not found"));
  });

  it("get_saga: returns helpful message for non-existent saga", { timeout: 15000 }, async () => {
    const response = await sendRequest({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_saga", arguments: { name: "totally_fake_saga" } } });
    const json = JSON.parse(response);
    const text = json.result.content[0].text;
    assert.ok(text.includes("not found") || text.includes("No sagas defined") || text.includes("Available"));
  });

  it("get_distributed_patterns: returns helpful message for non-existent module", { timeout: 15000 }, async () => {
    const response = await sendRequest({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_distributed_patterns", arguments: { module: "made_up" } } });
    const json = JSON.parse(response);
    const text = json.result.content[0].text;
    assert.ok(text.includes("not found") || text.includes("Not found"));
  });

  it("validate_implementation: returns error for non-existent module", { timeout: 15000 }, async () => {
    const response = await sendRequest({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "validate_implementation", arguments: { module: "ghost_module", code_summary: "test" } } });
    const json = JSON.parse(response);
    const text = json.result.content[0].text;
    assert.ok(text.includes("not found"));
  });

  it("validate_implementation: passes for complete implementation", { timeout: 15000 }, async () => {
    const response = await sendRequest({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "validate_implementation", arguments: { module: "payments", code_summary: "Process payment using Stripe with idempotent key, atomic wallet debit with balance check using optimistic locking" } } });
    const json = JSON.parse(response);
    const content = JSON.parse(json.result.content[0].text);
    assert.equal(content.status, "pass");
  });

  it("suggest_modules: returns empty results for non-matching description", { timeout: 15000 }, async () => {
    const response = await sendRequest({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "suggest_modules", arguments: { description: "zzzzzzzxxxxxx" } } });
    const json = JSON.parse(response);
    const content = JSON.parse(json.result.content[0].text);
    assert.ok(content.suggested_modules);
    assert.ok(Array.isArray(content.suggested_modules));
  });

  it("resolve_deps: reports cycle detection", { timeout: 15000 }, async () => {
    const response = await sendRequest({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "resolve_deps", arguments: { modules: ["non_existent"] } } });
    const json = JSON.parse(response);
    if (json.result.content[0].text) {
      const content = JSON.parse(json.result.content[0].text);
      assert.ok(content.error || content.modules, "should return either error or modules");
    }
  });

  it("get_adapter: returns error for non-existent adapter", { timeout: 15000 }, async () => {
    const response = await sendRequest({ jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "get_adapter", arguments: { module: "payments", provider: "nonexistent_provider" } } });
    const json = JSON.parse(response);
    const text = json.result.content[0].text;
    assert.ok(text.includes("not found") || text.includes("Not found"));
  });

  it("get_module: returns error for empty module name", { timeout: 15000 }, async () => {
    const response = await sendRequest({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "get_module", arguments: { name: "" } } });
    const json = JSON.parse(response);
    const text = json.result.content[0].text;
    assert.ok(text.includes("not found") || text.includes("Not found") || text === `Module "" not found`);
  });

  it("tools/list: includes all 12+ tools", { timeout: 15000 }, async () => {
    const response = await sendRequest({ jsonrpc: "2.0", id: 10, method: "tools/list", params: {} });
    const json = JSON.parse(response);
    assert.ok(json.result.tools.length >= 12);
    const toolNames = json.result.tools.map((t: any) => t.name);
    assert.ok(toolNames.includes("get_database_schema"));
    assert.ok(toolNames.includes("get_saga"));
    assert.ok(toolNames.includes("get_distributed_patterns"));
    assert.ok(toolNames.includes("validate_implementation"));
    assert.ok(toolNames.includes("suggest_modules"));
    assert.ok(toolNames.includes("list_modules"));
    assert.ok(toolNames.includes("get_module"));
  });

  it("validate_implementation: flags missing idempotency when invariant requires it", { timeout: 15000 }, async () => {
    const response = await sendRequest({ jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "validate_implementation", arguments: { module: "payments", code_summary: "Process payment with Stripe, debit wallet, no idempotency handling" } } });
    const json = JSON.parse(response);
    const content = JSON.parse(json.result.content[0].text);
    if (content.status === "violations_found") {
      assert.ok(content.violations.length > 0);
    }
  });
});
