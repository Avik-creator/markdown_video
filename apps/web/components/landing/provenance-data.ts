export const repositoryUrl = "https://github.com/Avik-creator/markdown_video";
export const examplesUrl = `${repositoryUrl}/tree/main/examples`;
const exampleSnapshotUrl = "/landing/sources";
export const mcpDocsUrl = `${repositoryUrl}#-use-it-from-an-ai-agent-mcp`;
export const actionDocsUrl = `${repositoryUrl}/tree/main/action`;
export const cliDocsUrl = `${repositoryUrl}/tree/main/apps/cli#readme`;
export const cliRenderDocsUrl = `${repositoryUrl}/blob/main/apps/cli/README.md#markdown-video-render`;
export const cliMusicDocsUrl = `${repositoryUrl}/blob/main/apps/cli/README.md#music`;
export const cliCaptionsDocsUrl = `${repositoryUrl}/blob/main/apps/cli/README.md#captions`;

export type SourceProof = {
  file: string;
  bytes: number;
  artifact: string;
  href: string;
};

export const sourceProofs: SourceProof[] = [
  {
    file: "launch.video.md",
    bytes: 1978,
    artifact: "launch-v2.mp4 + vtt",
    href: `${exampleSnapshotUrl}/launch.video.md`,
  },
  {
    file: "landing-hero.video.md",
    bytes: 751,
    artifact: "hero-showcase.mp4 + vtt",
    href: `${exampleSnapshotUrl}/landing-hero.video.md`,
  },
  {
    file: "landing-captions.video.md",
    bytes: 549,
    artifact: "captions-demo.mp4 + srt/vtt",
    href: `${exampleSnapshotUrl}/landing-captions.video.md`,
  },
  {
    file: "landing-agent-mcp.video.md",
    bytes: 287,
    artifact: "mcp-agent.mp4",
    href: `${exampleSnapshotUrl}/landing-agent-mcp.video.md`,
  },
  {
    file: "landing-i18n.video.md",
    bytes: 338,
    artifact: "localized preview frames",
    href: `${exampleSnapshotUrl}/landing-i18n.video.md`,
  },
  {
    file: "landing-action.video.md",
    bytes: 455,
    artifact: "workflow preview frame",
    href: `${exampleSnapshotUrl}/landing-action.video.md`,
  },
];
