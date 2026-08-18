# dsh-session-notify

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）Web
客户端添加"会话完成提示音"：**由你决定哪一次任务要提醒**——给某个会话挂上铃铛，
它本轮执行完成后，dsh 会在你机器上播放提示音乐提醒你。

两个触发入口，共用同一份 armed 状态：

| 入口 | 怎么用 | 适用 |
|---|---|---|
| 🔔 输入框铃铛 | 点击输入框底部工具行（权限模式选择框右边）的铃铛，armed 后本轮结束即响，响完自动复位（one-shot） | Web GUI，最直观 |
| `!notify` 消息前缀 | 消息以 `!notify`（或 `🔔`）开头，该会话被 armed，标记会从消息中剥离、不进模型上下文 | 任何输入方式（含 CLI/无头） |

默认行为（`mode: one-shot`）：点击铃铛时若会话正在运行，当前这轮结束即响；
若空闲，则下一轮结束即响。响一次后铃铛自动复位，可随时再点取消。

## 安装

一条命令——bundle 已把两个实现包声明为依赖，装它即装全部：

```sh
dsh plugin --profile web add "github:jhonden/my-dsh-plugins#main&path:plugins/dsh-session-notify/bundle/session-notify"
```

pnpm v11 默认禁止 git 来源的子依赖；安装前在 profile 的
`pnpm-workspace.yaml`（首次 `dsh plugin` 时生成）里放行一次：

```yaml
blockExoticSubdeps: false
```

然后 `dsh web`——输入框底部工具行（权限模式选择框右边）出现铃铛。

> 本插件发布到仓库 main 分支后，上述 GitHub 直装路径即可解析。在此之前可使用下面的本地检出安装。

### 本地检出安装（插件开发）

```sh
pnpm install && pnpm build

dsh plugin --profile web add link:$(pwd)/plugins/dsh-session-notify/bundle/session-notify \
                                link:$(pwd)/plugins/dsh-session-notify/packages/session-notify \
                                link:$(pwd)/plugins/dsh-session-notify/packages/ui-notify
```

修改源码后，构建并将 `lib/` 与变更一起提交——GitHub 直装用的是仓库树里的产物。

## 使用

1. 打开一个会话（标签页）。
2. 点击输入框底部工具行（权限模式选择框右边）的 🔔 铃铛：
   - 空心 → 实心：已 armed，本轮（或下一轮）执行完成后响铃。
   - armed 且会话正在运行：铃铛右上角出现橙色小圆点。
   - 再点一次：取消提醒。
3. 铃铛旁的小箭头打开「提示音设置」面板：
   - 选择系统音效（macOS 内置 14 种）或输入自定义音频文件的绝对路径；
   - 拖动音量滑杆（0–100%）；点「试听」立即播放当前选择。
   - 设置即时生效并写入 `$DSH_HOME/settings.yaml`（`session-notify` 段），
     侧栏 Settings 页也会出现同一份配置表单。
4. 或者直接在消息里写 `!notify 帮我……`——模型只会看到"帮我……"。

## 配置

### 用户设置（推荐，无需重启）

提示音、音量、提醒模式是用户设置，写入 `$DSH_HOME/settings.yaml` 的
`session-notify` 段，**热生效**（文件保存即应用，无需重启）。可通过两种方式修改，
效果相同：

- 输入框铃铛旁的小箭头 →「提示音设置」面板（经 host Remote 读写，**本机 IP /
  局域网访问同样可用**——dsh 的浏览器 settings 传输仅限回环地址）；
- 侧栏 Settings 页自动渲染的 `session-notify` 表单（需回环地址访问）。

```yaml
# $DSH_HOME/settings.yaml
session-notify:
  sound: Sosumi          # 命名系统音效 或 音频文件绝对路径（默认 Glass）
  volume: 0.8            # 音量 0..1（默认 1）
  mode: sticky           # one-shot | sticky（默认 one-shot）
```

### 插件配置（默认值层，可选）

`cordis.patch.yml` 里覆盖 `session-notify` 一行的 config 作为组合默认层，
用户设置优先于它：

```yaml
- insert:
    - id: session-notify
      name: '@gaowen/dsh-session-notify'
      config:
        sound: Sosumi      # 命名系统音效 或 绝对路径（默认 Glass）
        mode: sticky       # one-shot | sticky（默认 one-shot）
        volume: 0.8        # afplay 音量 0..1，仅 macOS
```

- `sound`：macOS 上可用系统音效名（见下表）或任意音频文件绝对路径；
  Windows 上可用 `C:\Windows\Media` 内置音效名或绝对路径；Linux 上必须给
  绝对路径（`paplay`/PowerShell 播放）。
- `mode`：`one-shot` 响一次自动复位；`sticky` 保持 armed，每轮完成都响，直到手动取消。

### 平台差异

| 平台 | 内置音效 | 播放器 | 自定义上传格式 | 音量 |
|---|---|---|---|---|
| macOS | 14 种系统音效（Basso/Glass/Sosumi…，默认 Glass） | `afplay` | aiff/wav/mp3/m4a/ogg | ✅ 滑杆 |
| Windows | `C:\Windows\Media` 内置 37 种（默认 `Windows Notify System Generic`） | `SoundPlayer`(wav) + WMP COM(mp3) | wav / **mp3** | ❌ |
| Linux | 无（需配置绝对路径） | `paplay`→`aplay` | aiff/wav/mp3/m4a/ogg | ❌ |

## 状态与边界

- armed 状态持久化在 `$DSH_HOME/plugins/dsh-session-notify/armed.json`（原子写入，防抖），
  重启 dsh 后保持。
- 会话被删除时自动清理状态，不会播放。
- 播放失败（无 `afplay`/`paplay` 等）只记一条警告，绝不影响会话执行。
- 提示音由 dsh 宿主进程播放：dsh 与你在同一台机器上时你就能听到；若通过 SSH 远程运行
  dsh，音效会响在远端机器上，请改用浏览器通知或关闭提醒。
- 详细设计见 [docs/design.md](docs/design.md)。

## 仓库结构

```
plugins/dsh-session-notify/
  packages/session-notify/   Host 包：sessionNotify Remote 服务 + 完成检测 + 播放器
  packages/ui-notify/        Client 包：标题栏铃铛
  bundle/session-notify/     可安装的 profile bundle（cordis.patch.yml）
  docs/design.md             设计笔记
```

## 兼容性

面向 dsh 0.1.0-rc 系列（`@deepseek-ai/*` 固定 `0.1.0-rc.6`），随上游发布节奏审慎升级。