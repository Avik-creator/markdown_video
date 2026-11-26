import { describe, expect, it } from "vitest";
import { getDirectiveValueOptions } from "@markdown-video/core";
import { EXAMPLE_TEMPLATES, SNIPPET_SCHEMA_BINDINGS } from "../snippets";

/**
 * The snippet/schema invariant lives here rather than at module scope: a
 * throw during module evaluation would crash the whole app chunk in
 * production, while a failing test blocks the drift at commit time.
 */
describe("snippet schema bindings", () => {
  it("uses only schema-valid directive property values in the quick-insert snippets", () => {
    expect(SNIPPET_SCHEMA_BINDINGS.length).toBeGreaterThan(0);

    for (const { directive, property, value } of SNIPPET_SCHEMA_BINDINGS) {
      const options = getDirectiveValueOptions(directive, property);
      expect(
        options,
        `"${value}" must be a schema-valid ${directive}.${property} value`
      ).toContain(value);
    }
  });

  it("registers a binding for every schema value the templates interpolate", () => {
    // Every recorded binding is used in at least one template, so the
    // registration list cannot drift apart from the templates themselves.
    const templates = Object.values(EXAMPLE_TEMPLATES);
    for (const { value } of SNIPPET_SCHEMA_BINDINGS) {
      expect(
        templates.some((template) => template.includes(value)),
        `binding value "${value}" should appear in a template`
      ).toBe(true);
    }
  });
});
