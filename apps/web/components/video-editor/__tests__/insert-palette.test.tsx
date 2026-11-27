// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InsertPalette } from "../insert-palette";

describe("InsertPalette", () => {
  afterEach(() => {
    cleanup();
    // Radix portals are appended outside the testing-library container.
    document.body.innerHTML = "";
  });

  it("lists searchable snippets with a markdown preview", () => {
    render(
      <InsertPalette open onOpenChange={() => {}} onInsert={() => true} />
    );

    expect(screen.getByRole("option", { name: /Intro/ })).toBeTruthy();
    expect(screen.getByText("Markdown preview")).toBeTruthy();
    expect(document.body.textContent).toContain("Welcome to My Video");
  });

  it("filters across descriptions and keywords", () => {
    render(
      <InsertPalette open onOpenChange={() => {}} onInsert={() => true} />
    );

    fireEvent.change(screen.getByLabelText("Search scene snippets"), {
      target: { value: "confetti" },
    });

    expect(screen.queryByRole("option", { name: /Intro/ })).toBeNull();
    expect(screen.getByRole("option", { name: /^Celebration/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /^Particles/ })).toBeTruthy();
  });

  it("inserts the keyboard-active snippet with Enter and closes", () => {
    const onInsert = vi.fn(() => true);
    const onOpenChange = vi.fn();
    render(<InsertPalette open onOpenChange={onOpenChange} onInsert={onInsert} />);

    const input = screen.getByLabelText("Search scene snippets");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onInsert).toHaveBeenCalledOnce();
    expect((onInsert.mock.calls[0] as unknown as [{ id: string }])[0].id).toBe("text");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays open when the editor refuses the insertion", () => {
    const onInsert = vi.fn(() => false);
    const onOpenChange = vi.fn();
    render(<InsertPalette open onOpenChange={onOpenChange} onInsert={onInsert} />);

    fireEvent.click(screen.getByRole("option", { name: /Intro/ }));

    expect(onInsert).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
