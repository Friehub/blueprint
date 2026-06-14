export interface EntityField {
  name: string;
  type: string;
  storageType: string;
  optional: boolean;
  pii: boolean;
  primaryKey: boolean;
  foreignKey: string | null;
}

export interface ForeignKey {
  field: string;
  refEntity: string;
}

export interface Entity {
  module: string;
  entity: string;
  fields: EntityField[];
  primaryKeys: string[];
  foreignKeys: ForeignKey[];
  accessPatterns: string[];
}

export type DatabaseEngine = "postgresql" | "mysql" | "mongodb" | "sqlite";

export interface DatabaseRenderer {
  engine: DatabaseEngine;
  generateDDL(entities: Entity[], moduleName?: string): string;
  generateCreateTable(entity: Entity): string;
  mapType(entityField: EntityField): string;
}
