# web-files

A read-only workspace file explorer for the dsh Web client. Adds a **Files** tab beside Chat and Trajectory in the conversation view: a lazily-expanding file tree on the left, a read-only viewer on the right (markdown preview through the platform `MarkdownText` renderer, source toggle, plain text otherwise).

- **Host half** (`packages/files-remote`): `filesRemote/list` / `filesRemote/read` Typert Remote methods over `ctx.fs`, canonically confined to the calling session's cwd (symlink escapes rejected), with entry and byte bounds.
- **Client half** (`packages/ui-files`): one `conversation.view` slot registration (`id: 'files'`, order 20); data fetched directly from the gateway-claimed `/api/filesRemote/*` endpoints.
- **Bundle** (`bundle/web-files`): the installable profile patch layer.

See [docs/design.md](docs/design.md) for the full design (problem, wire contract, security boundary, alternatives considered).

## Install

```sh
dsh plugin --profile web add ./bundle/web-files
dsh plugin --profile web add ./packages/files-remote ./packages/ui-files
```

Then restart the profile; the tab appears in every session header.

## Build & test

From the repository root (`pnpm build && pnpm test`), or locally:

```sh
cd packages/ui-files && npx tsdown   # rebuild the browser bundle
pnpm vitest run                      # unit tests (containment, bounds, HMR)
```

After editing `packages/files-remote`, regenerate the Typert descriptors with the upstream generator (see the repository README) — they are published artifacts.
