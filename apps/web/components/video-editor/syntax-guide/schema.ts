import {
  getDirectiveSchema,
  getDirectiveValueOptions,
} from "@/lib/directive-schema";

/** Canonical directive plus aliases formatted for display in the guide. */
export function directiveOptions(name: string): readonly string[] {
  const schema = getDirectiveSchema(name);
  if (!schema) return [];
  return [schema.name, ...schema.aliases].map((directive) => `!${directive}`);
}

/** Allowed values for a schema-backed property or positional argument. */
export function schemaValues(directive: string, property: string): readonly string[] {
  return getDirectiveValueOptions(directive, property);
}
