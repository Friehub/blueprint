import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Catalog, ModuleContract } from "../core/catalog.js";
import type { AdapterDefinition } from "../core/adapters/types.js";
import type {
  Language,
  GenerationType,
  GeneratorContext,
  GeneratorResult,
  GeneratedFile,
  LanguageGenerator,
} from "./types.js";

export type GenerateOptions = {
  language: Language;
  type: GenerationType;
  module: string | undefined;
  provider: string | undefined;
  outputDir: string;
};

export type EngineResult = {
  files: GeneratedFile[];
  errors: string[];
};

const generators = new Map<Language, LanguageGenerator>();

export function registerGenerator(generator: LanguageGenerator): void {
  generators.set(generator.language, generator);
}

export function getGenerator(language: Language): LanguageGenerator | undefined {
  return generators.get(language);
}

export function getAvailableLanguages(): Language[] {
  return [...generators.keys()];
}

export async function generate(
  catalog: Catalog,
  adapters: AdapterDefinition[],
  options: GenerateOptions,
): Promise<EngineResult> {
  const generator = generators.get(options.language);
  if (!generator) {
    return {
      files: [],
      errors: [`Generator for language "${options.language}" not registered`],
    };
  }

  const context: GeneratorContext = {
    catalog,
    adapters,
    module: options.module,
    provider: options.provider,
  };

  let result: GeneratorResult;

  switch (options.type) {
    case "interfaces":
      result = generator.generateInterfaces(context);
      break;
    case "adapters":
      result = generator.generateAdapter(context);
      break;
    case "tests":
      result = generator.generateTests(context);
      break;
    case "all":
      result = mergeResults(
        generator.generateInterfaces(context),
        generator.generateAdapter(context),
        generator.generateTests(context),
      );
      break;
    default:
      result = { files: [], errors: [`Unknown generation type: ${options.type}`] };
  }

  return result;
}

export async function generateAndWrite(
  catalog: Catalog,
  adapters: AdapterDefinition[],
  options: GenerateOptions,
): Promise<{ written: number; errors: string[] }> {
  const result = await generate(catalog, adapters, options);

  let written = 0;
  const errors = [...result.errors];

  for (const file of result.files) {
    try {
      const fullPath = join(options.outputDir, file.path);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, file.content, "utf8");
      written++;
    } catch (error) {
      errors.push(`Failed to write ${file.path}: ${error instanceof Error ? error.message : error}`);
    }
  }

  return { written, errors };
}

function mergeResults(...results: GeneratorResult[]): GeneratorResult {
  const files: GeneratedFile[] = [];
  const errors: string[] = [];

  for (const result of results) {
    files.push(...result.files);
    errors.push(...result.errors);
  }

  return { files, errors };
}

export function filterModules(catalog: Catalog, moduleName?: string): ModuleContract[] {
  if (!moduleName) {
    return catalog.modules;
  }
  return catalog.modules.filter((m) => m.name === moduleName);
}

export function filterAdapters(adapters: AdapterDefinition[], moduleName?: string, provider?: string): AdapterDefinition[] {
  return adapters.filter((a) => {
    if (moduleName && a.module !== moduleName) return false;
    if (provider && a.name !== provider) return false;
    return true;
  });
}
