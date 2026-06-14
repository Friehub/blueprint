import { readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export type DiscoveredFile = {
  file: string;
  kind: "module" | "core";
  name: string;
};

export type DiscoveryWarning = {
  message: string;
};

export async function discoverContractFiles(rootDir: string): Promise<{ files: DiscoveredFile[]; warnings: DiscoveryWarning[] }> {
  const contractsDir = join(rootDir, "contracts");
  const warnings: DiscoveryWarning[] = [];

  if (!(await dirExists(contractsDir))) {
    warnings.push({ message: `contracts directory not found: ${contractsDir}` });
    return { files: [], warnings };
  }

  const files = await walkMarkdown(contractsDir);

  return {
    files: files.map((file) => {
      const rel = relative(contractsDir, file);
      const isCore = rel.startsWith("core" + sep) || rel.startsWith("core/");
      return {
        file,
        kind: (isCore ? "core" : "module") as "module" | "core",
        name: basenameWithoutExtension(file),
      };
    }),
    warnings,
  };
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    const s = await stat(dir);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function walkMarkdown(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkMarkdown(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }

  return results.sort();
}

function basenameWithoutExtension(file: string): string {
  const parts = file.split(/[\\/]/);
  const filename = parts[parts.length - 1] ?? file;
  return filename.replace(/\.md$/i, "");
}
