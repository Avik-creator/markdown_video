import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getRenderBackend, requireRenderBackend } from "../render-backend";

const envKeys = [
  "RENDER_WORKER_URL",
  "RENDER_WORKER_SHARED_SECRET",
  "VERCEL_OIDC_TOKEN",
  "VERCEL_TOKEN",
  "VERCEL_TEAM_ID",
  "VERCEL_PROJECT_ID",
] as const;
let savedEnv: Record<string, string | undefined> = {};

function clearBackendEnv() {
  for (const key of envKeys) delete process.env[key];
}

beforeEach(() => {
  savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  clearBackendEnv();
});

afterEach(() => {
  clearBackendEnv();
  for (const key of envKeys) {
    const value = savedEnv[key];
    if (value !== undefined) process.env[key] = value;
  }
});

describe("render backend selection", () => {
  it("prefers the dedicated render worker when both worker variables are present", () => {
    process.env.RENDER_WORKER_URL = "https://worker.example.com";
    process.env.RENDER_WORKER_SHARED_SECRET = "secret";
    process.env.VERCEL_OIDC_TOKEN = "oidc";
    expect(getRenderBackend()).toBe("worker");
  });

  it("selects the sandbox backend for OIDC or explicit API-token credentials", () => {
    process.env.VERCEL_OIDC_TOKEN = "oidc";
    expect(getRenderBackend()).toBe("sandbox");

    delete process.env.VERCEL_OIDC_TOKEN;
    process.env.VERCEL_TOKEN = "token";
    process.env.VERCEL_TEAM_ID = "team";
    process.env.VERCEL_PROJECT_ID = "project";
    expect(getRenderBackend()).toBe("sandbox");
  });

  it("fails closed when neither backend is fully configured", () => {
    expect(getRenderBackend()).toBeNull();
    expect(() => requireRenderBackend()).toThrow(/RENDER_WORKER_URL/);
    expect(() => requireRenderBackend()).toThrow(/VERCEL_OIDC_TOKEN/);

    process.env.VERCEL_TOKEN = "token";
    process.env.VERCEL_TEAM_ID = "team";
    expect(getRenderBackend()).toBeNull();
  });

  it("treats a malformed worker URL as a worker configuration error rather than silently falling back", () => {
    process.env.RENDER_WORKER_URL = "not a url";
    process.env.RENDER_WORKER_SHARED_SECRET = "secret";
    process.env.VERCEL_OIDC_TOKEN = "oidc";
    expect(() => getRenderBackend()).toThrow(/RENDER_WORKER_URL is not a valid URL/);
  });
});
