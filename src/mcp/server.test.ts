import { strict as assert } from "node:assert";
import { describe, it, before, after } from "node:test";
import { spawn, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { mkdir, unlink } from "node:fs/promises";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SERVER_PATH = join(ROOT, "dist", "mcp", "server.js");

function sendRequest(proc: ChildProcess, request: Record<string, unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error("Timeout waiting for response"));
    }, 15000);

    proc.stdout!.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      const text = Buffer.concat(chunks).toString("utf8");
      if (text.includes("}")) {
        clearTimeout(timeout);
        resolve(text);
      }
    });

    proc.stderr!.on("data", () => {});
    proc.stdin!.write(JSON.stringify(request) + "\n");
  });
}

describe("MCP server", () => {
  let server: ChildProcess;

  before(() => {
    server = spawn("node", [SERVER_PATH], {
      env: { ...process.env, BLUEPRINTER_ROOT: ROOT },
      stdio: ["pipe", "pipe", "pipe"],
    });
  });

  after(() => {
    if (server && !server.killed) server.kill();
  });

  it("responds to tools/list", { timeout: 15000 }, async () => {
    const response = await sendRequest(server, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });
    const json = JSON.parse(response);
    assert.ok(json.result, "should have result");
    assert.ok(json.result.tools, "should have tools array");
    assert.ok(json.result.tools.length >= 7, "should have at least 7 tools");
  });

  it("responds to list_modules", { timeout: 15000 }, async () => {
    const response = await sendRequest(server, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "list_modules", arguments: {} },
    });
    const json = JSON.parse(response);
    const content = JSON.parse(json.result.content[0].text);
    assert.ok(content.total >= 100, "should have 108 modules");
    assert.ok(content.modules.length >= 100);
  });

  it("responds to get_module for payments", { timeout: 15000 }, async () => {
    const response = await sendRequest(server, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_module", arguments: { name: "payments" } },
    });
    const json = JSON.parse(response);
    const content = JSON.parse(json.result.content[0].text);
    assert.equal(content.name, "payments");
    assert.ok(content.functions.length >= 10);
  });

  it("returns error for unknown module", { timeout: 15000 }, async () => {
    const response = await sendRequest(server, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "get_module", arguments: { name: "nonexistent" } },
    });
    const json = JSON.parse(response);
    const text = json.result.content[0].text;
    assert.ok(text.includes("not found") || text.includes("Not found"));
  });

  it("responds to search_modules", { timeout: 15000 }, async () => {
    const response = await sendRequest(server, {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "search_modules", arguments: { query: "payment" } },
    });
    const json = JSON.parse(response);
    const content = JSON.parse(json.result.content[0].text);
    assert.ok(content.total > 0);
    assert.ok(content.results.some((r: any) => r.name === "payments"));
  });

  it("responds to resolve_deps", { timeout: 15000 }, async () => {
    const response = await sendRequest(server, {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "resolve_deps", arguments: { modules: ["billing"] } },
    });
    const json = JSON.parse(response);
    const content = JSON.parse(json.result.content[0].text);
    assert.ok(content.modules.length > 0);
    assert.ok(content.modules.some((m: any) => m.name === "billing"));
    assert.ok(content.modules.some((m: any) => m.name === "payments"));
  });

  it("responds to list_adapters", { timeout: 15000 }, async () => {
    const response = await sendRequest(server, {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "list_adapters", arguments: { module: "payments" } },
    });
    const json = JSON.parse(response);
    const content = JSON.parse(json.result.content[0].text);
    assert.ok(content.payments, "should have payments adapters");
    assert.ok(content.payments.includes("stripe"));
  });

  it("responds to get_adapter", { timeout: 15000 }, async () => {
    const response = await sendRequest(server, {
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: { name: "get_adapter", arguments: { module: "payments", provider: "stripe" } },
    });
    const json = JSON.parse(response);
    const content = JSON.parse(json.result.content[0].text);
    assert.equal(content.name, "stripe");
    assert.equal(content.module, "payments");
    assert.ok(content.config.required.length > 0);
  });
});
