# pi-learn 学习系统架构设计与落地决策文档

> **版本**: 1.0.0  
> **更新日期**: 2026-10-13  
> **适用环境**: Pi Coding Agent (`pi-learn` profile)  
> **状态**: Approved / Ready for Implementation  

---

## 1. 背景与核心设计哲学

### 1.1 现状与痛点
1. **通用 Agent 记忆与智能助教认知模型的错位**：
   * 原生 `pi-memory` 设计初衷是记录“用户习惯、编码偏好、每日零散工作日志”，属于面向日常任务的通用 Agent 记忆。
   * 智能助教核心关注的是学员的**长期认知结构**：学员正在建立怎样的知识体系、哪些概念能独立运用、哪些只是暂时理解、哪些误区反复出现、下一次复习何时发生。
2. **交互插件缺乏即时判题与形成性评价能力**：
   * 原配置采用 `@juicesharp/rpiv-ask-user-question`，仅有无对错属性的单选/多选偏好收集，缺乏实时自动判题（Grading）与答案解析展示功能，导致摸底与随堂自测必须由模型在后续文本中慢速点评。
3. **宏观规划与微观教学未解耦**：
   * 缺乏长期系统化课程规划（Curriculum）能力，单点微观教学（Teach）无法持久化感知长程上下文。

### 1.2 核心设计哲学：证据驱动的学习状态模型
`pi-learn` 从“带有长期记忆的教学 Agent”重新定义为：
> **一个由学习证据驱动、以知识依赖图组织课程、通过双轨交互持续更新学员认知状态的自适应智能助教系统。**

核心原则：
* **课程规划与学习证据分离**：`ROADMAP` 描述“应该学什么”，`EVIDENCE` 记录“实际做了什么”，`MASTERY` 记录“当前认知状态快照”。
* **工作流状态与认知掌握状态解耦**：完成教学（Completed）不等于稳定掌握（Mastered）。
* **Skill 负责教学策略，Extension 负责可靠状态与确定性写入**：模型给出教学决策，状态转换由确定性代码校验与维护。

---

## 2. 总体分层架构

```
┌────────────────────────────────────────────────────────────────────────┐
│                        交互与教学层 (Pedagogy)                         │
│  - Curriculum Skill (宏观规划)        - Teach Skill (微观教学)         │
│  - Quiz TUI (即时判题与解析)          - Ask User Question (开放探讨)   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    学习编排与生命周期层 (Orchestrator)                 │
│  - Mode Router (模式路由)             - Handoff Contract (交接协议)    │
│  - Context Injector (L0/L1 注入)      - Lesson Checkpoint (教学断点)   │
│  - Scaffolding Controller (脚手架降级)- ZPD Dynamic Probe (前沿探测)  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     认知状态与评测层 (Learning State)                  │
│  - Mastery Engine (状态流转推断)      - Misconception Tracker (误区跟踪)│
│  - Evidence Sink (证据采集)           - Review Scheduler (间隔复习)   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      持久化与笔记层 (Persistence)                      │
│  - ROADMAP.md (课程规划总表)          - MASTERY.md (认知状态快照)      │
│  - evidence.jsonl (追加式证据日志)    - md-log (Obsidian 镜像笔记)     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 极简持久化建模规范（一课三件套）

在单人本地学习场景下，避免过度设计为复杂数据库或过度拆散文件，采用目录规范：
`~/.pi/profiles/learning/memory/courses/<course_id>/`

### 3.1 目录结构
```text
~/.pi/profiles/learning/memory/
├── courses/
│   └── <course_id>/
│       ├── ROADMAP.md       # 规范与目录：DAG 依赖、各单元目标与真理
│       ├── MASTERY.md       # 认知快照：工作流状态、掌握度、活跃 Checkpoint
│       └── evidence.jsonl   # 事件日志：追加式客观答题与评价证据
└── active.json              # 全局指针：当前活动课程、活动 Unit
```

### 3.2 `ROADMAP.md` 规范
坚持“**Frontmatter 存关系，正文 Markdown 存知识**”，避免重复维护：

```markdown
---
schema: 1
course_id: cs-concurrency
title: C# 并发编程与内存模型

units:
  - id: u01
    title: 共享状态与数据竞态
    requires: []
  - id: u02
    title: 原子性与临界区互斥
    requires: [u01]
  - id: u03
    title: 内存可见性与屏障
    requires: [u01]
---

# U01 · 共享状态与数据竞态

## Objectives
- 解释多线程下共享可变状态的危险性
- 独立诊断并指出简单代码中的数据竞态

## Core Principles
- 并发线程的操作可能在时间线上任意交错

## Acceptance
- 能独立分析一个丢失更新（Lost Update）的执行时序

# U02 · 原子性与临界区互斥

## Objectives
- 解释为什么单行高级语言操作不保证原子性
- 使用 lock 正确保护临界区

## Core Principles
- 针对共享变量的复合读-改-写操作不是原子操作，必须通过互斥保证完整性

## Acceptance
- 独立修复共享计数器竞态，并解释锁的作用范围与边界
```

### 3.3 `MASTERY.md` 规范
分离两个核心维度：
* **工作流状态**：`Pending` | `Active` | `Paused` | `Completed`
* **认知掌握状态**：`Unknown` | `Emerging` | `Consolidating` | `Mastered`

```markdown
---
course_id: cs-concurrency
revision: 5
active_unit: u02
---

# 认知掌握状态

## U01 · 共享状态与数据竞态
- **Workflow**: completed
- **Mastery**: mastered
- **Evidence**: 2 次独立正确推导，1 次延迟迁移验证

## U02 · 原子性与临界区互斥
- **Workflow**: active
- **Mastery**: emerging
- **Checkpoint**:
  - Phase: establish
  - Covered: [race-condition-timeline]
  - Pending: [interleaved-read-modify-write, lock-syntax]
  - Misconceptions:
    - id: single-line-is-atomic
      status: addressing (正在通过反例揭示)
  - Next Action: 给出双线程交错执行读写案例，引导其识别复合操作

## 最近活动证据 (最新 5 条摘要)
- 2026-10-13 19:30 | u02 | quiz:incorrect | 误区: 以为 count++ 是一条机器指令
- 2026-10-13 19:15 | u01 | assessment:pass | 独立给出时间线重排分析
```

### 3.4 `evidence.jsonl` 规范
记录追加式、不可变事件，用于可追溯判定与掌握度计算：
```json
{"id":"evt-001","timestamp":"2026-10-13T19:30:00Z","unit":"u02","type":"quiz","question_id":"q-atomicity-01","outcome":"incorrect","confidence":"high","hint_level":0,"note":"我认为单行自增是原子的"}
{"id":"evt-002","timestamp":"2026-10-13T19:35:00Z","unit":"u02","type":"hint","level":1}
{"id":"evt-003","timestamp":"2026-10-13T19:42:00Z","unit":"u02","type":"explanation","outcome":"adequate","independent":true}
```

---

## 4. 交互与评测插件体系重塑

### 4.1 插件选型与职责分工
| 插件 | 来源 | 主要职责 | 交互特性 |
|---|---|---|---|
| `quiz.ts` | 本地移植 (`learn/extensions`) | 概念验证、形成性检验、验收测试 | 终端 TUI 弹窗、即时判题 (✓/✗)、强制答案与解析、独立 `I don't know`、反思 `note` 字段 |
| `ask-user-question.ts` | 本地移植 (`learn/extensions`) | 目标探讨、路线偏好、开放选择 | 纯偏好收集，无对错概念，支持自由文本 |
| `md-log.ts` | 本地定制 (`learn/extensions`) | 镜像同步到 Obsidian 笔记 | 渲染 Quiz 结果 Callout、LaTeX 公式原生渲染、尖括号 `<T>` 安全转义 |
| `learn-memory.ts` | 新增专属轻量扩展 | 课程档案管理、L0 上下文注入、证据捕获 | 监听 `tool_result`，单写入队列保证文件原子性 |

### 4.2 零侵入证据通信（Tool Result 监听）
不采用没有持久送达保证的异步事件广播，也不增加额外 LLM 工具调用负担，利用 Pi 的扩展生命周期钩子：
```typescript
pi.on("tool_result", async (event) => {
  if (event.toolName !== "quiz") return;
  // 从 quiz 执行结果的 details 中捕获证据
  const details = event.details as QuizDetails;
  if (!details) return;
  
  await evidenceStore.appendOnce({
    id: `quiz-${event.toolCallId}`,
    timestamp: new Date().toISOString(),
    unit: currentActiveUnit,
    outcome: details.dontKnow ? "unknown" : details.correct ? "correct" : "incorrect",
    note: details.note,
    correctIndices: details.correctIndices,
    answers: details.answers
  });
});
```

---

## 5. 上下文注入（Context Injection）防膨胀实践

### 5.1 分层上下文策略
* **L0 · Active Learning Snapshot（自动注入，~150-250 Tokens）**：
  * 利用 `before_agent_start` 钩子，判断若当前处于学习任务，将当前活动单元与教学断点注入该轮提示词中。
  * **绝不向历史消息追加消息实体**，防止跨会话多轮对话导致上下文体积线性爆炸。
* **L1 · Unit Details（按需拉取）**：
  * 提供轻量只读工具 `learn_get_context(scope: "unit" | "prerequisites")`，由模型在进入新阶段或详细备课时按需检索。

### 5.2 L0 Snapshot 结构示例
```text
[PI-LEARN ACTIVE SNAPSHOT]
Course: cs-concurrency | Unit: u02 (原子性与临界区互斥)
Workflow: Active | Mastery: Emerging
Checkpoint:
- Phase: Establish (正在建立原子性概念)
- Misconception: single-line-is-atomic (正在纠正)
- Next Action: 给出双线程交错执行时序案例，引导其识别复合操作
```

---

## 6. 双轨 Skill 体系与自适应教学法规范

### 6.1 长期规划模式（`curriculum` Skill）
针对一个宏观体系、学科或完整技术栈，负责体系搭建与全局编排。

#### 自适应宏观摸底（Macro Diagnostic，5~8 题定位 ZPD）
目标不是面面俱到考完所有分支，而是低成本建立知识假设，定位学员的**最近发展区（Zone of Proximal Development）**：
1. **题 1（目标与背景）**：了解学员既有背景与核心期望（使用 `ask_user_question`）。
2. **题 2-3（核心基础锚点）**：覆盖关键前置链，确认是否具备进入该课程的基石能力（使用 `quiz`）。
3. **题 4-5（能力边界探针）**：拔高难度，探测推理质量与断点（使用 `quiz`）。
4. **题 6（迁移与反例检验）**：使用反直觉反例，检验是死记硬背还是理解机理（使用 `quiz`）。
5. **题 7（动态辅助探针 ZPD）**：在较难题目中给予一级微小提示，观察能否在引导下取得突破。

#### 编排与 Handoff Contract
摸底后生成依赖 DAG 并写入 `ROADMAP.md`，交接给微观教学：
```json
{
  "course_id": "cs-concurrency",
  "unit_id": "u02",
  "objectives": ["解释原子性", "使用 lock 保护临界区"],
  "prerequisites": { "verified": ["u01"], "uncertain": [] },
  "known_misconceptions": ["single-line-is-atomic"]
}
```

---

### 6.2 短期微观教学（`teach` Skill）
聚焦单个 Unit 的深度内化，遵循 3Blue1Brown 式的**动机驱动发现机制（Motivated Discovery）**。

#### 三类问题分流
* **Discovery Prompt（启发探究）**：开放提问、预测直觉、构建假说。**不设标准答案、不即时判对错、不计入考试成绩**，保护探索心流。
* **Formative Quiz（关键节点检验）**：在阶段概念闭环（Motivate → Establish → Connect）形成后，调用 `quiz` 进行客观题单选/多选验证，锁死核心骨架。
* **Assessment Task（独立验收）**：单元结尾要求学员独立推导、解释或编写代码进行迁移。

#### 量化自适应脚手架机制（防打哑谜规则）
AI 教学严禁陷入死板反问，设置 4 级支持：
* **L0（Discovery）**：纯启发与现象观察。
* **L1（Minimal Hint）**：给出一个方向性线索，缩小搜索空间。
* **L2（Guided Walkthrough）**：局部留白，给出部分推导，由学员完成关键步骤。
* **L3（Expository）**：直接讲解核心原理与完整示例。

> **硬性熔断规则**：
> 1. 同一概念下若连续 **2 次交互无有效认知进展**，**必须立即降级为 L3 直接讲解**，严禁同义改写反问！
> 2. 学员明确要求直接讲解时，立即降级为 L3。
> 3. L3 讲解后，安排一个简化新情境让学员独立重构，验证内化。

#### "I don't know" 处置规则
1. 视为“诚实的未知信号”，不计为盲目猜错。
2. 检查前置依赖状态：
   * 前置已验证：直接给予 L1/L2 启发或 L3 讲解。
   * 前置未确定：**最多追加 1 道基础锚点题排查缺口**，绝不进行无休止层层向下追溯！

---

## 7. 实施路线图 (Implementation Roadmap)

| 阶段 | 任务项 | 验收标准 |
|---|---|---|
| **Phase 1: 依赖就位** | 1. 调整 `settings.json`：移除 `rpiv-ask-user-question` 与 `pi-memory`。<br>2. 复制 `quiz.ts` 与 `ask-user-question.ts` 到 profiles。<br>3. 适配 `md-log.ts`：恢复对 Quiz Callout 的记录并保留尖括号转义。 | 运行 `pi -p` 无依赖报错，终端可呼出带判题的 quiz。 |
| **Phase 2: 核心记忆扩展** | 1. 实现 `extensions/learn-memory.ts`。<br>2. 支持 `ROADMAP.md`、`MASTERY.md`、`evidence.jsonl` 的解析与写入。<br>3. 挂载 `before_agent_start` 动态注入 L0 快照。<br>4. 挂载 `tool_result` 自动收集 Quiz 证据。 | 测验后自动在 `evidence.jsonl` 生成记录，新会话自动显示活动课程快照。 |
| **Phase 3: 双轨 Skill 升级** | 1. 升级 `skills/teach/SKILL.md`，嵌入动态脚手架规则与 `quiz` 流程。<br>2. 新建 `skills/curriculum/SKILL.md`，嵌入宏观自适应摸底流程。 | `/curriculum` 可开启长程规划，`/teach` 可开展单元微观教学。 |
