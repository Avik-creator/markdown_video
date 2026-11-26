// Public surface of @markdown-video/scenes.
//
// The package is the reusable React scene-rendering layer: scene components,
// overlays, transitions, camera transforms, deterministic sceneTime animation
// math, and the logical-frame composition shared by the Next.js editor and
// headless render hosts. It is deliberately free of editor state (no zustand
// store), framework coupling (no next/* imports), and wall-clock-dependent
// rendering: identical (scene, sceneTime) inputs produce identical markup.
//
// Host integration contracts (fonts, Tailwind scanning, localization) are
// documented in the package README.

export {};
