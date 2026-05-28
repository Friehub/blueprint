import type { Catalog, ModuleContract } from "../../core/catalog.js";
import type { AdapterDefinition } from "../../core/adapters/types.js";
import type { GeneratedFile, GeneratorResult } from "../types.js";
import { pascalCase, camelCase } from "../types.js";

export type PrototypeOptions = {
  name: string;
  modules: string[];
  adapters: Record<string, string>;
  outputDir: string;
};

export function generatePrototype(
  catalog: Catalog,
  adapters: AdapterDefinition[],
  options: PrototypeOptions,
): GeneratorResult {
  const files: GeneratedFile[] = [];
  const errors: string[] = [];

  try {
    files.push(generatePackageJson(options, adapters));
    files.push(generateTsConfig());
    files.push(generateGitignore());
    files.push(generateReadme(options, adapters));
    files.push(generateEnvExample(adapters));
    files.push(generateConfig(options, adapters, catalog));
    files.push(generateEntryPoint(options, adapters, catalog));
  } catch (error) {
    errors.push(`Failed to generate prototype: ${error instanceof Error ? error.message : error}`);
  }

  return { files, errors };
}

function generatePackageJson(options: PrototypeOptions, adapters: AdapterDefinition[]): GeneratedFile {
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
  };

  for (const adapterName of Object.values(options.adapters)) {
    const adapter = adapters.find((a) => a.name === adapterName);
    if (adapter) {
      const pkg = getAdapterPackage(adapterName);
      if (pkg) {
        dependencies[pkg.name] = pkg.version;
      }
    }
  }

  const packageJson = {
    name: options.name,
    version: "1.0.0",
    type: "module",
    scripts: {
      build: "tsc",
      dev: "tsx src/index.ts",
    },
    dependencies,
    devDependencies,
  };

  return {
    path: "package.json",
    content: JSON.stringify(packageJson, null, 2) + "\n",
  };
}

function generateTsConfig(): GeneratedFile {
  const tsConfig = {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      outDir: "dist",
      rootDir: "src",
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ["src/**/*.ts"],
  };

  return {
    path: "tsconfig.json",
    content: JSON.stringify(tsConfig, null, 2) + "\n",
  };
}

function generateGitignore(): GeneratedFile {
  return {
    path: ".gitignore",
    content: `node_modules/
dist/
.env
*.log
`,
  };
}

function generateReadme(options: PrototypeOptions, adapters: AdapterDefinition[]): GeneratedFile {
  const moduleList = options.modules.map((m) => `- ${m}`).join("\n");
  const adapterList = Object.entries(options.adapters)
    .map(([module, adapter]) => `- ${module}: ${adapter}`)
    .join("\n");

  return {
    path: "README.md",
    content: `# ${options.name}

Generated scaffold from Engineering Blueprinter contracts.

## Modules

${moduleList}

## Adapters

${adapterList}

## Getting Started

\`\`\`bash
npm install
npm run build
npm run dev
\`\`\`

## Project Structure

\`\`\`
src/
├── interfaces/     # TypeScript interfaces from contracts
├── adapters/       # Adapter implementations (fill in TODOs)
├── config/         # Adapter configuration
└── index.ts        # Entry point
\`\`\`

## Next Steps

1. Fill in adapter implementations in \`src/adapters/\`
2. Configure environment variables in \`.env\`
3. Implement business logic in \`src/index.ts\`
`,
  };
}

function generateEnvExample(adapters: AdapterDefinition[]): GeneratedFile {
  const lines: string[] = ["# Environment Variables", ""];

  for (const adapter of adapters) {
    lines.push(`# ${adapter.description || adapter.name}`);
    for (const field of adapter.config.required) {
      if (field.secret) {
        lines.push(`${field.name.toUpperCase()}=your_${field.name}_here`);
      }
    }
    lines.push("");
  }

  return {
    path: ".env.example",
    content: lines.join("\n"),
  };
}

function generateConfig(options: PrototypeOptions, adapters: AdapterDefinition[], catalog: Catalog): GeneratedFile {
  const lines: string[] = [
    "// Adapter configuration",
    "// Fill in your API keys in .env file",
    "",
  ];

  const imports: string[] = [];
  const adapterConfigs: string[] = [];

  for (const [module, adapterName] of Object.entries(options.adapters)) {
    const adapter = adapters.find((a) => a.name === adapterName && a.module === module);
    if (!adapter) continue;

    const className = `${pascalCase(adapterName)}Adapter`;
    const importPath = `../adapters/${module}/${adapterName}`;
    imports.push(`import { ${className} } from '${importPath}';`);

    const configFields = adapter.config.required
      .map((f) => {
        if (f.secret) {
          return `  ${f.name}: process.env.${f.name.toUpperCase()}!,`;
        }
        return `  ${f.name}: process.env.${f.name.toUpperCase()} || '',`;
      })
      .join("\n");

    adapterConfigs.push(`export const ${module}Adapter = new ${className}({`);
    adapterConfigs.push(configFields);
    adapterConfigs.push(`});`);
    adapterConfigs.push("");
  }

  lines.push(...imports);
  lines.push("");
  lines.push(...adapterConfigs);

  return {
    path: "src/config/adapters.ts",
    content: lines.join("\n"),
  };
}

function generateEntryPoint(options: PrototypeOptions, adapters: AdapterDefinition[], catalog: Catalog): GeneratedFile {
  const lines: string[] = [
    "// Application entry point",
    "// Implement your business logic here",
    "",
  ];

  for (const [module, adapterName] of Object.entries(options.adapters)) {
    const mod = catalog.modules.find((m) => m.name === module);
    if (!mod) continue;

    lines.push(`// ${module} functions:`);
    for (const fn of mod.functions.slice(0, 3)) {
      lines.push(`//   ${camelCase(fn.name)}(${fn.params.map((p) => p.name).join(', ')})`);
    }
    lines.push("");
  }

  lines.push("async function main() {");
  lines.push("  // TODO: Initialize adapters");
  lines.push("  // TODO: Implement business logic");
  lines.push("}");
  lines.push("");
  lines.push("main().catch(console.error);");
  lines.push("");

  return {
    path: "src/index.ts",
    content: lines.join("\n"),
  };
}

function getAdapterPackage(adapterName: string): { name: string; version: string } | null {
  const packageMap: Record<string, { name: string; version: string }> = {
    stripe: { name: "stripe", version: "^14.0.0" },
    paystack: { name: "paystack", version: "^3.0.0" },
    adyen: { name: "@adyen/api-library", version: "^15.0.0" },
    redis: { name: "redis", version: "^4.0.0" },
    memcached: { name: "memjs", version: "^1.3.0" },
    resend: { name: "resend", version: "^3.0.0" },
    sendgrid: { name: "@sendgrid/mail", version: "^8.0.0" },
    twilio: { name: "twilio", version: "^5.0.0" },
    bullmq: { name: "bullmq", version: "^5.0.0" },
    sqs: { name: "@aws-sdk/client-sqs", version: "^3.0.0" },
    algolia: { name: "algoliasearch", version: "^5.0.0" },
    sentry: { name: "@sentry/node", version: "^8.0.0" },
    clerk: { name: "@clerk/clerk-sdk-node", version: "^2.0.0" },
    auth0: { name: "auth0", version: "^4.0.0" },
    launchdarkly: { name: "launchdarkly-node-server-sdk", version: "^8.0.0" },
    flagsmith: { name: "flagsmith-nodejs", version: "^3.0.0" },
    unleash: { name: "@unleash/nextjs", version: "^5.0.0" },
    mixpanel: { name: "mixpanel", version: "^0.18.0" },
    segment: { name: "@segment/analytics-node", version: "^2.0.0" },
    amplitude: { name: "@amplitude/analytics-node", version: "^2.0.0" },
    sift: { name: "sift", version: "^16.0.0" },
    bugsnag: { name: "@bugsnag/node", version: "^8.0.0" },
    pagerduty: { name: "pagerduty", version: "^3.0.0" },
    cloudinary: { name: "cloudinary", version: "^2.0.0" },
    zendesk: { name: "node-zendesk", version: "^3.0.0" },
    hubspot: { name: "@hubspot/api-client", version: "^10.0.0" },
    linear: { name: "@linear/sdk", version: "^12.0.0" },
    jira: { name: "jira.js", version: "^4.0.0" },
    shipengine: { name: "@shipengine/sdk", version: "^2.0.0" },
    taxjar: { name: "taxjar", version: "^3.0.0" },
    datadog: { name: "datadog-api-client", version: "^2.0.0" },
    jaeger: { name: "@opentelemetry/sdk-node", version: "^1.0.0" },
    plaid: { name: "plaid", version: "^30.0.0" },
    svix: { name: "svix", version: "^1.0.0" },
  };

  return packageMap[adapterName] || null;
}
