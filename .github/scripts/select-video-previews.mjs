import { appendFileSync } from "node:fs"
import { execFileSync } from "node:child_process"

const MAX_PREVIEWS = 3

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function commitSha(name) {
  const value = requiredEnv(name)
  if (!/^[0-9a-f]{40}$/i.test(value)) {
    throw new Error(`${name} is not a full commit SHA`)
  }
  return value
}

function writeOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required")
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, "utf8")
}

const baseSha = commitSha("BASE_SHA")
const headSha = commitSha("HEAD_SHA")

const diff = execFileSync(
  "git",
  [
    "diff",
    "--name-only",
    "-z",
    "--diff-filter=ACMR",
    `${baseSha}...${headSha}`,
  ],
  { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
)

const changedFiles = [
  ...new Set(
    diff
      .split("\0")
      .filter(Boolean)
      .filter((file) => file.endsWith(".video.md")),
  ),
]

// GitHub output values cannot safely represent newlines in the simple key=value
// form, and the renderer deliberately rejects leading/trailing whitespace in
// paths. Such filenames are pathological for a PR preview workflow; skip them
// rather than shell-encoding them into action inputs.
const portableFiles = changedFiles.filter(
  (file) => !/[\r\n]/.test(file) && !/^\s/.test(file) && !/\s$/.test(file),
)
const selected = portableFiles.slice(0, MAX_PREVIEWS)

writeOutput("count", String(changedFiles.length))
writeOutput("selected-count", String(selected.length))
for (let index = 0; index < MAX_PREVIEWS; index += 1) {
  writeOutput(`file${index + 1}`, selected[index] ?? "")
}

if (changedFiles.length === 0) {
  console.log("No added or modified *.video.md files were found in this PR diff.")
} else {
  console.log(`Found ${changedFiles.length} changed *.video.md file(s); selected ${selected.length} for GIF rendering.`)
  for (const file of selected) console.log(`- ${file}`)
  if (changedFiles.length > selected.length) {
    console.log("Additional changed video files were not rendered to bound PR preview compute time.")
  }
}
