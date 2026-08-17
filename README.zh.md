# my-dsh-plugins

[English](README.md) | 中文

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）插件集合。

`plugins/` 下每个目录都是一个**自包含、可独立安装的插件发行版**——有自己的包、自己的 bundle，插件之间零耦合。零上游代码改动；一切通过 dsh 扩展点接入（Typert Remote 服务、插槽注册、profile bundle）。

## 插件

| 插件 | 功能 |
|---|---|
| [`web-files`](plugins/web-files/) | Web 客户端会话视图中的"文件" tab：工作区文件树 + 只读查看器（markdown 预览走平台渲染器），后端是带沙箱边界的 Host Remote 服务 |
| [`session-notify`](plugins/dsh-session-notify/) | Web 客户端"会话完成提示音"：输入框工具行铃铛（或 `!notify` 消息前缀）arm 后，该轮执行完成时播放提示音乐；提示音可在 GUI 自定义（系统音效/自定义文件/音量，热生效） |

![web-files](plugins/web-files/docs/screenshots/overview.png)

## 安装

每个插件一条命令——bundle 已把实现包声明为依赖，且构建产物已入库，
无需本地 clone 与构建：

```sh
dsh plugin --profile web add "github:jhonden/my-dsh-plugins#main&path:plugins/<name>/bundle/<name>"
```

两步一次性准备：

1. pnpm v11 默认禁止 git 来源的子依赖——在 profile 的
   `pnpm-workspace.yaml`（首次 `dsh plugin` 时生成）里放行一次：

   ```yaml
   blockExoticSubdeps: false
   ```

2. 网络对 codeload.github.com 较慢时，放宽一次 pnpm 拉取超时：

   ```sh
   pnpm config set fetch-timeout 600000 --location=global
   ```

`web-files` 的现成命令见其 [README](plugins/web-files/README.zh.md#安装)。

### 本地检出安装（插件开发）

```sh
pnpm install && pnpm build
dsh plugin --profile web add link:$(pwd)/plugins/<name>/bundle/<name> \
                                link:$(pwd)/plugins/<name>/packages/<pkg-a>
```

修改源码后，构建并将 `lib/` 与变更一起提交——GitHub 直装用的是仓库树里的产物。

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
