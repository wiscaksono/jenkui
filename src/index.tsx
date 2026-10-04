#!/usr/bin/env bun
import { createRoot } from "@opentui/react"
import { ConsolePosition, createCliRenderer } from "@opentui/core"
import { App } from "./app"

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

createRoot(renderer).render(<App />)
