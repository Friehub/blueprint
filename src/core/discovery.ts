import { readdir } from "node:fs/promises";
import { join } from "node:path";

export type DiscoveredFile = {
  file: string;
  kind: "module" | "core";
  name: string;
};

export async function discoverContractFiles(rootDir: string): Promise<DiscoveredFile[]> {
  const modules = await listMarkdownFiles(rootDir, "contracts");
  const core = await listMarkdownFiles(join(rootDir, "contracts"), "core");

  return [
    ...modules.map((file) => ({ file, kind: "module" as const, name: basenameWithoutExtension(file) })),
    ...core.map((file) => ({ file, kind: "core" as const, name: basenameWithoutExtension(file) })),
  ];
}

async function listMarkdownFiles(baseDir: string, relativeDir: string): Promise<string[]> {
  const dir = join(baseDir, relativeDir);
  const entries = await readdir(dir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(dir, entry.name))
    .sort();
}

function basenameWithoutExtension(file: string): string {
  const parts = file.split(/[\\/]/);
  const filename = parts[parts.length - 1] ?? file;
  return filename.replace(/\.md$/i, "");
}
