// Bun's built-in linter first shipped in 1.4.4 (canary at the time of writing).
// On older versions `bun lint` resolves to this package's own `lint` script, so
// spawning it would recurse forever. Check first and fail with a clear message.
const [major = 0, minor = 0, patch = 0] = Bun.version.split("-")[0]!.split(".").map(Number)
const supported = major > 1 || (major === 1 && (minor > 4 || (minor === 4 && patch >= 4)))

if (!supported) {
  console.error(`jenkui lint needs Bun 1.4.4+ (built-in linter). This is ${Bun.version}.`)
  console.error("Run `bun upgrade --canary`, or wait for 1.4.4 to reach stable.")
  process.exit(1)
}

// Use the exact Bun binary running this script, not whatever `bun` is on PATH.
const result = Bun.spawnSync([process.execPath, "lint", "--no-script", "--max-warnings=0", "src", "scripts"], {
  stdio: ["inherit", "inherit", "inherit"],
})
process.exit(result.exitCode ?? 1)
