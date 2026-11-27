#!/usr/bin/env node

import { UsageError } from "./errors.js"
import { main } from "./cli-main.js"

void main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`markdown-video: ${message}\n`)
    if (error instanceof UsageError) {
      process.stderr.write("Run markdown-video --help for usage.\n")
      process.exitCode = error.exitCode
    } else {
      process.exitCode = 1
    }
  })
