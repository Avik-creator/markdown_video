// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { parseMarkdownFull } from "@markdown-video/core";
import { TextScene } from "../TextScene.js";
import { SceneRenderer } from "../SceneRenderer.js";
import {
  SceneLocalizationProvider,
  type SceneLocalization,
} from "../../localization.js";

/**
 * Localization rendering tests, written against the package's explicit host
 * contract: document parse output (locales/strings/defaultLocale) plus a
 * host-selected active locale arrive through SceneLocalizationProvider. The
 * editor wires the same values from its zustand store at the shell.
 */

const localizedMarkdown = `!locales en es fr
!strings
welcome:
  en: "Welcome"
  es: "Bienvenido"
  fr: "Bienvenue"
mockup-title:
  en: "English mockup"
  es: "Maqueta española"

---

!scene
!text i18n:welcome

---

!scene
!locale fr
!text i18n:welcome

---

!scene
!locale es
!mockup device:iphone i18nKey:mockup-title
`;

const parsed = parseMarkdownFull(localizedMarkdown);

function localization(
  activeLocale: string | null = null
): SceneLocalization {
  return {
    strings: parsed.localizationStrings,
    locales: parsed.locales,
    defaultLocale: parsed.defaultLocale,
    activeLocale,
  };
}

function renderWithLocalization(
  node: React.ReactElement,
  activeLocale: string | null = null
) {
  return render(
    <SceneLocalizationProvider value={localization(activeLocale)}>
      {node}
    </SceneLocalizationProvider>
  );
}

afterEach(cleanup);

describe("localized scene rendering", () => {
  it("parses the fixture document localization state", () => {
    expect(parsed.locales).toEqual(["en", "es", "fr"]);
    expect(parsed.defaultLocale).toBe("en");
    expect(parsed.localizationStrings.welcome.es).toBe("Bienvenido");
  });

  it("renders the document default locale when no active locale is selected", () => {
    renderWithLocalization(<TextScene scene={parsed.scenes[0]} sceneTime={0} />);

    expect(screen.getByText("Welcome")).toBeTruthy();
  });

  it("re-renders text in the active locale when the selection changes", () => {
    const { rerender } = renderWithLocalization(
      <TextScene scene={parsed.scenes[0]} sceneTime={0} />
    );

    rerender(
      <SceneLocalizationProvider value={localization("es")}>
        <TextScene scene={parsed.scenes[0]} sceneTime={0} />
      </SceneLocalizationProvider>
    );

    expect(screen.getByText("Bienvenido")).toBeTruthy();
    expect(screen.queryByText("Welcome")).toBeNull();
  });

  it("uses the scene locale override before the active locale", () => {
    renderWithLocalization(
      <TextScene scene={parsed.scenes[1]} sceneTime={0} />,
      "es"
    );

    expect(screen.getByText("Bienvenue")).toBeTruthy();
  });

  it("ignores a stale active locale that is not declared by the document", () => {
    renderWithLocalization(
      <TextScene scene={parsed.scenes[0]} sceneTime={0} />,
      "de"
    );

    expect(screen.getByText("Welcome")).toBeTruthy();
  });

  it("applies a scene locale inside mockup text content", () => {
    renderWithLocalization(
      <SceneRenderer scene={parsed.scenes[2]} sceneTime={0} />
    );

    expect(screen.getByText("Maqueta española")).toBeTruthy();
  });

  it("end-to-end: parsed document state drives provider/render resolution", () => {
    renderWithLocalization(
      <TextScene scene={parsed.scenes[0]} sceneTime={0} />,
      "fr"
    );

    expect(screen.getByText("Bienvenue")).toBeTruthy();
  });

  it("falls back to inline content without a provider", () => {
    // No provider: the monolingual default context applies, so resolution
    // degrades to the key itself when no strings exist, matching the
    // documented missing-translation behavior.
    render(<TextScene scene={parsed.scenes[0]} sceneTime={0} />);

    expect(screen.getByText("welcome")).toBeTruthy();
  });
});
