// Bun's built-in linter is still rolling out. On a build without it, `bun lint`
// resolves to this package's own "lint" script and would recurse forever, so ask
// the binary what it supports instead of guessing from the version number.
const help = Bun.spawnSync([process.execPath, "--help", "--all"], {
  stdout: "pipe",
  stderr: "pipe",
})
const supported = help.success && /^\s+lint\s/m.test(help.stdout.toString())

if (!supported) {
  console.error(`jenkui lint needs a Bun build with the built-in linter (this is ${Bun.version}).`)
  console.error("Run `bun upgrade --canary`, or wait for it to reach stable.")
  process.exit(1)
}

// Use the exact Bun binary running this script, not whatever `bun` is on PATH.
// --no-script skips the "lint" script above, which would otherwise win over the
// built-in command.
const result = Bun.spawnSync([process.execPath, "lint", "--no-script", "--max-warnings=0", "src", "scripts"], {
  stdio: ["inherit", "inherit", "inherit"],
})
process.exit(result.exitCode ?? 1)
