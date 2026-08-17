# dsh-session-notify

Adds per-session completion alerts to the
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) Web
client: **you decide which task reminds you** — arm a session with the bell and
dsh plays a sound on your machine when that session's run finishes.

Two triggers share the same armed state:

| Trigger | How | Best for |
|---|---|---|
| 🔔 input bell | Click the bell in the composer tool row (right of the access-mode control); the current/next run's completion plays the sound, then the bell resets (one-shot) | Web GUI, most discoverable |
| `!notify` message prefix | Start a message with `!notify` (or `🔔`); the session is armed and the marker is stripped before reaching the model | Any input path (CLI/headless included) |

Default behavior (`mode: one-shot`): clicking the bell while the session is
running alerts at the end of that run; while idle, at the end of the next run.
After one alert the bell auto-resets; click again anytime to cancel.

## Install

One command — the bundle declares both implementation packages as dependencies:

```sh
dsh plugin --profile web add "github:jhonden/my-dsh-plugins#main&path:plugins/dsh-session-notify/bundle/session-notify"
```

pnpm v11 blocks git-sourced sub-dependencies by default; allow it once in the
profile's `pnpm-workspace.yaml` (generated on first `dsh plugin`):

```yaml
blockExoticSubdeps: false
```

Then run `dsh web` — a bell appears in the composer tool row (right of the access-mode control).

> The GitHub install path resolves once this plugin is pushed to the repo's
> main branch. Until then, use the local-checkout install below.

### Local checkout install (plugin development)

```sh
pnpm install && pnpm build

dsh plugin --profile web add link:$(pwd)/plugins/dsh-session-notify/bundle/session-notify \
                                link:$(pwd)/plugins/dsh-session-notify/packages/session-notify \
                                link:$(pwd)/plugins/dsh-session-notify/packages/ui-notify
```

After editing sources, rebuild and commit `lib/` together with the change —
GitHub installs use the committed artifacts.

## Usage

1. Open a session (tab).
2. Click the 🔔 bell in the composer tool row (right of the access-mode control):
   - Outline → filled: armed; the current/next run's completion plays the sound.
   - Armed while running: a small orange dot appears on the bell.
   - Click again: cancel.
3. The caret beside the bell opens the "Sound settings" panel:
   - pick a macOS system sound or type an absolute path to a custom audio file;
   - drag the volume slider (0–100%); "Preview" plays the current choice.
   Changes take effect immediately and are written to the `session-notify`
   section of `$DSH_HOME/settings.yaml` — the same form appears on the
   Settings page.
4. Or start a message with `!notify 帮我……` — the model only sees "帮我……".

## Configuration

### User settings (recommended, no restart)

The sound, volume, and mode are user settings written to the `session-notify`
section of `$DSH_HOME/settings.yaml`, **hot-reloaded** (saving the file
applies immediately). Two equivalent ways to edit them:

- the bell's caret → "Sound settings" panel in the composer tool row (read/write
  through Host Remotes, so it works from a LAN IP too — dsh's browser settings
  transport only accepts loopback clients);
- the auto-rendered `session-notify` form on the Settings page (loopback access).

```yaml
# $DSH_HOME/settings.yaml
session-notify:
  sound: Sosumi          # named system sound or absolute audio file path (default Glass)
  volume: 0.8            # volume 0..1 (default 1)
  mode: sticky           # one-shot | sticky (default one-shot)
```

### Plugin config (default layer, optional)

Overriding the `session-notify` row's config in `cordis.patch.yml` sets the
composition defaults; user settings win over them:

```yaml
- insert:
    - id: session-notify
      name: '@gaowen/dsh-session-notify'
      config:
        sound: Sosumi      # named system sound or absolute path (default Glass)
        mode: sticky       # one-shot | sticky (default one-shot)
        volume: 0.8        # afplay volume 0..1, macOS only
```

- `sound`: on macOS either a system sound name (table below) or an absolute
  audio file path; on Linux/Windows an absolute path is required (played via
  `paplay`/PowerShell).
- `mode`: `one-shot` plays once then auto-resets; `sticky` stays armed and
  alerts on every completed run until disarmed.

macOS system sounds: Basso, Blow, Bottle, Frog, Funk, Glass, Hero, Morse, Ping,
Pop, Purr, Sosumi, Submarine, Tink (default Glass).

## State and edge cases

- Armed state persists at `$DSH_HOME/plugins/dsh-session-notify/armed.json`
  (atomic, debounced) and survives dsh restarts.
- Disposed sessions are cleaned up and never alert.
- Playback failures (missing `afplay`/`paplay`/…) log a single warning and
  never disturb the agent run.
- The sound plays from the dsh host process: you hear it when dsh runs on your
  machine; over SSH it would play on the remote host — prefer browser
  notifications there, or disarm the bell.
- Full design notes: [docs/design.md](docs/design.md).

## Repository layout

```
plugins/dsh-session-notify/
  packages/session-notify/   Host package: sessionNotify Remote service + completion detection + player
  packages/ui-notify/        Client package: header bell
  bundle/session-notify/     Installable profile bundle (cordis.patch.yml)
  docs/design.md             Design notes
```

## Compatibility

Targets dsh 0.1.0-rc series (`@deepseek-ai/*` pinned at `0.1.0-rc.6`), upgraded
cautiously with upstream releases.