"use client";

// The implementation lives beside SceneRenderer so recursive split panels can
// reuse the renderer without a circular module dependency.
export { SplitScene } from "./SceneRenderer.js";
