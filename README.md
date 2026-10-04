# jenkui

A terminal UI for Jenkins: browse organizations → projects → builds → stage view,
stream console output, trigger builds, and abort running ones.

Requires [Bun](https://bun.sh/) 1.3.0 or later.

## Setup

```bash
bun install
```

Create the config directory and add your Jenkins profiles:

```bash
mkdir -p ~/.config/jenkui
cp config.example.json ~/.config/jenkui/config.json
```

`config.json`:

```json
{
  "defaultProfile": "dev",
  "profiles": {
    "dev":  { "url": "https://jenkins-dev.example.com", "user": "your_user", "token": "your_api_token" },
    "prod": { "url": "https://jenkins-prod.example.com:8080", "user": "your_user", "token": "your_api_token" }
  },
  "pollIntervalMs": 2000,
  "autoRefreshMs": 5000,
  "pageSize": 100
}
```

- `pollIntervalMs` — live console/stage update interval for a running build.
- `autoRefreshMs` — background refresh of the list and queue.
- `pageSize` — builds fetched per page (pagination grows as you scroll).

If `profiles` is absent, a single top-level `"jenkins"` object is used as one
profile. Switch profiles at runtime with `p`; the active one shows as a colored
badge in the header.

Grab an API token from Jenkins: **User → Configure → API Token**.

`JENKINS_URL` / `JENKINS_USER` / `JENKINS_TOKEN` environment variables override the
config file when set (handy for CI). If credentials are missing or invalid, the
app shows the error instead of data.

Writing to Jenkins (trigger/abort) needs an account allowed to build the jobs.

## Themes

Colors follow a named preset, with optional per-color overrides, in
`~/.config/jenkui/theme.json`:

```json
{ "theme": "tokyonight" }
```

```json
{ "theme": "tokyonight", "colors": { "accent": "#FF00FF" } }
```

Presets: `ajsdb` (default), `tokyonight`, `catppuccin`, `dracula`, `gruvbox`,
`nord`, `one-dark`, `rosepine`. See `theme.example.json`.

Give each profile its own badge color (shown in the header); text color is
picked automatically for contrast:

```json
{
  "theme": "tokyonight",
  "profile": { "dev": "#2E7D32", "prod": "#B71C1C" }
}
```

Config and theme are read once at startup, so restart the app after editing.

## Run

```bash
bun dev          # watch mode
bun start        # run once
bun test         # unit tests
bun run typecheck
```

## Keys

| Key | Action |
| --- | --- |
| `j` / `k` `↓` / `↑` | move selection |
| `h` / `←` | back one level |
| `l` / `→` | open the selected item |
| `enter` | open the selected item |
| `/` | search (fuzzy; per-level, kept when you return). In stage view it highlights log lines |
| `esc` | back / leave search / close dialog |
| `f` | cycle status filter (all → failed → running → success) |
| `b` | start a new build of the selected job (confirm dialog) |
| `x` | abort the running build (confirm dialog) |
| `o` | open the console/job in the browser |
| `y` | copy the build/job link to the clipboard |
| `.` | view the build queue |
| `p` | switch Jenkins profile |
| `A` | toggle auto-refresh |
| `r` | refresh now |
| `?` | keyboard shortcuts |
| `` ` `` | toggle the debug console overlay |
| `q` | quit |

## Layout

```
src/
  index.tsx            bootstrap: renderer + React root + debug console
  app.tsx              root: wiring, data loading, keyboard dispatch
  state/
    store.ts           AppState + reducer
    keymap.ts          pure key -> action mapping
    views.ts           per-view header meta + breadcrumb
  config/
    index.ts           reads ~/.config/jenkui/{config,theme}.json + profiles
    themes.ts          named color presets
    theme.ts           colors/statusColor facade
  api/jenkins.ts       Jenkins client (read + trigger/stop)
  hooks/               data loading, selection resolution
  components/          header, search bar, list, placeholder, dialogs
  screens/             org, project, deploy, run (stage view)
  utils/               pure helpers (format, log, search, spinner, stages, host, contrast)
  types.ts             domain types
```

The Jenkins hierarchy maps like this: Jenkins **views** become organizations
(`POLARIS`, `ALCOR`, ...), each job inside a view is a project (folders are
expanded one level and tagged on the row), and each build is a deployment. Jobs
not listed by any view are grouped under `other`, so nothing silently disappears.

Console output is streamed with Jenkins' `progressiveText` endpoint; stage
duration/status refresh live while a build runs, and masked-credential markers
(`ha:////…`) are filtered out.
