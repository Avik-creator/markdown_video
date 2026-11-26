import { createRoot } from "react-dom/client";
import {
  markdownVideoRenderBridge,
  RenderHost,
  type MarkdownVideoRenderBridge,
} from "./render-host";
import { parseRenderPageConfig } from "./render-config";
import "./styles.css";

declare global {
  interface Window {
    __mv: MarkdownVideoRenderBridge;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Render root element is missing");
}

// Expose the bridge before the first React commit. load() internally waits for
// the host effect registration, so a CLI that evaluates immediately after the
// module loads still cannot race the renderer.
window.__mv = markdownVideoRenderBridge;

createRoot(rootElement).render(
  <RenderHost config={parseRenderPageConfig(window.location.search)} />
);
