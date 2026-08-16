# Design: Web Files — read-only workspace file explorer for the dsh Web client

Status: draft

## Problem

The dsh Web client has no file explorer. A user working in the browser can see
what the model changed (diff cards, the deliverables row), but has no way to
browse the workspace or open an existing file. The only "open" affordance
delegates to the host OS opener, which fails outright for remote or headless
hosts.

Upstream is a developer preview (`0.1.0-rc`) with breaking changes expected,
so this capability is built as a standalone plugin distribution: zero upstream
code changes, installed through `dsh plugin --profile web add <pkg>`.

## Proposal

Three packages in one distribution:

| Package | Face | Responsibility |
| --- | --- | --- |
| `@gaowen/dsh-files-remote` | Host | `files.list` / `files.read` Remote methods over `ctx.fs`, confined to the calling session's cwd subtree |
| `@gaowen/dsh-client-ui-files` | Host + Browser | Utilities-bar toggle button, overlay drawer with the tree and read-only text viewer; mounts its own `/remote` contribution on the client |
| `@gaowen/dsh-bundle-web-files` | Distribution | `cordis.patch.yml` enabling the two plugin entries |

### Wire contract

- `files.list({ sessionId, path })` → `{ path, entries: [{ name, kind }], truncated }` — one bounded, name-sorted directory window (`maxEntries` config, default 1000). `path` is relative to the session cwd.
- `files.read({ sessionId, path })` → `{ path, bytes, truncated, content }` — UTF-8 text up to `maxReadBytes` (default 1 MiB) with an explicit `truncated` flag. Binary content is probed (NUL byte or invalid-UTF-8 ratio) and rejected with `binary-rejected`.

### Security boundary (fixed, not configurable)

- Read-only. No write, delete, or rename operation exists.
- Both methods canonicalize the resolved absolute path and require it to remain
  inside the calling session's cwd. Lexical normalization alone is
  insufficient; a `symlink` escape must be rejected (the path is canonicalized
  before the containment check, matching `dsh-sandbox-policy`'s ordering).
- List depth and entry counts are bounded; read is byte-bounded with an
  explicit truncation flag, never a silent tail drop.
- Data access goes through `ctx.fs` (the Service Definition), inheriting the
  `fs/*` event gate and any mounted observation policy; it is provider-neutral
  (local, sandbox, or E2B).

### Image preview route

`GET /plugins-web-files/preview?sessionId=…&path=…` (a `webServer` prefix
route, not `/api`): same-origin fenced (`Sec-Fetch-Site`/`Origin`), extension
allowlisted to eight exact media types (png/jpg/jpeg/gif/webp/bmp/ico/svg,
served with `nosniff`), workspace-confined through the same canonical
containment as list/read, byte-capped at 8 MiB. The client rewrites relative
markdown image destinations to absolute URLs of this route before rendering
(code spans and fences excluded), and image-extension files open directly
through it.

## Attachment to the upstream extension points (all verified read-only)

1. **Host data channel**: the package exports `./typert`; `dsh-typert-loader`
   (already in `dsh-base`) auto-discovers every enabled Loader entry's
   `./typert` export, and the Typert Gateway claims the `files/*` two-segment
   endpoints. No upstream change.
2. **Client data channel**: `ctx.remote.$mount(contribution)` is a public
   service method; the UI plugin mounts its own package's `/remote`
   contribution inside its `apply()` and unmounts it on fiber disposal. The
   upstream `api-remotes` package keeps its curated list; this plugin owns its
   own contribution. Fallback if the upstream stance hardens: a private
   `ctx.webServer.register()` HTTP route (loses validation/cancellation/types).
3. **Browser loading**: `dsh-client-modules` scans all enabled entries for
   `dsh.client` packages and adds them to the boot graph automatically.
4. **UI seats**: `conversation.session.header.utilities` (list, session scope)
   hosts the toggle button; `shell.overlay` (list, root scope) hosts the
   drawer. Both are additive multi-tenant seats — no shipped component is
   replaced. The overlay is root-scoped, so the plugin subscribes to the
   session store itself to track the current session's cwd.

## Alternatives considered

**Intercept `openFile` for in-app navigation from diff cards and file
mentions.** Rejected for v1: the click seam threads through
`ui-conversation`/`ui-tool`, which are upstream packages; interception is not
achievable without upstream changes. Recorded as a follow-up proposal once the
plugin proves out.

**Extend the `apiproxy` `host.*` RPC map** (where `host.listDirectory` lives).
Rejected: upstream states new work does not extend apiproxy; it is the legacy
fallback path.

**Occupy the `details` column.** Rejected: it is a `single` seat occupied by
`ui-conversation`'s tool-details panel; registering there would replace a
shipped component.

**Ship in the upstream repository as an Agent Note + PR.** Deferred: upstream
is a preview with free renaming rights reserved; an external plugin avoids
riding that churn. Revisit when upstream stabilizes.

**Read-only viewer with editing.** Rejected for v1: human/agent concurrent
writes to the same file (who wins between an in-flight diff card and a human
edit?), write policy, and dirty-state tracking are each separate design
questions. Read-only delivers the missing capability with none of them.

## Acceptance criteria

- `dsh plugin --profile web add <dist>` then `dsh --profile web` shows the
  files button in the session header utilities; the drawer lists the session
  workspace; opening a text file shows its content.
- A path resolving outside the session cwd (including via `symlink/..`) is
  rejected by the Host with a typed error, covered by unit tests.
- A file exceeding `maxReadBytes` returns truncated content with
  `truncated: true`; binary content returns `binary-rejected`.
- Disposing either plugin fiber removes the button/drawer and the Remote
  namespace (HMR-safety test).
- Unit tests cover every rejection branch; end-to-end is verified against the
  real web profile in the browser.

## Risks

- **`$mount` self-mount is the one gray zone.** Upstream's curated client
  list reads as a composition-owner choice; self-mounting is mechanically
  supported and interface-public, but upstream could tighten it. The HTTP
  fallback keeps the plugin alive at the cost of the typed channel.
- **Preview churn.** The `dsh.client` bundle format, slot API, or Remote
  protocol may change between release candidates; this distribution pins its
  peer dependency range and follows upstream releases deliberately.
- **Text probing is heuristic.** A UTF-16 or rare-encoding file may be
  classified binary and rejected; acceptable for a read-only viewer (the
  error is explicit, not a silent garble).
- **Large trees.** Bounded windows keep the DOM finite; virtualization is
  deferred until real usage shows a need.
