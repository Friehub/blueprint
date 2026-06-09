import type { ModuleContract, ContractFunction } from "../../core/catalog.js";
import type { AdapterDefinition } from "../../core/adapters/types.js";
import { adapterSupportsLanguage } from "../../core/adapters/types.js";
import type { Language, GeneratorContext, GeneratorResult, GeneratedFile, LanguageGenerator } from "../types.js";
import { pascalCase, camelCase, mapType } from "../types.js";
import {
  generateTypeDefinition,
  generateFunctionSignature,
  generateParamsList,
  generateSharedTypes,
  generatePackageDeclaration,
} from "./helpers.js";

export class JavaGenerator implements LanguageGenerator {
  language: Language = "java";
  name = "Java Generator";
  protected context: GeneratorContext | null = null;

  generateInterfaces(context: GeneratorContext): GeneratorResult {
    this.context = context;
    const files: GeneratedFile[] = [];
    const errors: string[] = [];
    let modules = this.resolveModules(context);

    for (const mod of modules) {
      try {
        files.push({ path: `interfaces/${pascalCase(mod.name)}Contract.java`, content: this.generateModuleInterface(mod) });
      } catch (error) {
        errors.push(`Failed to generate interface for ${mod.name}: ${error instanceof Error ? error.message : error}`);
      }
    }
    return { files, errors };
  }

  generateAdapter(context: GeneratorContext): GeneratorResult {
    this.context = context;
    const files: GeneratedFile[] = [];
    const errors: string[] = [];
    const adapters = context.adapters.filter((a) => {
      if (context.module && a.module !== context.module) return false;
      if (context.provider && a.name !== context.provider) return false;
      if (!adapterSupportsLanguage(a, this.language)) return false;
      return true;
    });

    for (const adapter of adapters) {
      try {
        const mod = context.catalog.modules.find((m) => m.name === adapter.module);
        if (!mod) { errors.push(`Module ${adapter.module} not found for adapter ${adapter.name}`); continue; }
        files.push({ path: `adapters/${pascalCase(adapter.name)}Adapter.java`, content: this.generateAdapterClass(adapter, mod) });
      } catch (error) {
        errors.push(`Failed to generate adapter ${adapter.name}: ${error instanceof Error ? error.message : error}`);
      }
    }
    return { files, errors };
  }

  generateTests(context: GeneratorContext): GeneratorResult {
    const files: GeneratedFile[] = [];
    const errors: string[] = [];
    const adapters = context.adapters.filter((a) => {
      if (context.module && a.module !== context.module) return false;
      if (context.provider && a.name !== context.provider) return false;
      if (!adapterSupportsLanguage(a, this.language)) return false;
      return true;
    });

    for (const adapter of adapters) {
      try {
        const mod = context.catalog.modules.find((m) => m.name === adapter.module);
        if (!mod) { errors.push(`Module ${adapter.module} not found for adapter ${adapter.name}`); continue; }
        files.push({ path: `__tests__/${adapter.name}AdapterTest.java`, content: this.generateConformanceTest(adapter, mod) });
      } catch (error) {
        errors.push(`Failed to generate test for ${adapter.name}: ${error instanceof Error ? error.message : error}`);
      }
    }
    return { files, errors };
  }

  private resolveModules(context: GeneratorContext): ModuleContract[] {
    let modules = context.module
      ? context.catalog.modules.filter((m) => m.name === context.module)
      : context.catalog.modules;

    if (context.module) {
      const targetMod = context.catalog.modules.find((m) => m.name === context.module);
      if (targetMod) {
        for (const dep of targetMod.hardDeps) {
          const depMod = context.catalog.modules.find((m) => m.name === dep);
          if (depMod && !modules.some((m) => m.name === dep)) modules = [...modules, depMod];
        }
      }
    }
    return modules;
  }

  private generateModuleInterface(mod: ModuleContract): string {
    const versionNote = mod.version ? `v${mod.version}` : "version not specified";
    const ns = this.context?.namespace ? `${pascalCase(this.context.namespace)}_` : "";
    const interfaceName = `${ns}${pascalCase(mod.name)}Contract`;
    const lines: string[] = [
      `// ${interfaceName}.java — ${versionNote} — contracts/${mod.name}.md`,
      `// Auto-generated from contracts/${mod.name}.md -- namespace: "${this.context?.namespace ?? "none"}"`,
      "",
      "import java.util.Optional;",
      "import java.util.concurrent.CompletableFuture;",
      "",
      `public interface ${interfaceName} {`,
    ];
    for (const fn of mod.functions) {
      const ret = mapType(fn.returns, "java");
      lines.push(`    CompletableFuture<${ret}> ${camelCase(fn.name)}(${generateParamsList(fn)});`);
    }
    lines.push("}");
    return lines.join("\n");
  }

  private generateAdapterClass(adapter: AdapterDefinition, mod: ModuleContract): string {
    const ns = this.context?.namespace ? `${pascalCase(this.context.namespace)}_` : "";
    const interfaceName = `${ns}${pascalCase(mod.name)}Contract`;
    const adapterPascal = pascalCase(adapter.name);
    const className = `${ns}${adapterPascal}Adapter`;
    const lines: string[] = [
      `// ${className}.java`,
      `// Auto-generated adapter for ${adapter.name} → ${mod.name} -- namespace: "${this.context?.namespace ?? "none"}"`,
      "",
      "import java.util.Optional;",
      "import java.util.concurrent.CompletableFuture;",
      "",
      `public class ${className} implements ${interfaceName} {`,
    ];

    for (const f of adapter.config.required) {
      lines.push(`    private final ${mapType(f.type, "java")} ${camelCase(f.name)};`);
    }
    lines.push("");

    const configArgs = adapter.config.required.map((f) => `${mapType(f.type, "java")} ${camelCase(f.name)}`).join(", ");
    lines.push(`    public ${className}(${configArgs}) {`);
    for (const f of adapter.config.required) {
      lines.push(`        this.${camelCase(f.name)} = ${camelCase(f.name)};`);
    }
    lines.push("    }");
    lines.push("");

    for (const fn of mod.functions) {
      if (adapter.implements.includes(fn.name)) {
        lines.push(this.generateAdapterMethod(fn));
      } else {
        const msg = adapter.does_not_implement?.includes(fn.name)
          ? `Not supported by ${adapter.name}: ${fn.name}`
          : `Not yet implemented: ${fn.name}`;
        lines.push(this.generateUnimplementedMethod(fn, msg));
      }
    }
    lines.push("}");
    return lines.join("\n");
  }

  private generateAdapterMethod(fn: ContractFunction): string {
    const ret = mapType(fn.returns, "java");
    const params = generateParamsList(fn);
    return `    @Override\n    public CompletableFuture<${ret}> ${camelCase(fn.name)}(${params}) {\n        // TODO: Implement ${fn.name}\n        return CompletableFuture.failedFuture(new UnsupportedOperationException("${fn.name}"));\n    }\n`;
  }

  private generateUnimplementedMethod(fn: ContractFunction, message: string): string {
    const ret = mapType(fn.returns, "java");
    const params = generateParamsList(fn);
    return `    @Override\n    public CompletableFuture<${ret}> ${camelCase(fn.name)}(${params}) {\n        return CompletableFuture.failedFuture(new UnsupportedOperationException("${message}"));\n    }\n`;
  }

  private generateConformanceTest(adapter: AdapterDefinition, mod: ModuleContract): string {
    const interfaceName = `${pascalCase(mod.name)}Contract`;
    const adapterPascal = pascalCase(adapter.name);
    const className = `${adapterPascal}Adapter`;
    const lines: string[] = [
      `// ${className}Test.java`,
      `// Auto-generated conformance test for ${adapter.name} → ${mod.name}`,
      "",
      "import org.junit.jupiter.api.Test;",
      "import static org.junit.jupiter.api.Assertions.*;",
      "",
      `public class ${className}Test {`,
    ];

    const testConfigArgs = adapter.config.required.map((f) => `"test"`).join(", ");
    lines.push(`    @Test`);
    lines.push(`    void testImplementsContract() {`);
    lines.push(`        ${interfaceName} adapter = new ${className}(${testConfigArgs});`);
    lines.push(`        assertNotNull(adapter);`);
    lines.push("    }");
    lines.push("}");
    return lines.join("\n");
  }
}
