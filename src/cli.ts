// Argument parsing for the jenkui CLI. Pure and testable; the entry point acts
// on the result before it takes over the terminal.

export type CliCommand =
  | { kind: "run"; profile?: string }
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "listProfiles" }
  | { kind: "error"; message: string }

export const USAGE = `jenkui, a Jenkins TUI

Usage: jenkui [options]

Options:
  -h, --help              Show this help
  -v, --version           Show the version
  -p, --profile <name>    Start with this Jenkins profile
      --profile list      List configured profiles

Keys:  j/k move · enter open · / search · b build · x abort
       . queue · p profile · f filter · ? help · q quit`

export function parseArgs(argv: string[]): CliCommand {
  let profile: string | undefined

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === "-h" || arg === "--help") return { kind: "help" }
    if (arg === "-v" || arg === "--version") return { kind: "version" }
    if (arg === "-p" || arg === "--profile") {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith("-")) {
        return { kind: "error", message: `${arg} needs a profile name` }
      }
      if (value === "list") return { kind: "listProfiles" }
      profile = value
      i++
      continue
    }
    return { kind: "error", message: `unknown argument: ${arg}` }
  }

  return { kind: "run", profile }
}
