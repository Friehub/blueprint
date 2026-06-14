import { readFile, readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { parse as parseYaml } from "yaml";
import type { AdapterDefinition, AdapterConfig, AdapterMetadata, AdapterConfigField, AdapterDependency } from "./types.js";

export type LoadResult = {
  adapters: AdapterDefinition[];
  errors: string[];
};

export async function loadAdapters(adaptersDir: string): Promise<LoadResult> {
  const adapters: AdapterDefinition[] = [];
  const errors: string[] = [];

  if (!(await dirExists(adaptersDir))) {
    return { adapters, errors };
  }

  const modules = await readdir(adaptersDir, { withFileTypes: true });

  for (const moduleEntry of modules) {
    if (!moduleEntry.isDirectory() || moduleEntry.name.startsWith("_")) {
      continue;
    }

    const moduleDir = join(adaptersDir, moduleEntry.name);
    const files = await readdir(moduleDir);

    for (const file of files) {
      if (!file.endsWith(".yaml") && !file.endsWith(".yml")) {
        continue;
      }

      const filePath = join(moduleDir, file);
      try {
        const content = await readFile(filePath, "utf8");
        const parsed = parseYaml(content);

        const adapter = parseAdapterDefinition(parsed, filePath);
        if (adapter) {
          adapters.push(adapter);
        }
      } catch (error) {
        errors.push(`Failed to load ${filePath}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  return { adapters, errors };
}

export async function loadAdapter(
  adaptersDir: string,
  module: string,
  provider: string,
): Promise<{ adapter: AdapterDefinition | null; error: string | null }> {
  const filePath = join(adaptersDir, module, `${provider}.yaml`);

  try {
    const content = await readFile(filePath, "utf8");
    const parsed = parseYaml(content);
    const adapter = parseAdapterDefinition(parsed, filePath);

    if (!adapter) {
      return { adapter: null, error: `Invalid adapter definition in ${filePath}` };
    }

    return { adapter, error: null };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { adapter: null, error: `Adapter not found: ${module}/${provider}` };
    }
    return { adapter: null, error: `Failed to load ${filePath}: ${error instanceof Error ? error.message : error}` };
  }
}

function parseAdapterDefinition(data: unknown, filePath: string): AdapterDefinition | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.name !== "string" || typeof obj.module !== "string" || typeof obj.version !== "string") {
    return null;
  }

  if (!Array.isArray(obj.implements)) {
    return null;
  }

  const config = parseConfig(obj.config);

  const adapter: AdapterDefinition = {
    name: obj.name,
    module: obj.module,
    version: obj.version,
    implements: obj.implements as string[],
    config,
  };

  if (typeof obj.description === "string") {
    adapter.description = obj.description;
  }

  if (Array.isArray(obj.does_not_implement)) {
    adapter.does_not_implement = obj.does_not_implement as string[];
  }

  if (Array.isArray(obj.dependencies)) {
    adapter.dependencies = parseDependencies(obj.dependencies);
  }

  if (typeof obj.metadata === "object" && obj.metadata !== null) {
    adapter.metadata = obj.metadata as AdapterMetadata;
  }

  if (Array.isArray(obj.languages)) {
    adapter.languages = (obj.languages as string[]).filter((l) =>
      ["typescript", "python", "go", "rust", "java"].includes(l),
    );
  }

  return adapter;
}

function parseConfig(data: unknown): AdapterConfig {
  const config: AdapterConfig = { required: [], optional: [] };

  if (!data || typeof data !== "object") {
    return config;
  }

  const obj = data as Record<string, unknown>;

  if (Array.isArray(obj.required)) {
    config.required = obj.required.filter((f): f is AdapterConfigField => {
      if (!f || typeof f !== "object") return false;
      const field = f as Record<string, unknown>;
      return typeof field.name === "string" && typeof field.type === "string";
    });
  }

  if (Array.isArray(obj.optional)) {
    config.optional = obj.optional.filter((f): f is AdapterConfigField => {
      if (!f || typeof f !== "object") return false;
      const field = f as Record<string, unknown>;
      return typeof field.name === "string" && typeof field.type === "string";
    });
  }

  return config;
}

function parseDependencies(data: unknown): AdapterDependency[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter((d): d is AdapterDependency => {
    if (!d || typeof d !== "object") return false;
    const dep = d as Record<string, unknown>;
    return typeof dep.module === "string" && typeof dep.purpose === "string";
  }) as AdapterDependency[];
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    const s = await stat(dir);
    return s.isDirectory();
  } catch {
    return false;
  }
}
