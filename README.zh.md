# my-dsh-plugins

[English](README.md) | 中文

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）插件集合。

`plugins/` 下每个目录都是一个**自包含、可独立安装的插件发行版**——有自己的包、自己的 bundle，插件之间零耦合。零上游代码改动；一切通过 dsh 扩展点接入（Typert Remote 服务、插槽注册、profile bundle）。

## 插件

| 插件 | 功能 |
|---|---|
| [`web-files`](plugins/web-files/) | Web 客户端会话视图中的"文件" tab：工作区文件树 + 只读查看器（markdown 预览走平台渲染器），后端是带沙箱边界的 Host Remote 服务 |

![web-files](plugins/web-files/docs/screenshots/overview.png)

## 安装

在本仓库检出后，安装进某个 dsh profile（如 `web`）：

```sh
dsh plugin --profile web add ./plugins/<name>/bundle/<name>
dsh plugin --profile web add ./plugins/<name>/packages/<pkg-a> ./plugins/<name>/packages/<pkg-b>
```

每个插件的具体包清单见其 README。

## 仓库结构

```
plugins/<name>/          一个插件发行版
  packages/...           该插件的 npm 包（Host 半边、Client 半边……）
  bundle/<name>/         可安装的 profile bundle（cordis.patch.yml）
  docs/                  设计笔记与截图
tsconfig.json            根 solution：引用所有包
pnpm-workspace.yaml      plugins/*/packages/* + plugins/*/bundle/*
```

## 开发

```sh
pnpm install
pnpm build        # tsc project references + 客户端浏览器 bundle（tsdown）
pnpm test         # 全插件 vitest
```

Typert Remote 描述符（`lib/typert.*.js`）已入库：重新生成需要上游生成器，使用者无需执行。

## 兼容性

dsh 处于开发者预览阶段（`0.1.0-rc`）；本集合的插件固定构建时所依赖的上游包版本，跟随上游发布节奏审慎升级。
