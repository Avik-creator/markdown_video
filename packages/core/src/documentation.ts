// Documentation and guide utilities for markdown_video MCP.
// All directive facts come from lib/directive-schema.ts; this file adapts the
// schema into the human-readable documentation shape consumed by MCP tools.

import {
  ANIMATION_VALUES,
  assertNever,
  DIRECTIVE_SCHEMAS,
  TRANSITION_VALUES,
  type DirectiveSchema,
  type DirectiveValueSchema,
} from "./directive-schema";

export interface DirectiveDoc {
  name: string;
  aliases: string[];
  description: string;
  syntax: string;
  examples: string[];
  properties?: PropertyDoc[];
  category: "scene" | "content" | "effect" | "layout" | "meta";
}

export interface PropertyDoc {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description: string;
  values?: string[];
  aliases?: string[];
  context?: "positional" | "property" | "keyframe";
}

function documentationType(type: DirectiveValueSchema["type"]): string {
  switch (type) {
    case "enum":
    case "color":
    case "url":
      return "string";
    case "string":
    case "number":
    case "boolean":
    case "array":
    case "object":
      return type;
    default:
      return assertNever(type);
  }
}

function toPropertyDoc(
  value: DirectiveValueSchema,
  context: NonNullable<PropertyDoc["context"]>
): PropertyDoc {
  return {
    name: value.name,
    type: documentationType(value.type),
    required: value.required,
    default: value.default === undefined ? undefined : String(value.default),
    description: value.description,
    values: value.values ? [...value.values] : undefined,
    aliases: value.aliases ? [...value.aliases] : undefined,
    context,
  };
}

function propertiesFor(schema: DirectiveSchema): PropertyDoc[] | undefined {
  const properties: PropertyDoc[] = [
    ...(schema.positional ?? []).map((value) => toPropertyDoc(value, "positional")),
    ...(schema.properties ?? []).map((value) => toPropertyDoc(value, "property")),
    ...(schema.keyframeProperties ?? []).map((value) => toPropertyDoc(value, "keyframe")),
  ];

  // Some directives (notably camera) accept the same key inline and as part of
  // their positional shorthand. Keep the first, most precise documentation entry.
  const seen = new Set<string>();
  const unique = properties.filter((property) => {
    const key = property.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.length > 0 ? unique : undefined;
}

function toDirectiveDoc(schema: DirectiveSchema): DirectiveDoc {
  return {
    name: schema.name,
    aliases: [...schema.aliases],
    description: schema.description,
    syntax: schema.syntax,
    examples: [...schema.examples],
    properties: propertiesFor(schema),
    category: schema.category,
  };
}

/**
 * Get comprehensive documentation for all directives.
 */
export function getAllDirectives(): DirectiveDoc[] {
  return DIRECTIVE_SCHEMAS.map(toDirectiveDoc);
}

/**
 * Get documentation for a specific directive. Canonical names and aliases are
 * matched case-insensitively.
 */
export function getDirectiveDoc(directiveName: string): DirectiveDoc | null {
  const lower = directiveName.toLowerCase();
  const schema = DIRECTIVE_SCHEMAS.find(
    (directive) =>
      directive.name === lower ||
      directive.aliases.some((alias) => alias.toLowerCase() === lower)
  );
  return schema ? toDirectiveDoc(schema) : null;
}

/**
 * Get quick reference guide.
 */
export function getQuickReference(): string {
  return `# Markdown Video - Quick Reference

## Basic Structure
\`\`\`markdown
!scene
!text
Your text content here

---

!scene
!code
\`\`\`javascript
console.log("Hello World");
\`\`\`
\`\`\`

## Common Directives
- \`!scene\` / \`!slide\` - Start a new scene
- \`!text\` - Add text content
- \`!code\` - Add code block
- \`!image\` - Display image
- \`!terminal\` - Terminal commands
- \`!chart\` - Data visualization
- \`!duration 3\` - Set scene duration (seconds)
- \`!transition fade\` - Set transition effect
- \`!background #1e1e2e\` - Set background color

## Animations
${ANIMATION_VALUES.join(", ")}

## Transitions
${TRANSITION_VALUES.join(", ")}

## Effects
- \`!particles type:confetti\` - Particle effects
- \`!camera zoom:1.5\` - Camera effects
- \`!presenter position:bottom-right\` - Add presenter overlay
- \`!callout "text" style:info\` - Add annotation

## Split Layouts
Child content directives are assigned to panels in order (first left/top, then
right/bottom). Explicit \`left:\` and \`right:\` labels may also direct content;
in vertical layouts these labels mean top and bottom respectively.

\`\`\`markdown
!scene
!layout split:horizontal
left:
!text
Left panel copy
right:
!image src:/screenshot.png fit:contain
\`\`\`

## Scene Separator
Use \`---\` to separate scenes

## Variables
\`\`\`markdown
!var brandColor #3b82f6
!background $brandColor
\`\`\`

## Localization
\`\`\`markdown
!locales en es fr

!strings
welcome:
  en: "Welcome"
  es: "Bienvenido"
  fr: "Bienvenue"

---

!scene
!text i18n:welcome

---

!scene
!locale es
!text i18n:welcome
\`\`\`

The first valid locale in \`!locales\` is the document default; no separate
default-locale directive exists. \`!locale\` is valid only inside a scene and
overrides the user/document locale for that scene. Translation resolution is:
effective locale → default locale → first translation defined for the key →
non-empty inline text in the same text object → the literal key (so missing translations
are visible during editing). Locale/key tokens use ASCII letters, digits and
underscores with optional single-hyphen separators (for example \`en\`,
\`pt-BR\`, \`welcome-title\`). In \`!strings\`, key lines are unindented
\`key:\` lines and translations are indented \`locale: value\` lines; quotes
are optional and multiple \`!strings\` blocks merge.

## Complete Example
\`\`\`markdown
!var mainColor #3b82f6

!scene
!chapter "Introduction"
!duration 5
!background $mainColor
!text
Welcome to Markdown Video
animation: fadeIn
size: 2xl

---

!scene
!transition slide 1s
!code
typing: true
speed: 50
\`\`\`javascript
function hello() {
  console.log("Hello World!");
}
\`\`\`

---

!scene
!image src:/screenshot.png fit:contain
!callout "Beautiful, isn't it?" arrow:down style:success
\`\`\`
`;
}

/**
 * Get examples by category.
 */
export function getExamplesByCategory(category: string): string[] {
  return getAllDirectives()
    .filter((doc) => doc.category === category)
    .flatMap((doc) => doc.examples);
}

/**
 * Search documentation.
 */
export function searchDocumentation(query: string): DirectiveDoc[] {
  const lowerQuery = query.toLowerCase();

  return getAllDirectives().filter(
    (doc) =>
      doc.name.toLowerCase().includes(lowerQuery) ||
      doc.aliases.some((alias) => alias.toLowerCase().includes(lowerQuery)) ||
      doc.description.toLowerCase().includes(lowerQuery)
  );
}
