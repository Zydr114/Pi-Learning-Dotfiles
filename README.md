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
| `Recommend_Setting.json` | 推荐设置模板：依赖的 npm 包、默认 provider / model、子代理开关。换机时 `cp Recommend_Setting.json settings.json`，再在 `extensions/visual-tools/` 跑一次 `npm install` |
| `skills/curriculum/` | `/skill:curriculum` —— 宏观自适应摸底 → 依赖 DAG → 落 `ROADMAP.md` |
| `skills/teach/` | `/skill:teach` —— 单 Unit 微观教学，含 `quiz` 检查点 |
| `skills/visualize/` | `/skill:visualize` —— 派发 maker 子代理出图并嵌回日志 |
| `extensions/learn-memory.ts` | 学习状态引擎：`learn_*` 工具，以及会话启动 / 工具结果钩子 |
| `extensions/quiz.ts` | 判题工具 `quiz`：强制答案与解析、自动附加不可猜选项，支持多选与自由文本备注 |
| `extensions/ask-user-question.ts` | 无对错的偏好 / 决策工具 `ask_user_question` |
| `extensions/md-log.ts` | Obsidian 镜像：`/md-log`、`/md-unlog` |
| `extensions/visual-tools/` | 出图工具（Mermaid / SVG），仅子代理可用，不注册到主会话 |
| `agents/researcher.md` | 事实核对与领域扫查子代理，产出 `research.md` |
| `agents/mermaid-maker.md` | 结构 / 关系图子代理 |
| `agents/svg-maker.md` | 空间 / 几何图子代理 |
| `docs/ARCHITECTURE_AND_ROADMAP.md` | 分层架构、持久化建模规范、教学法与实施路线图 |
| `AGENTS.md` | 在本仓库内工作时给代理的指令（目前为空） |
| `.gitignore` | 只入库上列源码与配置；密钥、本机设置、运行期数据一律忽略 |

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
