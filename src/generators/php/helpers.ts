import type { ContractType, ModuleContract } from "../../core/catalog.js";
import type { AdapterDefinition } from "../../core/adapters/types.js";

export function phpType(type: string): string {
  const map: Record<string, string> = {
    string: "string", number: "int|float", boolean: "bool",
    Timestamp: "\\DateTimeInterface", "Record<string, unknown>": "array",
    "unknown": "mixed",
  };
  if (type.endsWith("[]")) return "array";
  if (type.endsWith("?")) return `?${phpType(type.slice(0, -1))}`;
  return map[type] || type;
}

export function phpDocType(type: string): string {
  const map: Record<string, string> = {
    string: "string", number: "int|float", boolean: "bool",
    Timestamp: "\\DateTimeInterface", "Record<string, unknown>": "array<string, mixed>",
    unknown: "mixed",
  };
  if (type.endsWith("[]")) return "array";
  if (type.endsWith("?")) return phpDocType(type.slice(0, -1));
  return map[type] || type;
}

export function interfaceName(name: string): string {
  return `${pascalCase(name)}Contract`;
}

export function className(name: string, provider: string): string {
  return `${pascalCase(provider)}${pascalCase(name)}Adapter`;
}

export function methodName(name: string): string {
  return pascalCase(name);
}

export function pascalCase(str: string): string {
  return str.split(/[_\-.\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

export function camelCase(str: string): string {
  const p = pascalCase(str);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

export function snakeCase(str: string): string {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "").replace(/[_\-.\s]+/g, "_");
}

export function generatePhpInterface(mod: ModuleContract, resolveFnName: (s: string) => string): string {
  const iface = interfaceName(mod.name);
  const ns = `Blueprint\\${pascalCase(mod.name)}`;
  const methods = (mod.functions || []).map((fn) => {
    const fnName = resolveFnName(fn.name);
    const params = (fn.params || []).map((p: any) => {
      const type = phpType(p.type || "string");
      const nullable = p.type?.endsWith("?");
      return `${nullable ? "?" : ""}${type} $${camelCase(p.name)}`;
    });
    params.push("array $options = []");
    const returnType = fn.returns ? phpDocType(fn.returns) : "void";
    return `  /**\n   * @return ${returnType}\n   */\n  public function ${camelCase(fnName)}(${params.join(", ")}): mixed;`;
  }).join("\n\n");

  return `<?php\n\ndeclare(strict_types=1);\n\nnamespace ${ns};\n\ninterface ${iface}\n{\n${methods}\n}\n`;
}

export function generatePhpAdapter(mod: ModuleContract, adapter: AdapterDefinition, resolveFnName: (s: string) => string, resolveClsName: (s: string, p: string) => string): string {
  const cls = className(mod.name, adapter.name);
  const iface = interfaceName(mod.name);
  const ns = `Blueprint\\${pascalCase(mod.name)}`;
  const providerNs = `Blueprint\\${pascalCase(mod.name)}\\Adapters`;
  const implementable = adapter.implements || [];

  const methods = (mod.functions || [])
    .filter((fn) => implementable.includes(fn.name))
    .map((fn) => {
      const fnName = resolveFnName(fn.name);
      const params = (fn.params || []).map((p: any) => {
        const type = phpType(p.type || "string");
        const nullable = p.type?.endsWith("?");
        return `${nullable ? "?" : ""}${type} $${camelCase(p.name)}`;
      });
      params.push("array $options = []");
      const returnType = fn.returns || "void";
      return `  public function ${camelCase(fnName)}(${params.join(", ")}): mixed\n  {\n    // TODO: Implement ${adapter.name} ${fn.name}\n    throw new \\RuntimeException('Not implemented');\n  }`;
    }).join("\n\n");

  const unimplemented = (mod.functions || [])
    .filter((fn) => !implementable.includes(fn.name))
    .map((fn) => `  // Does not implement: ${fn.name} (provider limitation)`);

  return `<?php\n\ndeclare(strict_types=1);\n\nnamespace ${providerNs};\n\nuse ${ns}\\${iface};\n\nclass ${cls} implements ${iface}\n{\n  public function __construct(\n    private readonly array $config,\n  ) {}\n\n${methods}\n\n${unimplemented.join("\n")}\n}\n`;
}

export function generatePhpTest(mod: ModuleContract, adapter: AdapterDefinition, resolveFnName: (s: string) => string): string {
  const cls = className(mod.name, adapter.name);
  const iface = interfaceName(mod.name);
  const testClass = `${cls}Test`;
  const providerNs = `Blueprint\\${pascalCase(mod.name)}\\Adapters`;

  const tests = (mod.functions || []).slice(0, 3).map((fn) => {
    const fnName = resolveFnName(fn.name);
    return `  public function test${pascalCase(fnName)}(): void\n  {\n    $adapter = new ${cls}([]);\n    $this->assertInstanceOf(${iface}::class, $adapter);\n  }`;
  }).join("\n\n");

  return `<?php\n\ndeclare(strict_types=1);\n\nnamespace ${providerNs}\\Tests;\n\nuse PHPUnit\\Framework\\TestCase;\nuse ${providerNs}\\${cls};\nuse Blueprint\\${pascalCase(mod.name)}\\${iface};\n\nclass ${testClass} extends TestCase\n{\n${tests}\n}\n`;
}

export function generateLaravelServiceProvider(mod: ModuleContract, adapter: AdapterDefinition): string {
  const cls = className(mod.name, adapter.name);
  const iface = interfaceName(mod.name);
  const providerName = `${pascalCase(adapter.name)}${pascalCase(mod.name)}ServiceProvider`;
  const bind = `${camelCase(mod.name)}.${adapter.name}`;

  return `<?php\n\ndeclare(strict_types=1);\n\nnamespace Blueprint\\${pascalCase(mod.name)}\\Providers;\n\nuse Illuminate\\Support\\ServiceProvider;\nuse Blueprint\\${pascalCase(mod.name)}\\${iface};\nuse Blueprint\\${pascalCase(mod.name)}\\Adapters\\${cls};\n\nclass ${providerName} extends ServiceProvider\n{\n  public function register(): void\n  {\n    $this->app->singleton(${iface}::class, function ($app) {\n      return new ${cls}(config('${bind}'));\n    });\n  }\n\n  public function boot(): void\n  {\n    $this->publishes([\n      __DIR__ . '/../../config/${bind}.php' => config_path('${bind}.php'),\n    ]);\n  }\n}\n`;
}

export function generateConfig(mod: ModuleContract, adapter: AdapterDefinition): string {
  const bind = `${camelCase(mod.name)}.${adapter.name}`;
  const configItems = (adapter.config?.required || []).map((c: any) => `  '${c.name}' => env('${snakeCase(adapter.name).toUpperCase()}_${c.name.toUpperCase()}', ''),`).join("\n");
  const optionalItems = (adapter.config?.optional || []).map((c: any) => `  '${c.name}' => env('${snakeCase(adapter.name).toUpperCase()}_${c.name.toUpperCase()}', '${c.default || ""}'),`).join("\n");

  return `<?php\n\ndeclare(strict_types=1);\n\nreturn [\n${configItems}\n${optionalItems}\n];\n`;
}



