/**
 * Shared project file open/download helpers. Both the project menu and the
 * editor shortcuts need these; they were duplicated with slight drift.
 */

/** Trigger a browser download of the markdown as a `.mdv` project file. */
export function downloadMarkdownProject(markdown: string): void {
  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "project.mdv";
  a.click();
  // Revoking synchronously can race the download handoff in some browsers;
  // defer revocation so the browser has taken the blob reference.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Open a file picker for a markdown project file and resolve with its text,
 * or null when the user cancels or no file is chosen.
 */
export function pickMarkdownFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mdv,.md,.txt";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      resolve(file ? await file.text() : null);
    };
    input.click();
  });
}
