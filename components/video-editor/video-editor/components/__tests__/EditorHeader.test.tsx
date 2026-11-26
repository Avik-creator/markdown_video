// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorHeader } from "../EditorHeader";

function renderHeader(rightPanel: "properties" | "guide" | "templates" = "guide") {
  return render(
    <EditorHeader
      undo={vi.fn()}
      redo={vi.fn()}
      canUndo={() => false}
      canRedo={() => false}
      zoom={100}
      setZoom={vi.fn()}
      aspectRatio="16:9"
      setAspectRatio={vi.fn()}
      rightPanel={rightPanel}
      togglePanel={vi.fn()}
      setShowFind={vi.fn()}
      setShowShortcuts={vi.fn()}
      setShowShareModal={vi.fn()}
      setShowExportModal={vi.fn()}
    />
  );
}

describe("EditorHeader accessibility", () => {
  afterEach(() => {
    cleanup();
  });

  it("exposes pressed state on the panel toggle buttons", () => {
    renderHeader("guide");

    expect(screen.getByRole("button", { name: "Templates" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Guide" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("marks both panel toggles unpressed when the properties panel is active", () => {
    renderHeader("properties");

    expect(screen.getByRole("button", { name: "Templates" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Guide" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("does not duplicate responsive label spans inside the text buttons", () => {
    renderHeader();

    for (const name of ["Templates", "Share", "Export"]) {
      const button = screen.getByRole("button", { name });
      expect(button.querySelector("span span")).toBeNull();
    }
  });
});
