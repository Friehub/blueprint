#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadCatalogFromRoot } from "../core/load-catalog.js";
import { resolve as resolveDeps, detectCycles } from "../core/resolve.js";
import { searchModules } from "../core/search.js";
import { loadAdapters } from "../core/adapters/load.js";
import type { Catalog, ModuleContract } from "../core/catalog.js";
import type { AdapterDefinition } from "../core/adapters/types.js";

const ROOT_DIR = process.env.BLUEPRINTER_ROOT || process.cwd();

const server = new Server(
  { name: "engineering-blueprinter", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

let catalog: Catalog | null = null;
let adapters: AdapterDefinition[] = [];

async function loadData() {
  if (!catalog) {
    const result = await loadCatalogFromRoot(ROOT_DIR, "loose");
    catalog = result.value!;
    const adapterResult = await loadAdapters(`${ROOT_DIR}/adapters`);
    adapters = adapterResult.adapters;
  }
}

function moduleSummary(m: ModuleContract) {
  return {
    name: m.name,
    version: m.version,
    functionCount: m.functions.length,
    hardDeps: m.hardDeps,
    softDeps: m.softDeps,
    coreInherits: m.coreInherits,
  };
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_modules",
      description: "List all available module contracts (108 modules)",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_module",
      description: "Get the full contract for a module including functions, types, and dependencies",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string", description: "Module name (e.g., payments, billing, auth)" } },
        required: ["name"],
      },
    },
    {
      name: "search_modules",
      description: "Search modules by name, summary, or function name",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", description: "Search query" } },
        required: ["query"],
      },
    },
    {
      name: "resolve_deps",
      description: "Resolve a set of modules with all transitive dependencies",
      inputSchema: {
        type: "object",
        properties: {
          modules: { type: "array", items: { type: "string" }, description: "Module names to resolve" },
        },
        required: ["modules"],
      },
    },
    {
      name: "list_adapters",
      description: "List available adapters (83 adapters across 35 modules)",
      inputSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "Optional: filter by module name" },
        },
      },
    },
    {
      name: "get_adapter",
      description: "Get adapter details including config requirements",
      inputSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "Module name" },
          provider: { type: "string", description: "Adapter provider name (e.g., stripe, redis)" },
        },
        required: ["module", "provider"],
      },
    },
    {
      name: "get_dependency_graph",
      description: "Get dependency graph (hard deps, soft deps) for a module",
      inputSchema: {
        type: "object",
        properties: { module: { type: "string", description: "Module name" } },
        required: ["module"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  await loadData();
  const { name, arguments: args } = request.params;
  const input = (args || {}) as Record<string, unknown>;

  try {
    switch (name) {
      case "list_modules": {
        const modules = (catalog?.modules || []).map(moduleSummary);
        return { content: [{ type: "text", text: JSON.stringify({ total: modules.length, modules }, null, 2) }] };
      }

      case "get_module": {
        const modName = input.name as string;
        const mod = catalog?.modules.find((m) => m.name === modName);
        if (!mod) return { content: [{ type: "text", text: `Module "${modName}" not found` }] };
        return { content: [{ type: "text", text: JSON.stringify(mod, null, 2) }] };
      }

      case "search_modules": {
        const query = input.query as string;
        const results = searchModules(catalog!, query);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              query,
              total: results.length,
              results: results.slice(0, 10).map((r) => ({
                name: r.module.name,
                score: r.score,
                matchType: r.matchType,
                summary: r.module.summary,
              })),
            }, null, 2),
          }],
        };
      }

      case "resolve_deps": {
        const modules = (input.modules as string[]) || [];
        const cycles = detectCycles(catalog!);
        if (cycles.length > 0) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Cycles detected", cycles }) }] };
        }
        const resolved = resolveDeps(catalog!, modules);
        return { content: [{ type: "text", text: JSON.stringify(resolved, null, 2) }] };
      }

      case "list_adapters": {
        const modName = input.module as string | undefined;
        const filtered = modName ? adapters.filter((a) => a.module === modName) : adapters;
        const grouped: Record<string, string[]> = {};
        for (const a of filtered) {
          const mod = a.module;
          if (!grouped[mod]) grouped[mod] = [];
          grouped[mod].push(a.name);
        }
        return { content: [{ type: "text", text: JSON.stringify(grouped, null, 2) }] };
      }

      case "get_adapter": {
        const modName = input.module as string;
        const provider = input.provider as string;
        const adapter = adapters.find((a) => a.module === modName && a.name === provider);
        if (!adapter) return { content: [{ type: "text", text: `Adapter "${provider}" not found for module "${modName}"` }] };
        return { content: [{ type: "text", text: JSON.stringify(adapter, null, 2) }] };
      }

      case "get_dependency_graph": {
        const modName = input.module as string;
        const mod = catalog?.modules.find((m) => m.name === modName);
        if (!mod) return { content: [{ type: "text", text: `Module "${modName}" not found` }] };
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              module: modName,
              hardDeps: mod.hardDeps,
              softDeps: mod.softDeps,
              coreInherits: mod.coreInherits,
              recommends: mod.softDeps,
              requiredBy: catalog?.modules.filter((m) => m.hardDeps.includes(modName)).map((m) => m.name),
              softDepsOf: catalog?.modules.filter((m) => m.softDeps.includes(modName)).map((m) => m.name),
            }, null, 2),
          }],
        };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    }
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }] };
  }
});

async function startMCP() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Engineering Blueprinter MCP server running on stdio");
  console.error(`Root directory: ${ROOT_DIR}`);
}

startMCP().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});
