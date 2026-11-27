import { describe, expect, it } from "vitest"

import { formatDoctorReport, type DoctorReport } from "./doctor.js"

describe("formatDoctorReport", () => {
  it("formats a passing report", () => {
    const report: DoctorReport = {
      ok: true,
      checks: [
        {
          id: "node",
          name: "Node.js",
          ok: true,
          detail: "v22.0.0 (required: >=20)",
        },
      ],
    }

    expect(formatDoctorReport(report)).toContain("✓ Node.js: v22.0.0")
    expect(formatDoctorReport(report)).toContain("All checks passed")
  })

  it("indents multiline fix-it instructions beneath failing checks", () => {
    const output = formatDoctorReport({
      ok: false,
      checks: [
        {
          id: "ffmpeg",
          name: "ffmpeg",
          ok: false,
          detail: "missing",
          fix: "first\nsecond",
        },
      ],
    })

    expect(output).toContain("✗ ffmpeg: missing")
    expect(output).toContain("  first\n  second")
    expect(output).toContain("1 check needs attention")
  })
})
