// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import {
  IDENTITY_CAMERA_TRANSFORM,
  cameraTransformToCss,
  getCameraTransform,
} from "../camera-transform.js";
import { CameraWrapper } from "../../components/CameraWrapper.js";
import type { SceneCamera } from "@markdown-video/core";

describe("getCameraTransform", () => {
  it("returns the complete identity transform when camera is absent", () => {
    expect(getCameraTransform(undefined, 1)).toEqual({
      scale: 1,
      x: 0,
      y: 0,
    });
  });

  it("sets all axes for a simple zoom effect", () => {
    const camera: SceneCamera = { effect: "zoom", value: 1.4 };

    expect(getCameraTransform(camera, 2)).toEqual({
      scale: 1.4,
      x: 0,
      y: 0,
    });
  });

  it("sets all axes for a simple pan effect, resetting scale and y", () => {
    const camera: SceneCamera = { effect: "pan", value: 1.2 };

    expect(getCameraTransform(camera, 2)).toEqual({
      scale: 1,
      x: 60,
      y: 0,
    });
  });

  it("sets all axes for a simple shake effect deterministically", () => {
    const camera: SceneCamera = { effect: "shake" };
    const atOneSecond = getCameraTransform(camera, 1);

    expect(atOneSecond.scale).toBe(1);
    expect(atOneSecond.x).toBeCloseTo(Math.sin(50) * 5, 10);
    expect(atOneSecond.y).toBeCloseTo(Math.cos(50) * 5, 10);
    expect(getCameraTransform(camera, 1)).toEqual(atOneSecond);
  });

  it("interpolates keyframe zoom while still resetting pan axes when no pan is present", () => {
    const camera: SceneCamera = {
      effect: "zoom",
      keyframes: [
        { at: 1, zoom: 1 },
        { at: 3, zoom: 2 },
      ],
    };

    expect(getCameraTransform(camera, 2)).toEqual({
      scale: 1.5,
      x: 0,
      y: 0,
    });
  });

  it("combines keyframe pan and deterministic shake without omitting zoom", () => {
    const camera: SceneCamera = {
      effect: "zoom",
      keyframes: [
        {
          at: 0,
          zoom: 1.25,
          pan: "right",
          panAmount: 20,
          shake: true,
          shakeIntensity: "medium",
        },
      ],
    };

    const transform = getCameraTransform(camera, 0.5);
    expect(transform.scale).toBe(1.25);
    expect(transform.x).toBeCloseTo(20 + Math.sin(25) * 5, 10);
    expect(transform.y).toBeCloseTo(Math.cos(25) * 5, 10);
  });

  it("is a pure function across effect changes, so no scale/x/y state carries over", () => {
    const zoomed = getCameraTransform({ effect: "zoom", value: 2 }, 0);
    const panned = getCameraTransform({ effect: "pan", value: 1 }, 0);
    const plain = getCameraTransform(undefined, 0);

    expect(zoomed).toEqual({ scale: 2, x: 0, y: 0 });
    expect(panned).toEqual({ scale: 1, x: 50, y: 0 });
    expect(plain).toEqual(IDENTITY_CAMERA_TRANSFORM);
  });
});

describe("cameraTransformToCss", () => {
  it("serializes translation and scale deterministically", () => {
    expect(cameraTransformToCss({ scale: 1.25, x: 10, y: -5 })).toBe(
      "translateX(10px) translateY(-5px) scale(1.25)"
    );
  });
});

describe("CameraWrapper", () => {
  it("writes the complete pure transform inline during render", () => {
    const { container } = render(
      createElement(
        CameraWrapper,
        {
          camera: { effect: "zoom", value: 1.5 },
          sceneTime: 0,
        },
        createElement("div", null, "scene")
      )
    );

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.transform).toBe(
      "translateX(0px) translateY(0px) scale(1.5)"
    );
    cleanup();
  });

  it("does not render a wrapper element when camera is absent", () => {
    const { container } = render(
      createElement(
        CameraWrapper,
        {
          camera: undefined,
          sceneTime: 0,
        },
        createElement("main", null, "scene")
      )
    );

    expect(container.firstElementChild?.tagName).toBe("MAIN");
    cleanup();
  });

  it("replaces the complete inline transform when rerendered with a different camera effect", () => {
    const child = createElement("main", null, "scene");
    const { container, rerender } = render(
      createElement(
        CameraWrapper,
        {
          camera: { effect: "zoom", value: 2 },
          sceneTime: 0,
        },
        child
      )
    );

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.transform).toBe(
      "translateX(0px) translateY(0px) scale(2)"
    );

    rerender(
      createElement(
        CameraWrapper,
        {
          camera: { effect: "pan", value: 1 },
          sceneTime: 0,
        },
        child
      )
    );

    expect(container.firstElementChild).toBe(wrapper);
    expect(wrapper.style.transform).toBe(
      "translateX(50px) translateY(0px) scale(1)"
    );

    rerender(
      createElement(
        CameraWrapper,
        {
          camera: undefined,
          sceneTime: 0,
        },
        child
      )
    );

    expect(container.firstElementChild?.tagName).toBe("MAIN");
    cleanup();
  });
});
