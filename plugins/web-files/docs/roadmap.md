# web-files Roadmap

Status: planning · Last reviewed: 2026-08-16 · Owner: @jhonden

Feature plan for the workspace file explorer, graded by feasibility against
verified upstream facts (dsh `0.1.0-rc` era). Re-verify the "blocked" grades
against each upstream release — this file records the plan, not a promise.

## Priorities at a glance

| Tier | Theme | Why this order |
|---|---|---|
| v0.2 | Viewing quality | All green-tier: platform components already exported, small diffs |
| v0.3 | Search & navigation | Green/medium: rg import path verified, pure-client state |
| v0.4 | Agent coupling | The differentiator — needs one self-built push channel |
| v1.0 | Upstream proposals | Unblock red-tier items by fixing seams upstream |

## v0.2 — Viewing quality (green tier)

- [x] **Code syntax highlighting** — reuse platform `CodeBlock` / `ReadBlock`
      (index-exported from `@deepseek-ai/dsh-client-ui-primitives`, shiki with
      lazy grammars). Map file extension → language id Host-side
      (`langFromPath` reachable via `dsh-tool-fs/src/*` subpath, or local copy).
- [ ] **Diff/patch rendering** — platform `DiffBlock` + `DiffHunk`
      (index-exported) render arbitrary before/after; add a minimal unified
      `.diff`/`.patch` parser for on-disk diff files.
- [x] **Filename filter box** — pure client; filters loaded tree levels by
      case-insensitive substring, keeps directories (matches may live deeper),
      force-expands during filtering, highlights match ranges, and states its
      loaded-only scope. Will grow into the v0.3 full search entry.
- [ ] **Large-file paging** — Host `filesRemote/read` gains optional
      `offset`/`limit`; viewer loads next chunk on scroll-end. Keeps the
      512 KiB cap as the per-response bound.

## v0.3 — Search & navigation

- [x] **Filename search (rg, recursive)** — shipped ahead of plan: the filter
      box now debounce-searches the whole workspace through a new
      `filesRemote/search` Remote method (`runRipgrep --files --glob=**q*`,
      packaged rg, workspace = the rg workdir) and renders a flat
      full-path result list with match highlighting; the loaded-tree filter
      remains as the pre-response view. Files only (rg --files lists no
      directories); 200-path cap.
- [ ] **Full-text search (rg)** — content grep through the same channel;
      results grouped by file with line numbers, click → open + scroll to
      line.
- [ ] **Viewer tabs** — multiple open files with a tab strip; per-tab
      preview/source state.
- [ ] **Tree state persistence** — remember expanded dirs per workspace
      (session-store or localStorage keyed by cwd).

## v0.4 — Agent coupling (the differentiator)

- [ ] **Self-built push channel** — Host plugin registers an SSE route via
      `ctx.webServer.register()` (public API; precedent: `/api` and `/plugins`
      routes). Client subscribes; reconnect with backoff.
- [ ] **Live refresh on agent writes** — Host listens to `fs/observed`
      (emitted by every tool read/write; free on the Host side) and pushes
      {path, kind}; the tree re-lists dirty dirs, the viewer reloads the open
      file when its path fires.
- [ ] **Recent-change highlight** — same event source; tree badges files the
      agent wrote this session, fading with time.
- [x] **Image preview** — shipped early (v0.2) for markdown relative images:
      Host prefix route `/plugins-web-files/preview` (same-origin fence,
      extension allowlist, workspace confinement, 8 MiB cap via
      `FileSystem.readBytes`); the client rewrites relative image refs to the
      route before rendering. Standalone image-file viewing can reuse the
      same route.

## v1.0 — Upstream proposals (unblocks red tier)

Two small upstream changes would retire self-built machinery and unlock the
rest; propose once this plugin has users:

1. `API_REMOTE_FORWARDED_EVENTS` (packages/api/remotes/src/remote-events.ts)
   gains `fs/observed` (requires a JSON-safe actor payload) → SSE route
   retires.
2. An override seam on `openFile` (currently hardcoded to
   `workspaces.openPath` in ui-conversation apply.ts) → clicking file paths in
   chat/diff cards opens in-app.

Explicitly deferred (no plan):

- **Editing** — human/agent concurrent-write conflict is its own design
  problem (who wins against an in-flight diff card?).
- **Git panel** — upstream has zero git capability; a full status/diff panel
  via `ctx.subprocess` git is a separate plugin-sized effort if ever wanted.
- **External-edit awareness** — no upstream FSWatcher exists; chokidar would
  cover local-only and duplicate v0.4's channel for a narrower case.

## Verified facts behind the tiers (2026-08-16)

- Platform index exports: `CodeBlock`, `ReadBlock`, `DiffBlock`, `DiffHunk`,
  `MarkdownText` (ui-primitives src/index.ts).
- Not index-exported but reachable via declared `./src/*` subpaths:
  highlight helpers, `computeHunkDiffs`, `langFromPath`, fs-search
  presentation helpers.
- `runRipgrep(ctx, exec, …)` consumes only `exec.signal` and
  `exec.agent?.session.header.cwd`.
- `fs/observed` fires from tool calls only (read/write/edit targets), not
  from external filesystem activity.
- Browser push channels: forwarded-event allowlist is a hardcoded upstream
  array (edit required); `session/projection` is log-scoped;
  `webServer.register()` is public and SSE-capable.
- `openFile` chain: ui-conversation apply.ts → `workspaces.openPath` →
  Host `openNativePath` (OS opener); no override point.
- `sessions.attachment` rejects ids not referenced by the session log
  (`ATTACHMENT_NOT_REFERENCED`).
