/**
 * In-memory `localStorage` stub for the Node test environment.
 *
 * zustand's `persist` middleware resolves `localStorage` once when the store
 * module is evaluated, so this module must be imported (for its side effect)
 * BEFORE `../../use-video-store` in any test file that exercises persistence.
 */
export class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

export const memoryStorage = new MemoryStorage();

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });
}
