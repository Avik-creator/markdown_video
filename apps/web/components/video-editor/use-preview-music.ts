"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  PreviewMusicController,
  type PreviewMusicSnapshot,
} from "@/lib/preview-music"
import { useVideoStore } from "@/lib/use-video-store"
import type { VideoStore } from "@/lib/types"
import { resolveBrowserAssetSource } from "@/lib/assets/asset-resolution"

function snapshotFromStore(state: VideoStore): PreviewMusicSnapshot | null {
  if (!state.music) return null
  return {
    isPlaying: state.isPlaying,
    currentTime: state.currentTime,
    playbackSpeed: state.playbackSpeed,
    totalDuration: state.totalDuration,
    music: state.music,
  }
}

export interface UsePreviewMusicResult {
  hasMusic: boolean;
  isMuted: boolean;
  toggleMuted: () => void;
}

/**
 * Owns the preview music element for the playback controls.
 *
 * The synchronization point is a zustand subscription rather than a second
 * playback loop: the existing controls rAF advances the store, and every store
 * advance synchronously re-applies rate, drift correction, and the fade gain.
 * Starting from the subscription also means the initial play() call happens in
 * the same user-activated click/keypress task that flips `isPlaying`.
 */
export function usePreviewMusic(): UsePreviewMusicResult {
  const music = useVideoStore((state) => state.music)
  const musicSrc = music?.src
  const [isMuted, setIsMuted] = useState(false)
  const mutedRef = useRef(false)
  const controllerRef = useRef<PreviewMusicController | null>(null)

  useEffect(() => {
    mutedRef.current = isMuted
    controllerRef.current?.setMuted(isMuted)
  }, [isMuted])

  useEffect(() => {
    if (!musicSrc || typeof Audio === "undefined") return

    const audio = new Audio()
    const controller = new PreviewMusicController(audio)
    controllerRef.current = controller

    const sync = () => {
      const snapshot = snapshotFromStore(useVideoStore.getState())
      if (!snapshot || snapshot.music.src !== musicSrc) {
        // Markdown reparses notify subscribers before React has run this
        // effect's cleanup. Silence the old element immediately if the track
        // was removed or replaced instead of letting it finish a phrase.
        controller.pause()
        return
      }
      controller.sync(snapshot, { muted: mutedRef.current })
    }

    // Metadata can arrive long after the user pressed play. These events do
    // not start playback by themselves; sync still honors the store's paused
    // state and merely applies a pending seek/play when appropriate.
    const mediaReadyEvents = ["loadedmetadata", "durationchange", "canplay"] as const
    for (const eventName of mediaReadyEvents) {
      audio.addEventListener(eventName, sync)
    }

    // The video playhead is rAF-driven and therefore stops while the document
    // is hidden. Media elements do not share that suspension, so without an
    // explicit pause a hidden tab would keep audible music running far ahead
    // of the frozen playhead. Resume through the normal store-governed sync
    // when the tab becomes visible again.
    const handleVisibilityChange = () => {
      if (document.hidden) {
        controller.pause()
      } else {
        sync()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Resolve uploaded IndexedDB bytes first for document-relative paths,
    // then preserve the browser's existing static/remote/data/blob behavior.
    // Playback itself remains source-agnostic and does not need remote CORS.
    let sourceResolutionCancelled = false
    void resolveBrowserAssetSource(musicSrc)
      .then((resolved) => {
        if (sourceResolutionCancelled) return
        audio.src = resolved.url
        sync()
      })
      .catch((error) => {
        if (!sourceResolutionCancelled) {
          console.warn(`[markdown-video] Could not resolve preview music "${musicSrc}":`, error)
        }
      })

    const unsubscribe = useVideoStore.subscribe(sync)
    sync()

    return () => {
      sourceResolutionCancelled = true
      unsubscribe()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      for (const eventName of mediaReadyEvents) {
        audio.removeEventListener(eventName, sync)
      }
      if (controllerRef.current === controller) {
        controllerRef.current = null
      }
      controller.dispose()
    }
  }, [musicSrc])

  const toggleMuted = useCallback(() => {
    setIsMuted((muted) => !muted)
  }, [])

  return {
    hasMusic: Boolean(musicSrc),
    isMuted,
    toggleMuted,
  }
}
