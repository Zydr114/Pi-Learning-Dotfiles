# Pi-Learning-Dotfiles

`pi-learn` profile 的个人配置仓库。

- **装载目录**：`PI_CODING_AGENT_DIR=~/.pi/profiles/learning`
- **启动方式**：`pi-learn`（fish 函数，定义在 `~/.config/fish/config.fish`）
- **记忆目录**：`PI_MEMORY_DIR=~/.pi/profiles/learning/memory`（同一函数中注入）

本仓库只收录**必需的源码、技能、代理与配置**；个人状态、密钥与运行期数据不入库（见 §4）。

---

## 1. 依赖的 pi 包（`settings.json` → `packages`）

| 包 | 作用 |
|---|---|
| `npm:pi-subagents` | 子代理运行时（本仓库两个 maker 代理的宿主） |
| `npm:pi-web-access` | Web 检索/抓取；经 `subagents.agentOverrides.researcher` 注入 `researcher` 代理 |
| `npm:pi-zentui` | TUI 外观 |
| `npm:pi-compact-transcript` | 紧凑转录 |
| `npm:pi-token-speed` | token 速率显示 |
| `npm:pi-image-tools` | 图片工具 |

> ⚠️ `quiz` 与 `ask_user_question` **不来自 npm 包**：
> `quiz` 是本地 `extensions/quiz.ts`；`ask_user_question` 由本地 `extensions/ask-user-question.ts`
> 取代了历史上曾使用的 `@juicesharp/rpiv-ask-user-question`（已从 `packages` 移除，勿再加回）。
>
> `npm/` 目录（含其 `package.json` / lockfile）由 pi 依上面这份 `packages` 自动生成，属**派生产物**，不入库。

---

## 2. 本地扩展（`extensions/`）

| 文件 | 提供 |
|---|---|
| `learn-memory.ts` | 学习状态引擎。工具：`learn_save_roadmap`、`learn_get_context`、`learn_update_checkpoint`、`learn_list_courses`、`learn_switch_course`；三个钩子：`session_start`（状态栏）、`before_agent_start`（注入 L0 快照，不追加历史消息）、`tool_result`（自动捕获 `quiz` 证据到 `evidence.jsonl`） |
| `quiz.ts` | 判题工具 `quiz`：强制 `correctAnswer`（选项 `value`）+ `explanation`，自动附加不可猜的 `I don't know`，支持 `multiSelect` 与自由文本 `note` |
| `ask-user-question.ts` | 无对错的偏好/决策工具 `ask_user_question` |
| `md-log.ts` | Obsidian 镜像。命令：`/md-log <file-path>`、`/md-unlog`；把 quiz/ask 结果渲染成 Callout，并做尖括号转义 |
| `visual-tools/tools/*.ts` | 仅供子会话使用的渲染工具（见 §3），通过 `subagentOnlyExtensions` 加载，**不**注册到主会话 |

---

## 3. 技能与子代理

技能在 pi 中注册为 **`/skill:<name>`**，不存在裸命令 `/teach`、`/curriculum`：

| 技能 | 调用 | 用途 |
|---|---|---|
| `curriculum` | `/skill:curriculum` | 宏观自适应摸底 → 依赖 DAG → `learn_save_roadmap` 落 `ROADMAP.md` |
| `teach` | `/skill:teach` | 单 Unit 微观教学：动机驱动发现 + L0–L3 分级脚手架 + `quiz` 检查点 |
| `visualize` | `/skill:visualize` | 派发 maker 子代理出图，把返回的文件名嵌回 Obsidian 日志 |

代理定义在 `agents/`，由 pi-subagents 从 `<agent dir>/agents/` 发现，均 `advertise: true`：

| 代理 | 用途 | 环境前置 |
|---|---|---|
| `mermaid-maker` | 结构/关系图：依赖 DAG、流程图、时序图、状态机、树、ER | visual-tools 依赖已装 + 可找到 Chrome/Chromium |
| `svg-maker` | 空间/几何图：坐标系、数轴、向量、函数图、精确布局 | `rsvg-convert`（缺省回退 ImageMagick `magick`） |

`visualize` 要求 **foreground** 调用（`subagent({ agent, task, async: false })`）——本环境子代理默认后台启动，
后台只回 run id，拿不到当轮就要嵌入的文件名。

### 3.1 从零复原 visual-tools（重要）

`node_modules/` 不入库，换机后必须显式安装：

```bash
cd ~/.pi/profiles/learning/extensions/visual-tools && npm install
```

渲染还需一个真实浏览器，扩展按下列顺序自动探测（`tools/_common.ts`）：

1. 环境变量 `PI_CHROME_PATH` / `PUPPETEER_EXECUTABLE_PATH` / `CHROME_PATH`
2. `~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome`（Playwright 装的 Chromium，版本新→旧）
3. 系统路径：`/usr/bin/google-chrome{,-stable}`、`/usr/bin/chromium{,-browser}`、`/usr/bin/ungoogled-chromium`、`/snap/bin/chromium`

即：**"本机没装系统 Chromium" 并不等于渲染不可用**——只要上面任一条命中即可。

---

## 4. 什么入库、什么忽略

**入库**：`.gitignore`、`README.md`、`AGENTS.md`、`settings.json`、`agents/`、`docs/`、
`extensions/**.ts`、`extensions/visual-tools/package.json` + `package-lock.json`、`skills/`

**忽略**（`.gitignore`）：`npm/`（派生产物）、`sessions/`、`missions/`、`memory/`、
`web-search-cache/`、`*.jsonl`，以及**默认全部 `*.json`** —— 仅 `settings.json` 与
visual-tools 的两个 package 文件在白名单内。

因此以下都**不**入库：`auth.json`、`models.json`、`models-store.json`、`zentui.json`、
`pi-subagents/last-seen-version.json`、`run-history.jsonl`。

> ⚠️ 新增仓库必需的 JSON（例如 `tsconfig.json`）时，必须在 `.gitignore` 白名单里显式放行，否则会被静默忽略。

`models.json` 与 `auth.json` 是指向 `~/.pi/profiles/shared/` 的符号链接，由该目录统一供给。

---

## 5. 记忆与课程持久化

- 学习状态由 `learn-memory.ts` 维护，落在 `memory/`：

  ```text
  memory/
  ├── courses/<course_id>/
  │   ├── ROADMAP.md      # frontmatter 存 DAG 关系，正文存目标/原理/验收
  │   ├── MASTERY.md      # 工作流状态 × 认知掌握状态 + Checkpoint
  │   └── evidence.jsonl  # 追加式答题证据
  └── active.json         # 当前活动课程 / Unit
  ```

- 本 profile **未安装** `pi-memory`（见 `docs/ARCHITECTURE_AND_ROADMAP.md` §7 Phase 1），
  所以这里没有 `memory_*` 工具；`memory/daily`、`memory/recovery` 是早期的遗留空目录。

---

## 6. 关联文档

- `docs/ARCHITECTURE_AND_ROADMAP.md` —— 分层架构、极简持久化建模规范（一课三件套）、双轨技能教学法、实施路线图。
