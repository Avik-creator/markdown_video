// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Controls } from "../controls";

describe("Controls accessibility and responsive layout", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps playback controls accessibly named", () => {
    render(<Controls />);

    expect(screen.getByRole("button", { name: "Skip back 3 seconds" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^(Play|Pause)$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skip forward 3 seconds" })).toBeTruthy();
    expect(screen.getByLabelText("Playback speed")).toBeTruthy();
  });

  it("allows the playback bar to wrap instead of overflowing narrow embeds", () => {
    const { container } = render(<Controls />);
    const root = container.firstElementChild;

    expect(root?.className).toContain("flex-wrap");
    expect(root?.querySelector(".ml-auto")).not.toBeNull();
  });
});
