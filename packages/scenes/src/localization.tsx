"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { LocalizationStrings } from "@markdown-video/core";

/**
 * Document-level localization data scenes resolve against.
 *
 * This mirrors the fields the markdown parser derives from `!locales` and
 * `!strings` blocks plus the host's user-selected locale. Scenes read the
 * data through React context instead of a global store so the package stays
 * host-agnostic: the Next.js editor feeds its zustand state in at the shell,
 * while a headless render host can pass the parsed document values directly
 * (or nothing at all for monolingual documents).
 */
export interface SceneLocalization {
  /** Translations from the document's `!strings` blocks, keyed by i18n key. */
  strings?: LocalizationStrings;
  /** Locales declared by the document's `!locales` directive. */
  locales?: readonly string[];
  /** Document default locale (the first valid token in `!locales`). */
  defaultLocale?: string;
  /** Host-selected active locale, for example from a locale picker. */
  activeLocale?: string | null;
}

/**
 * Default context value: a monolingual document with no translations. With
 * these values the resolution chain in core degrades to inline text content,
 * which is exactly how scenes behave when no localization data exists.
 */
const DEFAULT_SCENE_LOCALIZATION: SceneLocalization = {};

export const SceneLocalizationContext =
  createContext<SceneLocalization>(DEFAULT_SCENE_LOCALIZATION);

/**
 * Provide document-level localization data to all nested scenes. Composite
 * scenes (mockups, split panels) nest arbitrarily deep, so the data travels
 * through context rather than per-scene props; a provider anywhere above the
 * scene tree is sufficient.
 */
export function SceneLocalizationProvider({
  value,
  children,
}: {
  value: SceneLocalization;
  children?: ReactNode;
}) {
  return (
    <SceneLocalizationContext.Provider value={value}>
      {children}
    </SceneLocalizationContext.Provider>
  );
}

/** Read the localization data available to the current scene tree. */
export function useSceneLocalization(): SceneLocalization {
  return useContext(SceneLocalizationContext);
}
