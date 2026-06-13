import type { ModuleContract } from "../../core/catalog.js";
import type { AdapterDefinition } from "../../core/adapters/types.js";
import type { Language, GeneratorContext, GeneratorResult, GeneratedFile, LanguageGenerator } from "../types.js";
import { pascalCase, camelCase, snakeCase, kebabCase } from "../types.js";
import { resolveAlias, resolveModuleAlias, resolveClassAlias, obfuscateName } from "../aliases.js";
import {
  generatePhpInterface, generatePhpAdapter, generatePhpTest,
  generateLaravelServiceProvider, generateConfig,
} from "./helpers.js";

export class PhpGenerator implements LanguageGenerator {
  language: Language = "php";
  name = "PHP Generator (Laravel)";
  protected context: GeneratorContext | null = null;

  private resolveFnName(name: string): string {
    if (this.context?.obfuscate) return obfuscateName(this.context.obfuscate, name);
    return resolveAlias(name, this.context?.aliases);
  }

  private resolveModName(name: string): string {
    if (this.context?.obfuscate) return obfuscateName(this.context.obfuscate, name);
    return resolveModuleAlias(name, this.context?.aliases);
  }

  private resolveClsName(name: string, provider: string): string {
    if (this.context?.obfuscate) return obfuscateName(this.context.obfuscate, provider + "_" + name);
    return resolveClassAlias(`${pascalCase(provider)}Adapter`, this.context?.aliases);
  }

  generateInterfaces(context: GeneratorContext): GeneratorResult {
    this.context = context;
    const files: GeneratedFile[] = [];
    const errors: string[] = [];

    const mods = context.module
      ? context.catalog.modules.filter((m) => m.name === context.module)
      : context.catalog.modules;

    for (const mod of mods) {
      try {
        const modAlias = this.resolveModName(mod.name);
        const content = generatePhpInterface(mod, (n) => this.resolveFnName(n));
        files.push({ path: `php/src/${modAlias}/${interfaceName(mod.name)}.php`, content });
      } catch (e) {
        errors.push(`PHP interface generation failed for ${mod.name}: ${e}`);
      }
    }
    return { files, errors };
  }

  generateAdapter(context: GeneratorContext): GeneratorResult {
    this.context = context;
    const files: GeneratedFile[] = [];
    const errors: string[] = [];

    const mods = context.module
      ? context.catalog.modules.filter((m) => m.name === context.module)
      : context.catalog.modules;

    for (const mod of mods) {
      const modAdapters = context.adapters.filter((a) => a.module === mod.name);
      for (const adapter of modAdapters) {
        try {
          const content = generatePhpAdapter(mod, adapter, (n) => this.resolveFnName(n), (n, p) => this.resolveClsName(n, p));
          const modAlias = this.resolveModName(mod.name);
          files.push({ path: `php/src/${modAlias}/Adapters/${className(mod.name, adapter.name)}.php`, content });

          const provider = generateLaravelServiceProvider(mod, adapter);
          files.push({ path: `php/src/${modAlias}/Providers/${pascalCase(adapter.name)}${pascalCase(mod.name)}ServiceProvider.php`, content: provider });

          const cfg = generateConfig(mod, adapter);
          const bind = `${camelCase(mod.name)}.${adapter.name}`;
          files.push({ path: `php/config/${bind}.php`, content: cfg });

        } catch (e) {
          errors.push(`PHP adapter generation failed for ${mod.name}/${adapter.name}: ${e}`);
        }
      }
    }
    return { files, errors };
  }

  generateTests(context: GeneratorContext): GeneratorResult {
    this.context = context;
    const files: GeneratedFile[] = [];
    const errors: string[] = [];

    const mods = context.module
      ? context.catalog.modules.filter((m) => m.name === context.module)
      : context.catalog.modules;

    for (const mod of mods) {
      const modAdapters = context.adapters.filter((a) => a.module === mod.name);
      for (const adapter of modAdapters) {
        try {
          const content = generatePhpTest(mod, adapter, (n) => this.resolveFnName(n));
          files.push({ path: `php/tests/${pascalCase(adapter.name)}${pascalCase(mod.name)}AdapterTest.php`, content });
        } catch (e) {
          errors.push(`PHP test generation failed for ${mod.name}/${adapter.name}: ${e}`);
        }
      }
    }
    return { files, errors };
  }
}

function interfaceName(name: string): string {
  return `${pascalCase(name)}Contract`;
}

function className(name: string, provider: string): string {
  return `${pascalCase(provider)}${pascalCase(name)}Adapter`;
}
