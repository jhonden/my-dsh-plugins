# dsh-session-notify 设计笔记

## 目标

让用户可以为"某一次 dsh 会话的某一次执行"挂上提示音：该轮执行（agent 从
`running` 回到 `idle`）完成时，在用户机器上播放提示音乐。**由用户决定哪次
任务要提醒、如何触发**，而不是全局一刀切。

## 触发方式（用户如何控制）

### 主入口：会话标题栏铃铛（Web GUI）

- 复用插槽 `conversation.input.left`（kind: list，session 作用域）——composer
  工具行左端、权限模式等 resident chrome 之后——放一个紧凑的铃铛按钮组
  （铃铛 + 试听箭头），离输入框最近、所见即所提醒。
- 语义（默认 `one-shot`）：点击即 armed；若会话正在运行，当前这轮结束时响；
  若空闲，下一轮结束时响；响完自动复位。再点一次立即取消。
- armed 且正在运行：铃铛显示橙色小圆点；响铃后客户端通过观察
  `useSession` 快照的 `running` 翻转重新拉取状态，让铃铛自动熄灭。
- 试听：铃铛旁箭头 →「试听提示音」，调 `preview` Remote 立即播放当前配置音效。

为什么不用消息里的关键词/斜杠命令作为唯一入口：GUI 里一个可见、可点、有状态的
按钮比记一个标记更符合"哪个任务要提醒"的心智；但 CLI/无头/键盘流没有按钮，所以
保留消息标记作为副入口。

### 副入口：`!notify` 消息前缀

- 用户消息以 `!notify`（或 `🔔`）开头 → 该会话被 armed，且标记在进入 step 前
  从消息中剥离（模型看不到）。剥离逻辑是纯函数（`marker.ts`），只处理
  `source.kind === 'user'` 的消息，不动插件注入的上下文。
- 实现点：`agent/pre-step` waterfall——先 `await next()` 得到默认决策，若为
  `enter` 且存在标记，则返回替换后的消息并 arm。剥离后为空的消息保留原文
  （模型不能收到空消息），但仍 arm。
- 标记规则：必须是文本开头（可带前导空白）的独立 token，后随空白或行尾；
  `!notifyX`、句中 `!notify` 不触发。

## 完成判定：`agent/status` running → idle

- `turn/end` 只覆盖单个 turn；goal 轮次的一次 run 会驱动多个 turn，若按
  turn/end 提醒会过响。`agent/status` 的 `idle` 表示整个 driver 无活动，是
  一次 run 的真正完成点。
- 状态机（host 内）：`busy` 集合记录正在运行的会话；armed 会话在
  `idle`（且此前 `running`）时触发播放；one-shot 模式随即清除 armed 并落盘。
- 边界：armed 时正在运行 → 当前轮结束即响；空闲会话的直接 `idle` 事件不响；
  `session/disposed` 清理状态不播放。

## 提示音用户自定义（settings 命名空间）

- 新增 `session-notify` settings 命名空间（schemastery schema）：`sound`、
  `volume`（`z.percent()` 渲染为滑杆）、`mode`。经
  `installSettingsSection` 接线：cordis config 作为组合 base 层，用户层写
  `$DSH_HOME/settings.yaml`，**热生效**（保存即应用，无需重启）。
- 服务持有 `settingsSource` thunk（settings 挂载时指向 scope，否则回退
  entry），`onChange` 刷新 `sound/volume/mode`——播放与完成检测始终读当前值。
- 铃铛面板（client）经 `sessionNotify/getPrefs|setPrefs` Remote 读写同一份
  设置——**不依赖浏览器 settings 传输**，因为 dsh 的 settings RPC 仅接受回环
  客户端，局域网（LAN IP）访问时浏览器写会被静默丢弃（memory 模式）。Host 在
  进程内调用 `ctx.settings.mutate` 写入，绕过该限制；无 settings 服务时回退
  内存应用。系统音效列表由 `sessionNotify/listSounds` Remote 提供
  （macOS 14 种内置音效名）。
- 侧栏 Settings 页自动渲染该命名空间表单，两处共享同一配置。

## 播放器（host 进程）

- fire-and-forget `spawn`，`stdio: ignore`；失败只 `warn` 一次，绝不抛错。
- 平台分派：darwin `afplay`（支持 `-v` 音量）；linux `paplay` 回退 `aplay`；
  win32 PowerShell `Media.SoundPlayer`。无可用播放器时记警告。
- 单飞行槽：同一时刻最多一个播放子进程，新触发替换旧的（最后一次完成优先），
  避免并发叠音。
- 默认音效：macOS 系统 `Glass.aiff`；`sound` 可配命名音效或绝对路径。

## 状态持久化

- armed 状态存 `$DSH_HOME/plugins/dsh-session-notify/armed.json`（`Record<SessionId, boolean>`），
  经 `dsh-atomic-write` 原子写入、防抖 250ms；启动时异步加载，读取路径
  （`getState`）先 `await ready` 保证确定性。
- 已知边界：上一个进程遗留、本进程不再复活的会话 id 的 armed 条目是惰性的
  （永不触发）；若新会话复用了旧 id（重启后计数器重置），会继承该 armed 状态，
  属于可接受的小概率行为——点一下即可取消，文档已注明。

## 架构

三层结构，完全复用仓库 `web-files` 的模式，零上游代码改动：

```
Web 客户端 ui-notify（铃铛）
   │  fetch /api/sessionNotify/{getState,setArmed,preview}（Typert Remote）
   ▼
Host 包 session-notify（SessionNotifyService）
   │  监听 agent/status、session/disposed、agent/pre-step
   ▼
系统播放器（afplay / paplay / PowerShell）+ armed.json
```

- Host：`SessionNotifyService extends TypertRemoteService`，`static Config`
  为 zod schema（构造时 parse 一次，缺省安全）。`@Remote` 方法首参为自动按
  `sessionId` 解析的 `Session`。
- Client：铃铛组件 + fetch 载体（rpcId 信封，与生成客户端同协议），无生成产物。
- Bundle：`cordis.patch.yml` 插入 host 与 client 两行；typert manifest
  （`lib/typert.host.js`）手写并随包提交，loader 通过 `./typert` export 自动
  发现、`validateTypertManifest` 校验；若手写格式暴露问题，gateway 仍可用
  SRC-marker 兜底分派。

## 测试

- host（真实 Cordis Context + 假播放器/临时状态文件）：arm/disarm 往返、
  落盘恢复、one-shot 复位 / sticky 保留、未 armed 不响、空闲不响、
  disposed 清理、armed 中途运行即响、pre-step 标记剥离/emoji/不动注入/全空保留/
  reject 透传、纯函数单测、音效路径解析。
- client：中英字典一致性 + 命名空间声明。

## 兼容性假设

- dsh host 与用户同机（localhost），host 侧播放即用户听到；SSH 远程场景不在
  本期（README 注明，建议改用浏览器通知）。
- 默认平台 macOS（`afplay` + 系统音效）；Linux/Windows 仅保底实现，需配置绝对路径。
- 面向 dsh 0.1.0-rc.6（`@deepseek-ai/*` 固定版本）。