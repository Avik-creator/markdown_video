import { createWriteStream } from "node:fs"
import { stat, unlink, writeFile } from "node:fs/promises"
import type { IncomingMessage } from "node:http"
import https from "node:https"
import { lookup } from "node:dns/promises"
import net from "node:net"
import path from "node:path"
import { pipeline } from "node:stream/promises"

import type { MusicTrack } from "@markdown-video/core"

import { RenderError, UsageError } from "./errors.js"

export const MAX_REMOTE_MUSIC_BYTES = 32 * 1024 * 1024
export const MAX_LOCAL_MUSIC_BYTES = 256 * 1024 * 1024
const MUSIC_FETCH_TIMEOUT_MS = 15_000
const MAX_REDIRECTS = 5

export interface PreparedMusicInput {
  /** Path passed as ffmpeg input argv element. */
  inputPath: string
  /** True when this file is owned by the render's temporary directory. */
  temporary: boolean
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }
  const a = parts[0]!
  const b = parts[1]!
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 0 && parts[2] === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && parts[2] === 100) ||
    (a === 203 && b === 0 && parts[2] === 113) ||
    a >= 224
  )
}

function expandIPv6(ip: string): number[] | null {
  let value = ip.toLowerCase().replace(/%.*$/, "")
  const ipv4Index = value.lastIndexOf(":")
  if (ipv4Index >= 0 && value.slice(ipv4Index + 1).includes(".")) {
    const ipv4 = value.slice(ipv4Index + 1)
    const octets = ipv4.split(".").map((part) => Number(part))
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return null
    }
    const high = (octets[0]! << 8) | octets[1]!
    const low = (octets[2]! << 8) | octets[3]!
    value = `${value.slice(0, ipv4Index)}:${high.toString(16)}:${low.toString(16)}`
  }

  const doubleColon = value.split("::")
  if (doubleColon.length > 2) return null
  const parseSide = (side: string) =>
    side.length === 0
      ? []
      : side.split(":").map((part) => {
          if (!/^[0-9a-f]{1,4}$/.test(part)) return Number.NaN
          return Number.parseInt(part, 16)
        })

  if (doubleColon.length === 2) {
    const left = parseSide(doubleColon[0] ?? "")
    const right = parseSide(doubleColon[1] ?? "")
    if ([...left, ...right].some(Number.isNaN) || left.length + right.length > 8) return null
    return [...left, ...Array(8 - left.length - right.length).fill(0), ...right]
  }

  const groups = parseSide(value)
  if (groups.length !== 8 || groups.some(Number.isNaN)) return null
  return groups
}

function isPrivateIPv6(ip: string): boolean {
  const groups = expandIPv6(ip)
  if (!groups) return true
  const g0 = groups[0]!
  const g1 = groups[1]!
  const g6 = groups[6]!
  const g7 = groups[7]!
  if (groups.every((group) => group === 0)) return true // ::
  if (groups.slice(0, 7).every((group) => group === 0) && g7 === 1) return true // ::1
  if ((g0 & 0xfe00) === 0xfc00) return true // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return true // fe80::/10 link local
  if ((g0 & 0xff00) === 0xff00) return true // multicast
  if (g0 === 0x2001 && g1 === 0x0db8) return true // documentation range
  // IPv4-mapped/translated forms inherit the IPv4 policy.
  if (
    groups.slice(0, 5).every((group) => group === 0) &&
    (groups[5] === 0xffff || groups[5] === 0)
  ) {
    const ipv4 = `${(g6 >> 8) & 0xff}.${g6 & 0xff}.${(g7 >> 8) & 0xff}.${g7 & 0xff}`
    return isPrivateIPv4(ipv4)
  }
  return false
}

function isPublicIp(ip: string): boolean {
  const family = net.isIP(ip)
  if (family === 4) return !isPrivateIPv4(ip)
  if (family === 6) return !isPrivateIPv6(ip)
  return false
}

interface PinnedHttpsUrl {
  url: URL
  pinnedAddress: string
  family: 4 | 6
}

async function validateAndPinHttpsUrl(rawUrl: string | URL): Promise<PinnedHttpsUrl> {
  const url = typeof rawUrl === "string" ? new URL(rawUrl) : rawUrl
  if (url.protocol !== "https:") {
    throw new UsageError("Remote music must use HTTPS.")
  }
  if (url.username || url.password) {
    throw new UsageError("Remote music URLs must not embed credentials.")
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase()
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new UsageError("Remote music hostnames may not be localhost.")
  }

  const ipFamily = net.isIP(hostname)
  if (ipFamily !== 0) {
    if (!isPublicIp(hostname)) {
      throw new UsageError("Remote music IP addresses must be publicly routable.")
    }
    return { url, pinnedAddress: hostname, family: ipFamily as 4 | 6 }
  }

  let addresses
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true })
  } catch (error) {
    throw new RenderError(
      `Could not resolve music host "${hostname}": ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (addresses.length === 0 || addresses.some((entry) => !isPublicIp(entry.address))) {
    throw new UsageError("Remote music hostnames must resolve only to publicly routable IP addresses.")
  }
  const first = addresses[0]!
  return { url, pinnedAddress: first.address, family: first.family as 4 | 6 }
}

function responseContentTypeAllowsAudio(response: IncomingMessage): boolean {
  const contentType = (String(response.headers["content-type"] ?? "").split(";")[0] ?? "").trim().toLowerCase()
  return (
    contentType === "" ||
    contentType.startsWith("audio/") ||
    contentType === "application/octet-stream" ||
    contentType === "binary/octet-stream"
  )
}

async function downloadPinnedUrlOnce(
  pinned: PinnedHttpsUrl,
  destinationPath: string,
): Promise<{ redirectLocation?: string | undefined }> {
  const { url, pinnedAddress } = pinned
  const hostHeader = url.host
  const requestOptions: https.RequestOptions = {
    protocol: "https:",
    // Connecting to the pre-validated IP prevents DNS rebinding between the
    // validation lookup and connect. SNI/Host still use the public hostname,
    // so certificate validation and virtual hosting remain correct.
    hostname: pinnedAddress,
    port: url.port || 443,
    path: `${url.pathname}${url.search}`,
    method: "GET",
    servername: url.hostname,
    headers: {
      host: hostHeader,
      accept: "audio/*,application/octet-stream;q=0.8,*/*;q=0.1",
      "user-agent": "markdown-video-cli/music-fetch",
    },
    timeout: MUSIC_FETCH_TIMEOUT_MS,
  }

  return new Promise((resolve, reject) => {
    const request = https.request(requestOptions, (response) => {
      const status = response.statusCode ?? 0
      if (status >= 300 && status < 400 && typeof response.headers.location === "string") {
        response.resume()
        resolve({ redirectLocation: response.headers.location })
        return
      }
      if (status !== 200) {
        response.resume()
        reject(new RenderError(`Music download failed with HTTP status ${status}.`))
        return
      }
      if (!responseContentTypeAllowsAudio(response)) {
        response.resume()
        reject(new RenderError("Music download did not return an audio content type."))
        return
      }
      const declaredLength = Number(response.headers["content-length"] ?? 0)
      if (declaredLength > MAX_REMOTE_MUSIC_BYTES) {
        response.resume()
        reject(new RenderError("Remote music exceeds the 32MB safety limit."))
        return
      }

      let received = 0
      response.on("data", (chunk: Buffer) => {
        received += chunk.length
        if (received > MAX_REMOTE_MUSIC_BYTES) {
          response.destroy(new RenderError("Remote music exceeds the 32MB safety limit."))
        }
      })

      pipeline(response, createWriteStream(destinationPath))
        .then(() => resolve({}))
        .catch((error) => {
          void unlink(destinationPath).catch(() => undefined)
          reject(error)
        })
    })

    request.once("timeout", () => {
      request.destroy(new RenderError("Remote music download timed out."))
    })
    request.once("error", (error) => {
      void unlink(destinationPath).catch(() => undefined)
      reject(error)
    })
    request.end()
  })
}

async function downloadRemoteMusic(src: string, destinationPath: string): Promise<void> {
  let current = new URL(src)
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const pinned = await validateAndPinHttpsUrl(current)
    const result = await downloadPinnedUrlOnce(pinned, destinationPath)
    if (!result.redirectLocation) return
    current = new URL(result.redirectLocation, current)
  }
  throw new RenderError("Remote music redirected too many times.")
}

function parseDataAudioUrl(src: string): Buffer {
  const match = src.match(/^data:([^,]*),(.*)$/is)
  if (!match) throw new UsageError("Invalid data URL used for music.")
  const metadata = (match[1] ?? "").toLowerCase()
  const mimeType = metadata.split(";")[0] ?? ""
  if (!mimeType.startsWith("audio/")) {
    throw new UsageError("Music data URLs must use an audio/* media type.")
  }
  if (metadata.includes(";base64")) {
    return Buffer.from(match[2] ?? "", "base64")
  }
  return Buffer.from(decodeURIComponent(match[2] ?? ""), "utf8")
}

function isUriWithUnsupportedScheme(src: string): boolean {
  const scheme = src.match(/^([A-Za-z][A-Za-z0-9+.-]*):/)
  const schemeName = scheme?.[1]
  return Boolean(schemeName && schemeName.length > 1 && !/^(https|data|blob)$/i.test(schemeName))
}

/**
 * Resolve a parsed !music track into a concrete ffmpeg input path.
 *
 * Remote URLs are fetched by the CLI (never by Chromium), with HTTPS,
 * redirect, DNS/IP, size, and content-type validation. Local paths are passed
 * to ffmpeg as paths; no shell is involved. `allowExternalMusic=false` is the
 * isolated-service mode: only self-contained data: audio is accepted, because
 * local paths could read service files and URLs would be egress/SSRF.
 */
export async function prepareMusicInput({
  music,
  markdownBaseDir,
  tempDir,
  allowExternalMusic,
}: {
  music: MusicTrack
  markdownBaseDir: string
  tempDir: string
  allowExternalMusic: boolean
}): Promise<PreparedMusicInput> {
  const src = music.src.trim()
  if (!src) throw new UsageError("!music requires a non-empty source.")

  if (/^blob:/i.test(src)) {
    throw new UsageError("blob: music URLs exist only in the browser session that created them.")
  }

  if (/^data:/i.test(src)) {
    const data = parseDataAudioUrl(src)
    if (data.length === 0) throw new UsageError("Music data URL is empty.")
    if (data.length > MAX_REMOTE_MUSIC_BYTES) {
      throw new UsageError("Inline music data exceeds the 32MB safety limit.")
    }
    const inputPath = path.join(tempDir, "music-input")
    await writeFile(inputPath, data)
    return { inputPath, temporary: true }
  }

  if (!allowExternalMusic) {
    throw new UsageError(
      "This renderer is network/file isolated; !music supports only inline data: audio URLs.",
    )
  }

  if (/^https:\/\//i.test(src)) {
    const inputPath = path.join(tempDir, "music-input")
    await downloadRemoteMusic(src, inputPath)
    return { inputPath, temporary: true }
  }

  if (/^http:\/\//i.test(src) || src.startsWith("//")) {
    throw new UsageError("Remote music must use HTTPS.")
  }
  if (isUriWithUnsupportedScheme(src)) {
    throw new UsageError("Unsupported music source scheme. Use HTTPS, data:, or a local audio file path.")
  }

  const inputPath = path.isAbsolute(src) ? path.normalize(src) : path.resolve(markdownBaseDir, src)
  const fileStat = await stat(inputPath).catch(() => null)
  if (!fileStat?.isFile()) {
    throw new UsageError(`Music file not found: ${inputPath}`)
  }
  if (fileStat.size > MAX_LOCAL_MUSIC_BYTES) {
    throw new UsageError("Local music file exceeds the 256MB safety limit.")
  }
  return { inputPath, temporary: false }
}
