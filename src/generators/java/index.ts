import type { ModuleContract, ContractFunction, AlgorithmInfo } from "../../core/catalog.js";
import type { AdapterDefinition } from "../../core/adapters/types.js";
import { adapterSupportsLanguage } from "../../core/adapters/types.js";
import type { Language, GeneratorContext, GeneratorResult, GeneratedFile, LanguageGenerator } from "../types.js";
import { resolveAlias, resolveModuleAlias, resolveClassAlias, resolveConfigAlias, obfuscateName } from "../aliases.js";
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

  private nsPath(base: string): string {
    return this.context?.namespace ? `${pascalCase(this.context.namespace)}/${base}` : base;
  }

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
    const defaultName = `${pascalCase(provider)}Adapter`;
    return resolveClassAlias(defaultName, this.context?.aliases);
  }

  private resolveCfgName(name: string): string {
    if (this.context?.obfuscate) return obfuscateName(this.context.obfuscate, name);
    return resolveConfigAlias(name, this.context?.aliases);
  }

  generateInterfaces(context: GeneratorContext): GeneratorResult {
    this.context = context;
    const files: GeneratedFile[] = [];
    const errors: string[] = [];
    let modules = this.resolveModules(context);

    for (const mod of modules) {
      try {
        files.push({ path: this.nsPath(`interfaces/${pascalCase(this.resolveModName(mod.name))}Contract.java`), content: this.generateModuleInterface(mod) });
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
        files.push({ path: this.nsPath(`adapters/${pascalCase(adapter.name)}Adapter.java`), content: this.generateAdapterClass(adapter, mod) });
        files.push({ path: this.nsPath(`autoconfigure/${pascalCase(this.resolveModName(mod.name))}AutoConfiguration.java`), content: this.generateAutoConfiguration(adapter, mod) });
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
        files.push({ path: this.nsPath(`__tests__/${adapter.name}AdapterTest.java`), content: this.generateConformanceTest(adapter, mod) });
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
    const ns = this.context?.namespace ? `${pascalCase(this.context.namespace)}_` : "";
    const interfaceName = `${ns}${pascalCase(this.resolveModName(mod.name))}Contract`;
    const lines: string[] = [
      `// ${interfaceName}.java`,
      `// Do not edit directly. Generated code.`,
      "",
    ];

    if (mod.algorithm) {
      lines.push(...this.generateAlgorithmComments(mod.algorithm));
      lines.push("");
    }

    lines.push("import java.util.Optional;");
    lines.push("import java.util.concurrent.CompletableFuture;");
    lines.push("");

    for (const type of mod.types) {
      const defn = generateTypeDefinition(type, this.context?.javaRecords);
      lines.push(defn);
      lines.push("");
    }

    lines.push(`public interface ${interfaceName} {`);

    for (const fn of mod.functions) {
      const aliasedFn = { ...fn, name: this.resolveFnName(fn.name) };
      const ret = mapType(aliasedFn.returns, "java");
      lines.push(`    CompletableFuture<${ret}> ${camelCase(aliasedFn.name)}(${generateParamsList(aliasedFn)});`);
    }
    lines.push("}");
    return lines.join("\n");
  }

  private generateAlgorithmComments(algorithm: AlgorithmInfo): string[] {
    const lines: string[] = [
      "// Algorithm Recommendations",
      "// ─────────────────────────",
    ];

    if (algorithm.recommended) {
      lines.push(`// Recommended: ${algorithm.recommended}`);
    }

    if (algorithm.details) {
      lines.push(`// Details: ${algorithm.details}`);
    }

    if (algorithm.atomicity) {
      lines.push(`// Atomicity: ${algorithm.atomicity}`);
    }

    return lines;
  }

  private generateAdapterClass(adapter: AdapterDefinition, mod: ModuleContract): string {
    const ns = this.context?.namespace ? `${pascalCase(this.context.namespace)}_` : "";
    const interfaceName = `${ns}${pascalCase(this.resolveModName(mod.name))}Contract`;
    const adapterPascal = pascalCase(adapter.name);
    const className = `${ns}${this.resolveClsName(adapter.name, adapter.name)}`;
    const implementedFns = mod.functions.filter((fn) => adapter.implements.includes(fn.name));
    const baseImports = [
      `// ${className}.java`,
      `// Do not edit directly. Generated code.`,
      "",
      "import io.micrometer.core.instrument.Counter;",
      "import io.micrometer.core.instrument.MeterRegistry;",
      "import io.micrometer.core.instrument.Timer;",
      "import java.util.Optional;",
      "import java.util.concurrent.CompletableFuture;",
    ];
    if (this.context?.useVirtualThreads) {
      baseImports.push("import java.util.concurrent.Executors;");
    }
    baseImports.push("");
    const lines: string[] = [
      ...baseImports,
      `public class ${className} implements ${interfaceName} {`,
    ];

    for (const f of adapter.config.required) {
      lines.push(`    private final ${mapType(f.type, "java")} ${camelCase(this.resolveCfgName(f.name))};`);
    }
    lines.push("    private final MeterRegistry registry;");

    for (const fn of implementedFns) {
      const aliasedFn = { ...fn, name: this.resolveFnName(fn.name) };
      const counterName = `${mod.name}.${aliasedFn.name}.total`;
      const timerName = `${mod.name}.${aliasedFn.name}.duration`;
      lines.push(`    private final Counter ${camelCase(aliasedFn.name)}Counter;`);
      lines.push(`    private final Timer ${camelCase(aliasedFn.name)}Timer;`);
    }
    lines.push("");

    const configArgs = adapter.config.required.map((f) => `${mapType(f.type, "java")} ${camelCase(this.resolveCfgName(f.name))}`).join(", ");
    const allArgs = configArgs ? `${configArgs}, MeterRegistry registry` : "MeterRegistry registry";
    const assignConfig = adapter.config.required.map((f) => `        this.${camelCase(this.resolveCfgName(f.name))} = ${camelCase(this.resolveCfgName(f.name))};`).join("\n");
    lines.push(`    public ${className}(${allArgs}) {`);
    if (assignConfig) {
      lines.push(assignConfig);
    }
    lines.push("        this.registry = registry;");
    for (const fn of implementedFns) {
      const aliasedFn = { ...fn, name: this.resolveFnName(fn.name) };
      const counterName = `${mod.name}.${aliasedFn.name}.total`;
      const timerName = `${mod.name}.${aliasedFn.name}.duration`;
      lines.push(`        this.${camelCase(aliasedFn.name)}Counter = Counter.builder("${counterName}")`);
      lines.push(`            .tag("provider", "${adapter.name}")`);
      lines.push(`            .register(registry);`);
      lines.push(`        this.${camelCase(aliasedFn.name)}Timer = Timer.builder("${timerName}")`);
      lines.push(`            .tag("provider", "${adapter.name}")`);
      lines.push(`            .register(registry);`);
    }
    lines.push("    }");
    lines.push("");

    for (const fn of mod.functions) {
      const aliasedFn = { ...fn, name: this.resolveFnName(fn.name) };
      if (adapter.implements.includes(fn.name)) {
        lines.push(this.generateAdapterMethod(aliasedFn));
      } else {
        const msg = adapter.does_not_implement?.includes(fn.name)
          ? `Not supported by ${adapter.name}: ${fn.name}`
          : `Not yet implemented: ${fn.name}`;
        lines.push(this.generateUnimplementedMethod(aliasedFn, msg));
      }
    }
    lines.push("}");
    return lines.join("\n");
  }

  private generateAdapterMethod(fn: ContractFunction): string {
    const ret = mapType(fn.returns, "java");
    const params = generateParamsList(fn);
    const counterName = camelCase(fn.name);

    if (this.context?.useVirtualThreads) {
      return `    @Override\n    public CompletableFuture<${ret}> ${camelCase(fn.name)}(${params}) {\n        var timerSample = Timer.start(this.registry);\n        return CompletableFuture.supplyAsync(() -> {\n            try {\n                // TODO: Implement ${fn.name}\n                this.${counterName}Counter.increment();\n                ${ret} result = null;\n                timerSample.stop(this.${counterName}Timer);\n                return result;\n            } catch (Exception e) {\n                timerSample.stop(this.${counterName}Timer);\n                throw new RuntimeException(e);\n            }\n        }, Executors.newVirtualThreadPerTaskExecutor());\n    }\n`;
    }
    return `    @Override\n    public CompletableFuture<${ret}> ${camelCase(fn.name)}(${params}) {\n        var timerSample = Timer.start(this.registry);\n        try {\n            // TODO: Implement ${fn.name}\n            this.${counterName}Counter.increment();\n            ${ret} result = null;\n            timerSample.stop(this.${counterName}Timer);\n            return CompletableFuture.completedFuture(result);\n        } catch (Exception e) {\n            timerSample.stop(this.${counterName}Timer);\n            return CompletableFuture.failedFuture(e);\n        }\n    }\n`;
  }

  private generateUnimplementedMethod(fn: ContractFunction, message: string): string {
    const ret = mapType(fn.returns, "java");
    const params = generateParamsList(fn);
    return `    @Override\n    public CompletableFuture<${ret}> ${camelCase(fn.name)}(${params}) {\n        return CompletableFuture.failedFuture(new UnsupportedOperationException("${message}"));\n    }\n`;
  }

  private generateAutoConfiguration(adapter: AdapterDefinition, mod: ModuleContract): string {
    const ns = this.context?.namespace ? `${pascalCase(this.context.namespace)}_` : "";
    const interfaceName = `${ns}${pascalCase(this.resolveModName(mod.name))}Contract`;
    const className = `${ns}${this.resolveClsName(adapter.name, adapter.name)}`;
    const cfgName = `${pascalCase(this.resolveModName(mod.name))}Properties`;
    const autoConfigName = `${pascalCase(this.resolveModName(mod.name))}AutoConfiguration`;

    const lines: string[] = [
      `// ${autoConfigName}.java`,
      `// Do not edit directly. Generated code.`,
      "",
      "import org.springframework.boot.autoconfigure.AutoConfiguration;",
      "import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;",
      "import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;",
      "import org.springframework.boot.context.properties.EnableConfigurationProperties;",
      "import org.springframework.context.annotation.Bean;",
      `import io.micrometer.core.instrument.MeterRegistry;`,
      "",
      `@AutoConfiguration`,
      `@ConditionalOnClass(${interfaceName}.class)`,
      `@EnableConfigurationProperties(${cfgName}.class)`,
      `public class ${autoConfigName} {`,
      "",
      `    @Bean`,
      `    @ConditionalOnMissingBean`,
      `    public ${interfaceName} ${camelCase(this.resolveModName(mod.name))}Contract(${cfgName} props, MeterRegistry registry) {`,
      `        return new ${className}(`,
    ];

    const configArgs = adapter.config.required.map((f) =>
      `            props.get${pascalCase(this.resolveCfgName(f.name))}()`
    ).join(",\n");
    lines.push(configArgs);
    lines.push(`            , registry`);
    lines.push(`        );`);
    lines.push(`    }`);
    lines.push(`}`);
    return lines.join("\n");
  }

  private generateConformanceTest(adapter: AdapterDefinition, mod: ModuleContract): string {
    const interfaceName = `${pascalCase(this.resolveModName(mod.name))}Contract`;
    const adapterPascal = pascalCase(adapter.name);
    const className = this.resolveClsName(adapter.name, adapter.name);
    const lines: string[] = [
      `// ${className}Test.java`,
      `// Do not edit directly. Generated code.`,
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
