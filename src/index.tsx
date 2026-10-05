#!/usr/bin/env bun
import { createRoot } from "@opentui/react"
import { ConsolePosition, createCliRenderer } from "@opentui/core"
import { App } from "./app"
import { ThemeProvider } from "./config/theme"
import { config, setActiveProfile } from "./config"
import { parseArgs, USAGE } from "./cli"
import pkg from "../package.json"

const VERSION = pkg.version

function listProfiles(): void {
  const names = Object.keys(config.profiles)
  if (names.length === 0) {
    console.log("No profiles configured. Create ~/.config/jenkui/config.json.")
    return
  }
  console.log("Configured profiles:")
  for (const name of names) {
    const profile = config.profiles[name]!
    const mark = name === config.defaultProfile ? " (default)" : ""
    console.log(`  ${name}${mark}  ${profile.url}`)
  }
}

const command = parseArgs(process.argv.slice(2))

switch (command.kind) {
  case "help":
    console.log(USAGE)
    process.exit(0)
  case "version":
    console.log(`jenkui ${VERSION}`)
    process.exit(0)
  case "listProfiles":
    listProfiles()
    process.exit(0)
  case "error":
    console.error(`jenkui: ${command.message}`)
    console.error()
    console.error(USAGE)
    process.exit(1)
}

if (!process.stdout.isTTY) {
  console.error("jenkui needs an interactive terminal.")
  process.exit(1)
}

if (command.profile) setActiveProfile(command.profile)

const renderer = await createCliRenderer({
  // Console overlay captures console.* and draws it above the UI. Nothing is
  // shown until toggled; handy for debugging profile/data flow.
  consoleOptions: {
    position: ConsolePosition.BOTTOM,
    sizePercent: 35,
    startInDebugMode: true,
  },
})

// Backtick toggles the debug console overlay. Set OTUI_USE_CONSOLE=false to
// disable the capture entirely.
renderer.keyInput.on("keypress", (key) => {
  if (key.name === "`") renderer.console.toggle()
})

createRoot(renderer).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
)
