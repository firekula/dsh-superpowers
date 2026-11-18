# dsh-superpowers

[obra/superpowers](https://github.com/obra/superpowers) 的 **DeepSeek Harness
(DSH)** 适配版，打包成可直接安装的 DSH 组合包（bundle）。

选中该组合包的 profile 里，每个会话都会：

1. **注册整套 Superpowers 技能库**——14 个 `SKILL.md`，覆盖头脑风暴、写计划、
   子代理驱动开发、TDD、系统化调试、代码评审、分支收尾——作为 DSH 运行时技能
   进入技能目录，通过 `skill` 工具加载；
2. **注入会话启动引导**——把完整的 `using-superpowers` 正文注册为常驻系统提示段
   `superpowers:bootstrap`，告诉 agent 动手前先检查有没有适用技能。压缩
   （compaction）后依然有效。

> 上游：superpowers v6.3.0，commit `b36e0829`（MIT）。技能内容与上游逐字节
> 一致，仅有两处 DSH 适配，见 [UPSTREAM.md](UPSTREAM.md)。

## 安装

要求：支持 bundle 的 DSH 版本（实测 `0.2.2-rc.3`），以及桌面端或 `dsh` CLI。
本包是纯 ESM、零运行时依赖、**没有构建步骤**，因此不需要 pnpm 的
`allowBuilds` 构建授权。

### 桌面端

1. 打开侧边栏 **Plugins**；
2. 点 **Add plugin**，或箭头 → **Install a third-party plugin**；
3. 粘贴下面的 git 地址，安装并启用；
4. 新开会话（或重启应用）后按“验证是否生效”检查。

### CLI

```sh
# main 最新
dsh plugin --profile <profile> add github:firekula/dsh-superpowers

# 可复现：锁定完整 commit（共享环境推荐）
dsh plugin --profile <profile> add github:firekula/dsh-superpowers#<40位commit>
```

也支持本地目录（以 link 方式安装，便于开发）和 tarball：

```sh
dsh plugin --profile <profile> add /absolute/path/to/dsh-superpowers
dsh plugin --profile <profile> add ./dsh-superpowers-0.2.0.tgz
```

### 更新与卸载

- **更新**：按新 commit/tag 重装，或使用 Plugins 页的 **Update available**。
- **卸载**：在 **Plugins** 页关闭/移除该组合包，或执行
  `dsh plugin --profile <profile> remove dsh-superpowers`。
- 关闭后，新会话不再注册这 14 个技能、也不再注入引导段；不会影响其他插件或
  profile 配置。

## 验证是否生效

新会话中：

1. 系统提示里有 **“You have superpowers.”**；
2. 技能目录（`available_skills`）列出下表的 14 个技能；
3. 让 agent 处理一个小需求，它应先加载 `brainstorming` 再写代码；
4. 输入 `/brainstorming` 可直接显式调用该技能。

`dsh --profile <profile> --dump-config` 能看到 `# == dsh-superpowers` 层和
`superpowers` 行。

## 触发机制

- **自动**：技能注册、会话技能目录（挂载 `skill` 工具时在首次请求前下发）、
  常驻系统提示段。用户可用 `/技能名` 直接调用。
- **模型决定**：agent 是否真的按技能流程执行。DSH 只负责注入说明，不强制
  选择某个技能；弱模型或冲突指令下可能不遵守。

## 技能清单

| 技能 | 用途 |
|---|---|
| `brainstorming` | 动手前把想法打磨成设计/规格 |
| `writing-plans` | 把规格拆成 2–5 分钟粒度、可逐条执行的计划 |
| `executing-plans` | 带人工检查点的批量执行 |
| `subagent-driven-development` | 每个任务派发全新子代理 + 两阶段评审 |
| `dispatching-parallel-agents` | 相互独立的多个任务并行派发 |
| `test-driven-development` | RED-GREEN-REFACTOR 循环 |
| `systematic-debugging` | 四阶段根因定位 |
| `verification-before-completion` | 声称“完成/修好”前必须出示证据 |
| `requesting-code-review` | 派发代码评审子代理 |
| `receiving-code-review` | 严谨处理评审意见 |
| `using-git-worktrees` | 隔离工作区（DSH 下走 git worktree 回退路径） |
| `finishing-a-development-branch` | 合并/PR/保留/丢弃决策 |
| `using-superpowers` | 技能系统总纲（同时被注入系统提示） |
| `writing-skills` | 按最佳实践编写/测试新技能 |

## 配置

通过环境变量（启动 DSH 前设置，重启生效）：

| 变量 | 默认 | 说明 |
|---|---|---|
| `DSH_SUPERPOWERS_SKILL_DIR` | 包内 `skills/` | 自定义技能根目录，按 `<dir>/<name>/SKILL.md` 扫描 |
| `DSH_SUPERPOWERS_DISABLE_BOOTSTRAP` | 未设置 | 任意真值（`1`/`true`/`yes`/`on`）保留技能、关闭引导段 |

## 工作原理

`index.js` 挂载一个 Cordis 插件：

- 扫描 `skills/<name>/SKILL.md`，校验 kebab-case 名称、解析 frontmatter，把上游
  的 `superpowers:<name>` 引用改写成 DSH 的纯 kebab-case 名，再以
  `ctx.skills.register(...)` 注册（`source: 'bundled'`，目录型
  `resourceBase`）；
- 注册 `superpowers:bootstrap` 系统提示段（order 50：persona 之后、工具说明
  之前）。

组合包的 `cordis.patch.yml` 只插入一行、`name` 写本包名；DSH 从 profile 的
`node_modules` 解析，不把安装路径写进配置。

## 目录结构

```
cordis.patch.yml             组合包补丁层
package.json                 组合包 manifest（dsh.bundle.patch、exports、icon）
index.js                     插件入口（零运行时依赖）
lib/frontmatter.js           SKILL.md frontmatter 解析
lib/bootstrap.js             引导段文本
skills/                      vendored 上游技能（14 个）
adaptations/dsh-tools.md     DSH 工具映射的权威副本
locale/en.json, zh.json      Plugin Manager 标题与说明
icon.svg                     组合包图标
scripts/sync-upstream.ps1    重新同步上游
test/bundle.test.mjs         打包校验（仅 Node 内置模块）
test/smoke.test.mjs          对真实 DSH 安装的集成冒烟测试
UPSTREAM.md                  上游来源与适配清单
```

## 测试

```sh
npm test                     # 打包校验，不需要 DSH
node test/smoke.test.mjs     # 集成测试，需要 DSH 的 node_modules
```

冒烟测试用真实的 `SkillRegistry` 和 `SystemPrompt` 启动裸 Cordis 上下文；自动
探测失败时用 `DSH_NODE_MODULES` 显式指定。

桌面版把 harness 放在 `app.asar` 里，普通 Node 读不了；用应用自带的运行时代跑：

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
$env:DSH_NODE_MODULES = 'D:\Program Files\DeepseekHarness\resources\app.asar\dsh\node_modules'
& 'D:\Program Files\DeepseekHarness\DeepSeek Harness.exe' test/smoke.test.mjs
```

## 更新上游技能

```powershell
powershell -ExecutionPolicy Bypass -File scripts/sync-upstream.ps1
```

脚本会克隆上游、整体替换 `skills/`、重新应用 DSH 适配并重写 `UPSTREAM.md`；
检查 diff 后，记得更新 `package.json` 的 `version` 和 `upstream` 字段。

## 已知限制

- **bash 脚本**：`subagent-driven-development/scripts/*` 与 `find-polluter.sh`
  是 bash；Windows 上需 Git Bash/WSL，或重写等价逻辑。技能流程不依赖它们。
- **子代理模型路由**：DSH 的 `subagent` 工具没有逐次派发的 `model` 参数，
  技能里“必须显式指定模型”的步骤会跳过（见 `references/dsh-tools.md`）。
- **无原生 worktree 工具**：`using-git-worktrees` 始终走 git worktree 回退路径。
- **不要重复挂载**：同层挂两个实例会让 `superpowers:bootstrap` 段名冲突；
  装本组合包前，先移除旧的 file:// 补丁行。

## License

与上游一致使用 MIT；技能版权归 [Jesse Vincent](https://github.com/obra) 所有，
详见 [LICENSE](LICENSE)。
