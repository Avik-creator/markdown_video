"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Host-injected source mapping for scene media.
 *
 * The input is exactly the source text parsed from the document; the return
 * value is what the scene should put into the rendered media element. Hosts
 * can use this seam to map document-relative media into object URLs, render
 * service URLs, or any other environment-specific location without coupling
 * the scene package to that host's storage. The default is identity.
 */
export type SceneSourceResolver = (src: string) => string;

export const identitySceneSourceResolver: SceneSourceResolver = (src) => src;

const SceneSourceResolverContext = createContext<SceneSourceResolver>(
  identitySceneSourceResolver
);

export function SceneSourceResolverProvider({
  resolveSrc,
  children,
}: {
  resolveSrc: SceneSourceResolver | undefined;
  children: ReactNode;
}) {
  return (
    <SceneSourceResolverContext.Provider
      value={resolveSrc ?? identitySceneSourceResolver}
    >
      {children}
    </SceneSourceResolverContext.Provider>
  );
}

export function useSceneSourceResolver(): SceneSourceResolver {
  return useContext(SceneSourceResolverContext);
}
