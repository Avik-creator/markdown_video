/**
 * Best-effort static media existence checks used only for honest diagnostics.
 * Successful/unsuccessful results are cached per browser session so validation
 * does not issue a HEAD request on every keystroke.
 */
const staticAssetChecks = new Map<string, Promise<boolean>>();

type StaticExistsChecker = (path: string) => Promise<boolean>;

async function checkWithFetch(path: string): Promise<boolean> {
  if (typeof fetch !== "function") return false;
  try {
    const response = await fetch(path, { method: "HEAD", cache: "force-cache" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function checkStaticAssetExists(path: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const normalized = path.replace(/^\.\//, "/");
  const existing = staticAssetChecks.get(normalized);
  if (existing) return existing;
  const check = checkWithFetch(normalized).catch(() => false);
  staticAssetChecks.set(normalized, check);
  return check;
}

export function createMissingAssetChecker(
  checker: StaticExistsChecker = checkStaticAssetExists
): StaticExistsChecker {
  return checker;
}

export function clearStaticAssetChecksForTests(): void {
  staticAssetChecks.clear();
}
