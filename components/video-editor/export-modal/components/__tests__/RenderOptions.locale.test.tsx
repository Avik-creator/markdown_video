// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useVideoStore } from "@/lib/use-video-store";
import RenderOptions from "../RenderOptions";

const originalMarkdown = useVideoStore.getState().markdown;
const localizedMarkdown = `!locales en es fr
!scene
!text
Hi
`;

function reset(markdown: string) {
  useVideoStore.getState().setActiveLocale(null);
  useVideoStore.getState().setExportSettings({ locale: undefined });
  useVideoStore.getState().setMarkdown(markdown, false);
}

describe("RenderOptions locale selection", () => {
  afterEach(() => {
    cleanup();
    reset(originalMarkdown);
  });

  it("is hidden for monolingual documents", () => {
    reset("!scene\n!text\nHello\n");
    render(<RenderOptions />);

    expect(screen.queryByText("Export Locale")).toBeNull();
  });

  it("selects both runtime preview locale and export settings locale", () => {
    reset(localizedMarkdown);
    const { container } = render(<RenderOptions />);

    const label = screen.getByText("Export Locale");
    const dropdown = label.closest(".relative") as HTMLElement;
    fireEvent.click(within(dropdown).getAllByRole("button")[0]);
    fireEvent.click(within(dropdown).getByText("es"));

    expect(useVideoStore.getState().activeLocale).toBe("es");
    expect(useVideoStore.getState().exportSettings.locale).toBe("es");
    expect(container.textContent).toContain("es");
  });
});
