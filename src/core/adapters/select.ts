import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { UserSelection, AdapterSelection } from "./types.js";

export type SelectionResult = {
  selection: UserSelection;
  error: string | null;
};

export async function loadSelection(rootDir: string): Promise<SelectionResult> {
  const configPath = join(rootDir, "blueprinter.json");

  try {
    const content = await readFile(configPath, "utf8");
    const config = JSON.parse(content);

    if (!config.adapters || typeof config.adapters !== "object") {
      return { selection: { adapters: {} }, error: null };
    }

    return { selection: { adapters: config.adapters }, error: null };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { selection: { adapters: {} }, error: null };
    }
    return { selection: { adapters: {} }, error: `Failed to load selection: ${error instanceof Error ? error.message : error}` };
  }
}

export async function saveSelection(rootDir: string, selection: UserSelection): Promise<string | null> {
  const configPath = join(rootDir, "blueprinter.json");

  try {
    let config: Record<string, unknown> = {};

    try {
      const content = await readFile(configPath, "utf8");
      config = JSON.parse(content);
    } catch {
      // File doesn't exist or is invalid, start fresh
    }

    config.adapters = selection.adapters;

    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");

    return null;
  } catch (error) {
    return `Failed to save selection: ${error instanceof Error ? error.message : error}`;
  }
}

export async function addAdapter(
  rootDir: string,
  module: string,
  provider: string,
): Promise<{ selection: UserSelection; error: string | null }> {
  const { selection, error } = await loadSelection(rootDir);
  if (error) {
    return { selection, error };
  }

  selection.adapters[module] = provider;

  const saveError = await saveSelection(rootDir, selection);
  if (saveError) {
    return { selection, error: saveError };
  }

  return { selection, error: null };
}

export async function removeAdapter(
  rootDir: string,
  module: string,
): Promise<{ selection: UserSelection; error: string | null }> {
  const { selection, error } = await loadSelection(rootDir);
  if (error) {
    return { selection, error };
  }

  delete selection.adapters[module];

  const saveError = await saveSelection(rootDir, selection);
  if (saveError) {
    return { selection, error: saveError };
  }

  return { selection, error: null };
}

export function getAdapterForModule(
  selection: UserSelection,
  module: string,
): string | AdapterSelection | null {
  const adapter = selection.adapters[module];
  if (!adapter) {
    return null;
  }
  return adapter;
}

export function getPrimaryAdapter(
  selection: UserSelection,
  module: string,
): string | null {
  const adapter = selection.adapters[module];
  if (!adapter) {
    return null;
  }
  if (typeof adapter === "string") {
    return adapter;
  }
  return adapter.primary;
}
