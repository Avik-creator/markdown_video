// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useVideoStore } from "@/lib/use-video-store";
import { LocalePicker } from "../LocalePicker";

const originalMarkdown = useVideoStore.getState().markdown;

const localizedMarkdown = `!locales en es fr
!scene
!text
Hi
`;

function reset(markdown: string) {
  useVideoStore.getState().setActiveLocale(null);
  useVideoStore.getState().setMarkdown(markdown, false);
}

describe("LocalePicker", () => {
  afterEach(() => {
    cleanup();
    reset(originalMarkdown);
  });

  it("is hidden for monolingual documents", () => {
    reset("!scene\n!text\nHello\n");
    const { container } = render(<LocalePicker />);

    expect(container.firstChild).toBeNull();
  });

  it("lists document locales and selects the document default initially", () => {
    reset(localizedMarkdown);
    render(<LocalePicker />);

    const select = screen.getByLabelText("Locale") as HTMLSelectElement;
    expect(select.value).toBe("en");
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      "en",
      "es",
      "fr",
    ]);
  });

  it("updates the runtime active locale when changed", () => {
    reset(localizedMarkdown);
    render(<LocalePicker />);

    fireEvent.change(screen.getByLabelText("Locale"), { target: { value: "es" } });

    expect(useVideoStore.getState().activeLocale).toBe("es");
  });

  it("falls back to the document default when activeLocale is undeclared", () => {
    reset(localizedMarkdown);
    useVideoStore.getState().setActiveLocale("de");
    render(<LocalePicker />);

    expect((screen.getByLabelText("Locale") as HTMLSelectElement).value).toBe("en");
  });
});
