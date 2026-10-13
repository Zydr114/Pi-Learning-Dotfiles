# Pi-Learning-Dotfiles

一个把 [pi](https://github.com/earendil-works/pi) 变成**学习环境**的个人 profile 配置仓库：
先摸底再定路线图，按单元教学，用 `quiz` 检验掌握程度，并把整个过程镜像进 Obsidian。

| | |
|---|---|
| 装载目录 | `PI_CODING_AGENT_DIR=~/.pi/profiles/learning` |
| 启动方式 | `pi-learn`（fish 函数，定义在 `~/.config/fish/config.fish`） |
| 记忆目录 | `PI_MEMORY_DIR=~/.pi/profiles/learning/memory`（同一函数注入） |

## 文件组成

| 路径 | 内容 |
|---|---|
| `Recommend_Setting.json` | 推荐设置模板：依赖的 npm 包、默认 provider / model、子代理开关。换机时 `cp Recommend_Setting.json settings.json` |
| `skills/curriculum/` | `/skill:curriculum` —— 宏观自适应摸底 → 依赖 DAG → 落 `ROADMAP.md` |
| `skills/teach/` | `/skill:teach` —— 单 Unit 微观教学，含 `quiz` 检查点 |
| `skills/visualize/` | `/skill:visualize` —— 派发 maker 子代理出图并嵌回日志 |
| `extensions/learn-memory.ts` | 学习状态引擎：`learn_*` 工具，以及会话启动 / 工具结果钩子 |
| `extensions/quiz.ts` | 判题工具 `quiz`：强制答案与解析、自动附加不可猜选项，支持多选与自由文本备注 |
| `extensions/ask-user-question.ts` | 无对错的偏好 / 决策工具 `ask_user_question` |
| `extensions/md-log.ts` | Obsidian 镜像：`/md-log`、`/md-unlog` |
| `extensions/visual-tools/` | 出图工具（Mermaid / SVG），仅子代理可用，不注册到主会话；依赖见下节 |
| `agents/researcher.md` | 事实核对与领域扫查子代理，产出 `research.md` |
| `agents/mermaid-maker.md` | 结构 / 关系图子代理 |
| `agents/svg-maker.md` | 空间 / 几何图子代理 |
| `docs/ARCHITECTURE_AND_ROADMAP.md` | 分层架构、持久化建模规范、教学法与实施路线图 |
| `AGENTS.md` | 在本仓库内工作时给代理的指令（目前为空） |
| `.gitignore` | 只入库上列源码与配置；密钥、本机设置、运行期数据一律忽略 |

## 出图依赖（`mermaid-maker` / `svg-maker`）

图表由 `extensions/visual-tools` 渲染，这些依赖不入库，换机后需自行装。

**① Node 依赖**：

```bash
cd ~/.pi/profiles/learning/extensions/visual-tools && npm install
```

**② 一个 Chrome / Chromium**：Mermaid 需要真实浏览器驱动渲染，扩展自己不捆绑浏览器，
按以下顺序探测（`tools/_common.ts` 的 `findChrome()`），**命中任一条即可**：

1. 环境变量 `PI_CHROME_PATH` → `PUPPETEER_EXECUTABLE_PATH` → `CHROME_PATH`
2. Playwright 装的 Chromium：`~/.cache/ms-playwright/chromium-<版本>/chrome-linux{64,}/chrome`
   （版本新 → 旧；`chromium_headless_shell-*` 会被忽略）
3. 系统路径：`/usr/bin/{google-chrome-stable,google-chrome,chromium,chromium-browser,ungoogled-chromium}`、`/snap/bin/chromium`

所以下列方式任选一种（也可以都不装，直接把 `PI_CHROME_PATH` 指向已有的浏览器）：

```bash
sudo pacman -S chromium                 # 装系统包
npx -y playwright install chromium      # 或让 Playwright 装到 ~/.cache/ms-playwright
```

**③ SVG 渲染**：优先 `rsvg-convert`，缺失时回退 ImageMagick 的 `magick`：

```bash
sudo pacman -S librsvg          # 提供 rsvg-convert（首选，系统字体处理好）
sudo pacman -S imagemagick      # 提供 magick（备选回退）
```

> 没装系统 Chromium 也能出图——只要上面第 2 条那种 Playwright 里的 Chromium 存在即可。

## 致谢

- **灵感来源**：[amosblomqvist/learn](https://github.com/amosblomqvist/learn) —— 本项目的最初构想来自它，
  `md-log` 扩展与 `quiz` 工具的部分源码也取自该仓库。
- **运行平台**：[earendil-works/pi](https://github.com/earendil-works/pi)
- **用到的非自带插件**：
  - [nicobailon/pi-subagents](https://github.com/nicobailon/pi-subagents) —— 子代理运行时
  - [nicobailon/pi-web-access](https://github.com/nicobailon/pi-web-access) —— Web 检索与抓取
  - [MasuRii/pi-image-tools](https://github.com/MasuRii/pi-image-tools) —— 图片工具
  - [lmilojevicc/pi-zentui](https://github.com/lmilojevicc/pi-zentui) —— TUI 外观
  - [avhagedorn/pi-compact-transcript](https://github.com/avhagedorn/pi-compact-transcript) —— 紧凑转录
  - [gsanhueza/pi-token-speed](https://github.com/gsanhueza/pi-token-speed) —— token 速率显示
- **代码编写**：Gemini 3.8 Flash 与 Deepseek V4.1 Flash。
