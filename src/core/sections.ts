export type SectionName =
  | "functions"
  | "types"
  | "invariants"
  | "providers"
  | "system-integrations";

export type SectionDefinition = {
  name: SectionName;
  header: string;
  aliases: string[];
  requiredForModule: boolean;
};

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    name: "functions",
    header: "Functions",
    aliases: ["**Functions**"],
    requiredForModule: true,
  },
  {
    name: "types",
    header: "Types",
    aliases: ["**Types**"],
    requiredForModule: true,
  },
  {
    name: "invariants",
    header: "Invariants",
    aliases: ["**Invariants**"],
    requiredForModule: false,
  },
  {
    name: "providers",
    header: "Providers",
    aliases: ["**Providers:**"],
    requiredForModule: false,
  },
  {
    name: "system-integrations",
    header: "System-Level Integrations",
    aliases: ["System-Level Integrations & Constraints"],
    requiredForModule: false,
  },
];

export const SECTION_BY_HEADER = new Map<string, SectionDefinition>(
  SECTION_DEFINITIONS.flatMap((definition) => [
    [definition.header.toLowerCase(), definition],
    ...definition.aliases.map((alias) => [alias.toLowerCase(), definition] as const),
  ]),
);

export function normalizeSectionHeader(header: string): SectionName | null {
  const variants = [
    header,
    header.trim(),
    header.trim().replace(/^\*\*(.+)\*\*$/, "$1"),
    header.trim().replace(/^\*\*(.+)\*\*$/, "$1").replace(/:$/, ""),
  ];

  for (const variant of variants) {
    const definition = SECTION_BY_HEADER.get(variant.toLowerCase());
    if (definition) return definition.name;
  }

  return null;
}

export function isRequiredModuleSection(name: string): boolean {
  return SECTION_DEFINITIONS.some((definition) => definition.name === name && definition.requiredForModule);
}
