// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useVideoStore } from "@/lib/use-video-store";
import { TextScene } from "../TextScene";
import { SceneRenderer } from "../SceneRenderer";

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

const originalMarkdown = useVideoStore.getState().markdown;

function resetLocalizedStore() {
  useVideoStore.getState().setActiveLocale(null);
  useVideoStore.getState().setMarkdown(localizedMarkdown, false);
  useVideoStore.getState().seekTo(0);
}

describe("localized scene rendering", () => {
  beforeEach(resetLocalizedStore);

  afterEach(() => {
    cleanup();
    useVideoStore.getState().setActiveLocale(null);
    useVideoStore.getState().setMarkdown(originalMarkdown, false);
  });

  it("renders the document default locale when no active locale is selected", () => {
    const scene = useVideoStore.getState().scenes[0];
    render(<TextScene scene={scene} sceneTime={0} />);

    expect(screen.getByText("Welcome")).toBeTruthy();
  });

  it("re-renders text in the active locale when the selection changes", () => {
    const scene = useVideoStore.getState().scenes[0];
    render(<TextScene scene={scene} sceneTime={0} />);

    act(() => useVideoStore.getState().setActiveLocale("es"));

    expect(screen.getByText("Bienvenido")).toBeTruthy();
    expect(screen.queryByText("Welcome")).toBeNull();
  });

  it("uses the scene locale override before the active locale", () => {
    useVideoStore.getState().setActiveLocale("es");
    const overriddenScene = useVideoStore.getState().scenes[1];
    render(<TextScene scene={overriddenScene} sceneTime={0} />);

    expect(screen.getByText("Bienvenue")).toBeTruthy();
  });

  it("ignores a stale active locale that is not declared by the document", () => {
    useVideoStore.getState().setActiveLocale("de");
    const scene = useVideoStore.getState().scenes[0];
    render(<TextScene scene={scene} sceneTime={0} />);

    expect(screen.getByText("Welcome")).toBeTruthy();
  });

  it("applies a scene locale inside mockup text content", () => {
    const mockupScene = useVideoStore.getState().scenes[2];
    render(<SceneRenderer scene={mockupScene} sceneTime={0} />);

    expect(screen.getByText("Maqueta española")).toBeTruthy();
  });

  it("end-to-end: parsed document state drives store/render resolution", () => {
    expect(useVideoStore.getState().locales).toEqual(["en", "es", "fr"]);
    expect(useVideoStore.getState().defaultLocale).toBe("en");
    expect(useVideoStore.getState().localizationStrings.welcome.es).toBe("Bienvenido");

    useVideoStore.getState().setActiveLocale("fr");
    const scene = useVideoStore.getState().scenes[0];
    render(<TextScene scene={scene} sceneTime={0} />);

    expect(screen.getByText("Bienvenue")).toBeTruthy();
  });
});
