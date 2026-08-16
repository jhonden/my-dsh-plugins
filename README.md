# my-dsh-plugins

English | [中文](README.zh.md)

Plugin collection for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh).

Each directory under `plugins/` is one **self-contained, independently installable plugin distribution** — its own packages, its own bundle, no cross-plugin coupling. Zero upstream code changes; everything attaches through dsh extension points (Typert Remote services, slot registrations, profile bundles).

## Plugins

| Plugin | What it adds |
|---|---|
| [`web-files`](plugins/web-files/) | A "Files" tab in the Web client's conversation view: a workspace file tree with a read-only viewer (markdown preview via the platform renderer) backed by a sandboxed Host Remote service |

![web-files](plugins/web-files/docs/screenshots/overview.png)

## Install

From a checkout of this repository, into a dsh profile (e.g. `web`):

```sh
dsh plugin --profile web add ./plugins/<name>/bundle/<name>
dsh plugin --profile web add ./plugins/<name>/packages/<pkg-a> ./plugins/<name>/packages/<pkg-b>
```

See each plugin's README for its exact package list.

## Repository layout

```
plugins/<name>/          one plugin distribution
  packages/...           the plugin's npm packages (Host half, Client half, ...)
  bundle/<name>/         the installable profile bundle (cordis.patch.yml)
  docs/                  design notes
tsconfig.json            root solution: references every package
pnpm-workspace.yaml      plugins/*/packages/* + plugins/*/bundle/*
```

## Development

```sh
pnpm install
pnpm build        # tsc project references + client browser bundles (tsdown)
pnpm test         # vitest across all plugins
```

Typert Remote descriptors (`lib/typert.*.js`) are committed: regenerating them requires the upstream generator, so consumers never do.

## Compatibility

dsh is a developer preview (`0.1.0-rc`); these plugins pin the upstream packages they were built against and follow upstream releases deliberately.
