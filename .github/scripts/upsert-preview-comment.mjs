const MARKER = "<!-- markdown-video-preview -->"
const MAX_COMMENT_PAGES = 3

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

const token = requiredEnv("MV_GITHUB_TOKEN")
const repository = requiredEnv("GITHUB_REPOSITORY")
if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
  throw new Error(`Unexpected GITHUB_REPOSITORY value: ${repository}`)
}
const [owner, repo] = repository.split("/")

const prNumberText = requiredEnv("PR_NUMBER")
if (!/^\d+$/.test(prNumberText)) throw new Error("PR_NUMBER must be numeric")
const prNumber = Number(prNumberText)

const artifactUrl = requiredEnv("ARTIFACT_URL")
if (!artifactUrl.startsWith("http")) {
  throw new Error("ARTIFACT_URL must be an http(s) URL")
}

const selectedCountText = requiredEnv("SELECTED_COUNT")
if (!/^[0-3]$/.test(selectedCountText)) {
  throw new Error("SELECTED_COUNT must be an integer from 0 to 3")
}
const selectedCount = Number(selectedCountText)
if (selectedCount === 0) throw new Error("No selected preview files were provided")

const files = []
for (let index = 1; index <= selectedCount; index += 1) {
  const file = requiredEnv(`FILE_${index}`)
  files.push({ file, gifName: `preview-${index}.gif` })
}

const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com"
const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com"
const runUrl = process.env.GITHUB_RUN_ID
  ? `${serverUrl}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : null

async function api(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GitHub API ${options.method ?? "GET"} ${path} failed with ${response.status}: ${body.slice(0, 500)}`)
  }
  if (response.status === 204) return null
  return response.json()
}

const fileList = files
  .map(({ file, gifName }) => `- <code>${escapeHtml(file)}</code> → <code>${gifName}</code>`)
  .join("\n")

const body = `${MARKER}
### markdown-video GIF preview

Rendered ${files.length} GIF preview${files.length === 1 ? "" : "s"} for the changed <code>*.video.md</code> file${files.length === 1 ? "" : "s"}:

${fileList}

[Download the preview artifact](${artifactUrl}) and extract the zip to view the GIF${files.length === 1 ? "" : "s"}. Artifact download links require GitHub sign-in and this artifact is retained for 7 days.${runUrl ? ` [Open the workflow run](${runUrl}).` : ""}
`

let existingComment = null
for (let page = 1; page <= MAX_COMMENT_PAGES; page += 1) {
  const comments = await api(
    `/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100&page=${page}`,
  )
  existingComment = comments.find(
    (comment) => comment.user?.type === "Bot" && comment.body?.includes(MARKER),
  ) ?? null
  if (existingComment || comments.length < 100) break
}

if (existingComment) {
  const updated = await api(
    `/repos/${owner}/${repo}/issues/comments/${existingComment.id}`,
    { method: "PATCH", body: JSON.stringify({ body }) },
  )
  console.log(`Updated markdown-video preview comment: ${updated.html_url}`)
} else {
  const created = await api(
    `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
    { method: "POST", body: JSON.stringify({ body }) },
  )
  console.log(`Created markdown-video preview comment: ${created.html_url}`)
}
