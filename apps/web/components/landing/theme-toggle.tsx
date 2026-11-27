"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function LandingThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );

  const isDark = mounted && resolvedTheme === "dark";
  const label = mounted
    ? isDark
      ? "Switch to light theme"
      : "Switch to dark theme"
    : "Toggle color theme";

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isDark}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-[color:var(--landing-line)]/80 bg-transparent text-[color:var(--landing-ink)] transition-colors duration-200 hover:border-[color:var(--landing-accent)]/75 hover:bg-[color:var(--surface)] hover:text-[color:var(--landing-accent-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--landing-paper)]"
    >
      <span className="relative grid size-5 place-items-center" aria-hidden="true">
        <Sun className="size-[17px] transition-all duration-300 dark:-rotate-90 dark:scale-50 dark:opacity-0" />
        <Moon className="absolute size-[16px] rotate-90 scale-50 opacity-0 transition-all duration-300 dark:rotate-0 dark:scale-100 dark:opacity-100" />
      </span>
    </button>
  );
}
