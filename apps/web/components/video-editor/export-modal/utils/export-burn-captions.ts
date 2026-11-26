// Export caption burn-in capture state.
//
// Browser export captures the live preview DOM through html2canvas, so burned
// captions must be real DOM inside the scene frame while a capture runs — but
// they must never appear during normal editing or playback preview. This
// module-scoped state is the bridge: the export run publishes the cue list it
// already generated for the sidecar downloads exactly while it is capturing,
// and the preview shell forwards it to SceneFrame's captions prop with the
// store's absolute playback clock.
//
// This is deliberately NOT part of the zustand video store. It is transient
// capture-machinery state, not document or project data: it must not be
// persisted, rehydrated, shared, or exposed to editor UI. A module-level
// external store keeps the ownership boundary inside the export modal while
// still giving the preview shell a spec-correct useSyncExternalStore contract.

import type { CaptionCue } from "@markdown-video/core";

let activeCues: readonly CaptionCue[] | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Publish the cues being burned for the duration of one export capture.
 * Called by the render run right before frame capture starts, with the same
 * cue objects used for the SRT/VTT downloads.
 */
export function beginExportCaptionBurn(cues: readonly CaptionCue[]) {
  activeCues = cues;
  emit();
}

/**
 * Stop burning captions. Reference-matched so a cancelled run's delayed
 * cleanup cannot clear the state of a newer run that has already started.
 */
export function endExportCaptionBurn(cues: readonly CaptionCue[]) {
  if (activeCues !== cues) return;
  activeCues = null;
  emit();
}

export function subscribeExportCaptionBurn(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getExportCaptionBurnCues(): readonly CaptionCue[] | null {
  return activeCues;
}

/** SSR snapshot: burn-in never happens during server rendering. */
export function getExportCaptionBurnCuesServerSnapshot(): readonly CaptionCue[] | null {
  return null;
}
