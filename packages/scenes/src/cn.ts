/**
 * Tiny class-name joiner for scene components.
 *
 * This deliberately does NOT depend on the editor's `@/lib/utils` (which is
 * app-local) or on tailwind-merge: scene class lists are authored without
 * conflicting utilities, so output must simply concatenate truthy class
 * strings in a stable order. Keeping the joiner order-preserving (rather than
 * deduplicating) is what makes identical inputs produce byte-identical
 * className attributes — part of the deterministic-markup contract that lets
 * preview, export and headless rendering compare equal.
 */
export type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | ClassValue[]
  | { [key: string]: unknown };

function appendClassValue(value: ClassValue, output: string[]): void {
  if (!value) return;

  if (typeof value === "string" || typeof value === "number") {
    output.push(String(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendClassValue(item, output);
    }
    return;
  }

  if (typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (value[key]) {
        output.push(key);
      }
    }
  }
}

export function cn(...inputs: ClassValue[]): string {
  const output: string[] = [];
  for (const input of inputs) {
    appendClassValue(input, output);
  }
  return output.join(" ");
}
