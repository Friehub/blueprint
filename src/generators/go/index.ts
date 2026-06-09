import type { ModuleContract, ContractFunction } from "../../core/catalog.js";
import type { AdapterDefinition } from "../../core/adapters/types.js";
import { adapterSupportsLanguage } from "../../core/adapters/types.js";
import type { Language, GeneratorContext, GeneratorResult, GeneratedFile, LanguageGenerator } from "../types.js";
import { pascalCase, camelCase, mapType } from "../types.js";
import {
  generateTypeDefinition,
  generateFunctionSignature,
  generateParamsList,
  generateErrorSentinel,
  generateSharedTypes,
} from "./helpers.js";

export class GoGenerator implements LanguageGenerator {
  language: Language = "go";
  name = "Go Generator";
  protected context: GeneratorContext | null = null;

  generateInterfaces(context: GeneratorContext): GeneratorResult {
    this.context = context;
    const files: GeneratedFile[] = [];
    const errors: string[] = [];
    let modules = this.resolveModules(context);

    files.push({ path: "interfaces/shared.go", content: generateSharedTypes() });

    for (const mod of modules) {
      try {
        files.push({ path: `interfaces/${mod.name}.go`, content: this.generateModuleInterface(mod) });
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
        files.push({ path: `adapters/${adapter.module}/${adapter.name}.go`, content: this.generateAdapterClass(adapter, mod) });
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
        files.push({ path: `__tests__/${adapter.module}/${adapter.name}_test.go`, content: this.generateConformanceTest(adapter, mod) });
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
    const lines: string[] = [
      `// ${mod.name}.go — ${versionNote} — contracts/${mod.name}.md`,
      `// Auto-generated from contracts/${mod.name}.md -- namespace: "${this.context?.namespace ?? "none"}"`,
      `// Types are inferred from naming conventions. Review before production use.`,
      "",
      "package blueprint",
      "",
      `import ("errors"; "time")`,
      "",
    ];
    for (const type of mod.types) {
      const defn = generateTypeDefinition(type);
      lines.push(defn);
      lines.push("");
    }
    const interfaceName = `${ns}${pascalCase(mod.name)}Service`;
    lines.push(`// ${interfaceName} defines the Blueprint ${mod.name} contract ${versionNote}.`);
    lines.push(`type ${interfaceName} interface {`);
    for (const fn of mod.functions) lines.push(generateFunctionSignature(fn));
    lines.push("}");
    lines.push("");
    lines.push(generateErrorSentinel(mod.name));
    return lines.join("\n");
  }

  private generateAdapterClass(adapter: AdapterDefinition, mod: ModuleContract): string {
    const ns = this.context?.namespace ? `${pascalCase(this.context.namespace)}_` : "";
    const adapterPascal = pascalCase(adapter.name);
    const interfaceName = `${ns}${pascalCase(mod.name)}Service`;
    const lines: string[] = [
      `// ${adapter.name}.go`,
      `// Auto-generated adapter for ${adapter.name} → ${mod.name} -- namespace: "${this.context?.namespace ?? "none"}"`,
      "",
      "package blueprint",
      "",
      `import ("context"; "errors"; "fmt")`,
      "",
    ];

    const structName = `${ns}${adapterPascal}Adapter`;
    lines.push(`type ${structName} struct {`);
    for (const f of adapter.config.required) {
      lines.push(`\t${pascalCase(f.name)} ${mapType(f.type, "go")} \`json:"${camelCase(f.name)}"\``);
    }
    lines.push("}");
    lines.push("");

    const configArgs = adapter.config.required.map((f) => `${camelCase(f.name)} ${mapType(f.type, "go")}`).join(", ");
    lines.push(`func New${structName}(${configArgs}) *${structName} {`);
    lines.push(`\treturn &${structName}{`);
    for (const f of adapter.config.required) {
      lines.push(`\t\t${pascalCase(f.name)}: ${camelCase(f.name)},`);
    }
    lines.push("\t}");
    lines.push("}");
    lines.push("");

    for (const fn of mod.functions) {
      if (adapter.implements.includes(fn.name)) {
        lines.push(this.generateAdapterMethod(fn, structName));
      } else {
        const notSupportedMessage = adapter.does_not_implement?.includes(fn.name)
          ? `Not supported by ${adapter.name}: ${fn.name}`
          : `Not yet implemented: ${fn.name}`;
        lines.push(this.generateUnimplementedMethod(fn, notSupportedMessage));
      }
    }

    lines.push(`// Ensure ${structName} implements ${interfaceName}`);
    lines.push(`var _ ${interfaceName} = (*${structName})(nil)`);
    return lines.join("\n");
  }

  private generateAdapterMethod(fn: ContractFunction, structName: string): string {
    const returnType = mapType(fn.returns, "go");
    const params = generateParamsList(fn);
    const isVoid = fn.returns === "void" || fn.returns === "None";
    const funcName = pascalCase(fn.name);
    const lines: string[] = [];
    lines.push(`func (a *${structName}) ${funcName}(ctx context.Context, ${params}) ${isVoid ? "error" : `(${returnType}, error)`} {`);
    lines.push(`\t// TODO: Implement ${fn.name}`);
    if (isVoid) {
      lines.push("\treturn errors.New(\"not implemented\")");
    } else {
      lines.push(`\treturn *new(${returnType}), errors.New("not implemented: ${fn.name}")`);
    }
    lines.push("}");
    lines.push("");
    return lines.join("\n");
  }

  private generateUnimplementedMethod(fn: ContractFunction, message: string): string {
    const returnType = mapType(fn.returns, "go");
    const params = generateParamsList(fn);
    const funcName = pascalCase(fn.name);
    const isVoid = fn.returns === "void" || fn.returns === "None";
    if (isVoid) {
      return `func (a *${returnType}) ${funcName}(ctx context.Context, ${params}) error {\n\treturn errors.New("${message}")\n}\n`;
    }
    return `func (a *${returnType}) ${funcName}(ctx context.Context, ${params}) (${returnType}, error) {\n\treturn *new(${returnType}), errors.New("${message}")\n}\n`;
  }

  private generateConformanceTest(adapter: AdapterDefinition, mod: ModuleContract): string {
    const adapterPascal = pascalCase(adapter.name);
    const interfaceName = `${pascalCase(mod.name)}Service`;
    const structName = `${adapterPascal}Adapter`;
    const lines: string[] = [
      `// ${adapter.name}_test.go`,
      `// Auto-generated conformance test for ${adapter.name} → ${mod.name}`,
      "",
      "package blueprint",
      "",
      `import ("testing")`,
      "",
      `func Test${structName}_ImplementsContract(t *testing.T) {`,
      `\tvar _ ${interfaceName} = (*${structName})(nil)`,
      "}",
      "",
    ];

    const testConfigArgs = adapter.config.required.map((f) => `"test"`).join(", ");
    lines.push(`func Test${structName}_New(t *testing.T) {`);
    lines.push(`\tadapter := New${structName}(${testConfigArgs})`);
    lines.push(`\tif adapter == nil {`);
    lines.push(`\t\tt.Fatal("expected non-nil adapter")`);
    lines.push("\t}");
    lines.push("}");
    return lines.join("\n");
  }
}
