# jenkui

A terminal UI for Jenkins. Browse views, jobs, and builds; watch a build's console
output and stage timeline live; trigger a new build or abort a running one.

Needs [Bun](https://bun.sh) 1.3.0 or later on your PATH. The package runs its
TypeScript source directly, so Bun is also its runtime.

## Install

```bash
npm install -g jenkui
# or
bun install -g jenkui
```

Then run it:

```bash
jenkui
```

On first run there is no config, so the header shows a credentials error. Create
the config file next.

### Point it at Jenkins

Make a config directory and copy the example:

```bash
mkdir -p ~/.config/jenkui
cp "$(npm root -g)/jenkui/config.example.json" ~/.config/jenkui/config.json
```

Or write `~/.config/jenkui/config.json` yourself. One profile is enough to start:

```json
{
  "profiles": {
    "default": {
      "url": "https://jenkins.example.com",
      "user": "your_user",
      "token": "your_api_token"
    }
  }
}
```

Add more profiles when you have a second server. `defaultProfile` picks which one
loads first, and `p` switches at runtime:

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

| Option | Meaning |
| --- | --- |
| `pollIntervalMs` | How often the console and stage view update while a build runs |
| `autoRefreshMs` | How often the list and queue refresh in the background |
| `pageSize` | Builds fetched per page; more load as you scroll |

Get an API token from Jenkins under **User → Configure → API Token**.

If you leave out `profiles`, a single top-level `"jenkins"` object still works as
one profile. `JENKINS_URL`, `JENKINS_USER`, and `JENKINS_TOKEN` override the file
when set. Triggering and aborting builds needs an account that can build the jobs.

### Colors

Pick a named theme and override any color in `~/.config/jenkui/theme.json`:

```json
{ "theme": "tokyonight" }
```

```json
{ "theme": "tokyonight", "colors": { "accent": "#FF00FF" } }
```

Themes included: `ajsdb` (default), `tokyonight`, `catppuccin`, `dracula`,
`gruvbox`, `nord`, `one-dark`, `rosepine`. See `theme.example.json`.

Each profile can carry its own badge color for the header. jenkui picks the text
color from the badge background so it stays readable:

```json
{
  "theme": "tokyonight",
  "profile": { "dev": "#2E7D32", "prod": "#B71C1C" }
}
```

The config and theme load once at startup. Restart jenkui after editing them.

## Keys

| Key | Action |
| --- | --- |
| `j` `k` `↓` `↑` | move the selection |
| `h` `←` | go back one level |
| `l` `→` | open the selected item |
| `enter` | open the selected item |
| `/` | search (fuzzy, per level, kept when you return); in the stage view it highlights log lines |
| `esc` | back, leave search, or close a dialog |
| `f` | cycle the status filter: all, failed, running, success |
| `b` | start a new build of the selected job (asks to confirm) |
| `x` | abort the running build (asks to confirm) |
| `o` | open the console or job in your browser |
| `y` | copy the build or job link |
| `.` | view the build queue |
| `p` | switch Jenkins profile |
| `A` | toggle auto-refresh |
| `r` | refresh now |
| `?` | show all shortcuts |
| `` ` `` | toggle the debug console overlay |
| `q` | quit |

## How it maps to Jenkins

Jenkins **views** become organizations (`POLARIS`, `ALCOR`, …). Each job in a view
is a project; folders are expanded one level and the folder name shows on the row.
Each build is a deployment. Jobs that no view lists go under `other`.

The console streams through Jenkins' `progressiveText` endpoint. Stage durations
and status refresh while a build runs, and Jenkins' masked-credential markers
(`ha:////…`) are filtered out of the output.

## Development

```bash
bun install
bun dev          # watch mode
bun start        # run once
bun test         # unit tests
bun run typecheck
```

`src/` layout:

```
index.tsx            bootstrap: renderer, React root, debug console
app.tsx              wiring, data loading, keyboard dispatch
state/               AppState + reducer, keymap, per-view meta
config/              reads ~/.config/jenkui/{config,theme}.json, themes
api/jenkins.ts       Jenkins client (read, trigger, stop)
hooks/               data loading, selection resolution
components/          header, search bar, list, dialogs
screens/             org, project, deploy, run (stage view)
utils/               format, log, search, spinner, stages, host, contrast
types.ts             domain types
```

## CI

`.github/workflows/ci.yml` runs typecheck, tests, and a bundle smoke build on
every push to `main` and every pull request.

`.github/workflows/release.yml` publishes to npm when you push a `v*` tag. It
needs an `NPM_TOKEN` repository secret with publish access, and uses npm
provenance (OIDC) so the release links back to the workflow run.

```bash
git tag v0.1.1 && git push origin v0.1.1
```

## Troubleshooting

**`error: Missing Jenkins credentials`**: the config file is missing or the
`user`/`token` fields are empty. Check `~/.config/jenkui/config.json`.

**`Jenkins 401`**: wrong user or token. Generate a fresh token under
**User → Configure → API Token**.

**`Jenkins 403`**: the account can read jobs but not build them. Triggering and
aborting need the build permission for those jobs.

**Config changes do nothing**: the file is read at startup. Restart jenkui.

**Nothing renders**: make sure the terminal is a real TTY and Bun 1.3.0+ is on
your PATH (`bun --version`).
