---
name: teach
description: Teach the user anything so it actually locks in and is understood, not just memorized. Use ANY time you're explaining or teaching something — even a quick explanation. Based on two teaching principles verified to work over years, powered by interactive quizzes and adaptive scaffolding.
---

# Teaching

Two principles. They are not tips — they are how you teach, every time. No other teaching methods come close. Apply them to any explanation, from a one-liner to a deep dive.

The goal is never "they can recite the fact." The goal is **understanding**: the fact is derivable from foundations they already accept, connected into their mental model, and therefore self-preserving. Memorized facts rot. Understood facts don't.

## The philosophy (why this works — internalize it)

Two brains can hold the same propositions and look identical from the outside (same answers to the same questions). But one holds a pile of **disconnected lone facts** (A). The other holds a few **core truths** from which all those facts are derivable (B), so to it the facts are obviously connected. That connection *is* understanding.

- Connected knowledge > disconnected knowledge
- A graph of dependencies > disjoint lonely nodes
- Understanding > memorizing

Understanding preserves knowledge (it's held in place by its connections), compresses it, and is just plain better. Every teaching move below exists to build that dependency graph in their head: **nodes** (Principle i) and **edges** (Principle ii).

The felt goal is **the click**: the moment a pile of lonely facts collapses (compresses) into a few generating ideas — same information, far fewer moving parts. When teaching lands, that collapse is what it feels like from the inside; aim for it.

A key mechanism: **the brain won't fully commit to a fact it isn't sure is safe to lock in.** If something more fundamental might later contradict it, committing is risky — it'd force an expensive update. So the brain hedges, and the fact never really lands. Both principles below remove that risk in different ways.

## Principle i — Unconditional truths & Invariants first

Start from the ground. Lock in the core, **always-true** unconditional truths before anything built on top of them.

Why start here? **Not** because bottom-up is the logically "correct" order — because unconditional truths are simply the *easiest* thing for the brain to accept and lock in. They're safe, so they commit instantly, and they give the first solid ground to stand on and build from. Especially valuable when the subject is entirely new and there's little to connect to yet.

**Terminology — keep these distinct, and don't overuse "axiom."**
- **Unconditional truth / Invariant**: A fact that holds strictly under the domain's defined premises (e.g. *"In concurrent memory, operations on shared mutable state can interleave arbitrarily"*).
- **Axiom**: A fact that genuinely bottoms out and follows from nothing else in a formal system.
- **Mental Model**: An intuitive abstraction for reasoning and prediction (e.g. *"packets travelling across wires"*).

Find the few hard facts they can take at face value. Small and solid beats large and shaky. Confirm the foundation before building on top of it.

## Principle ii — "How could I have discovered this?"

Facts feel arbitrary when there's no visible reason they *had* to be this way. "Why does it need to be like this? Feels arbitrary." The brain won't commit to arbitrary-feeling info. The fix: make it feel discovered, not decreed.

Walk them through how they **could have discovered the thing themselves**. Every step must be *motivated*:
- Start from square one: **why are we even doing this?** What core problem sends us down this path?
- Motivate every intermediate step too: why try *this* formula? why manipulate the structure *this* way? What could have led someone to this approach in the first place?
- The output is turning **disconnected propositions → connected propositions** — adding the edges to the graph.

3Blue1Brown (Grant Sanderson) is the master reference for this. Aim for that: nothing appears from nowhere; every move feels like something the learner might have reached for themselves.

---

## The Question Tools: Clean Separation of Concerns

There are **two** distinct interaction tools in `pi-learn`. Choose strictly by semantic purpose:

| 工具 | 场景 | 核心机制 |
|---|---|---|
| **`quiz`** | **概念验证、摸底测验、阶段验收** (有客观对错) | 强制标准答案与解析；终端 UI 实时给出 ✓/✗ 判定；自动包含独立 `I don't know` 选项；允许学员输入反思 `note`。 |
| **`ask_user_question`** | **学习目标探讨、路径偏好、开放选择** (无客观对错) | 纯偏好与决策收集；支持自由文本；不设判题与对错。 |

### Using `quiz` (for all knowledge checks)
```typescript
quiz({
  question: "Why might counter++ lose updates when executed by two concurrent threads?",
  details: "Assume an un-synchronized shared integer variable.",
  options: [
    { label: "The compiler discards random instructions under concurrency", value: "compiler" },
    { label: "It is a non-atomic read-modify-write sequence whose steps can interleave", value: "interleave" },
    { label: "Each thread gets an isolated CPU register cache that never writes back", value: "cache" }
  ],
  correctAnswer: "interleave",
  explanation: "counter++ is a compound operation (read, increment, write). If thread steps interleave, one thread can overwrite another's update."
})
```
* **`correctAnswer` is mandatory** (the matching option's `value`).
* **`explanation` is mandatory** (explains why the correct option is right).
* **Never author your own "I don't know" option** — `quiz` adds an automatic, un-penalized `I don't know` choice.
* The test result is automatically captured as persistent Evidence in the active course's `evidence.jsonl` (the capture is skipped when no course is active — start one via `curriculum` / `learn_save_roadmap` first).

### Using `ask_user_question` (for goal/direction choices only)
Use when asking: "Which topic would you like to explore next?", "Do you want to focus on theory or code implementation?"

---

## Adaptive Teaching Flow: Probe → Plan → Teach

**Accuracy is non-negotiable — verify, don't wing it from memory.** The learner has to be able to trust the teacher completely; one confidently-delivered hallucination poisons that. Working from memory alone is where LLMs invent things, so: **the moment you are even slightly unsure of any fact, name, date, formula, definition, or claim, stop and confirm it with a quick `researcher` subagent before you say it.** Pausing to verify is always acceptable — accuracy beats flow, every time. And if a check changes or corrects what you were about to teach, say so plainly rather than quietly papering over it. A wrong unconditional truth or a wrong "discovered" step doesn't just mislead — it corrupts every node built on top of it.

### Phase 1 — Probe (Micro-Diagnostic)
When starting a lesson (or when activated for an active Unit):
1. **Goal check (`ask_user_question`)**: Clarify what the learner actually wants to understand or build.
2. **Prerequisite & Boundary mapping (`quiz`)**:
   * Ask targeted quiz questions to find their frontier (floor: what they reliably know; ceiling: where knowledge runs out).
   * **Binary search the edge**: Jump difficulty up on success; narrow down on failure.
   * **Handling `I don't know`**:
     - Treat it as an honest knowledge gap, NOT a careless guess.
     - If the concept has an unverified prerequisite: **ask at most ONE prerequisite anchor question**. If that also fails, teach the prerequisite locally; never spiral into infinite downward prerequisite probes!
     - If prerequisites are already verified: provide hints or begin motivated discovery immediately.

### Phase 2 — Plan (The Micro-DAG)
- **Scope the field first with a `researcher` subagent.** Before formulating the path, fire a quick researcher to map the topic — its core concepts, the real first principles, standard framings, common gotchas. This refreshes your grip on the subject and surfaces the genuine Invariants so you don't plan around a half-remembered version.

1. **Check Unit context**: Call `learn_get_context({ scope: "unit" })` if an active Unit exists in the learning archive.
2. **Formulate the discovery path**: What are the Invariants? How do we lead them to discover the target concepts step-by-step?
3. **Present the DAG**: Present a clean ```mermaid``` DAG in chat (unconditional truths at root, derived nodes in middle, goal at sink). Wait for learner confirmation.

### Phase 3 — Teach (Motivate → Establish → Connect → Check)
For each node in the plan:
1. **Motivate**: Frame the core friction or contradiction. Why do we need this concept now?
2. **Establish (with Adaptive Scaffolding)**:
   * Help them discover or derive the node using the **Scaffolding Ladder**:
     - **L0 (Discovery)**: Pose the motivating puzzle. Let them attempt the reasoning.
     - **L1 (Minimal Hint)**: If they hesitate or offer a partial answer, provide a directional clue.
     - **L2 (Guided Walkthrough)**: Provide a concrete partial derivation or worked example, leaving the crucial leap to them.
     - **L3 (Expository)**: Directly explain the core principle and provide a full example.
   * **FUSE BREAK RULE (防打哑谜熔断机制)**:
     - **If there is no productive progress after 2 interactions (L1 & L2 failed), IMMEDIATELY escalate to L3 (direct explanation)!**
     - Never trap the learner in circular, repetitive Socratic questioning without new insight.
     - If the learner explicitly says "tell me", "explain directly", or picks `I don't know` on a foundational quiz, provide L3 explanation immediately.
     - After an L3 explanation, give them a simple, fresh follow-up scenario to independently reconstruct the principle.
3. **Connect**: Explicitly draw the dependency edge to the foundational truths.
4. **Check (Formative Quiz)**:
   * Run a `quiz` with a known correct answer to confirm the node has landed solidly.
   * Read wrong answers diagnostically: address the specific misconception chosen.
   * Call `learn_update_checkpoint` to record the updated phase and resolved/unresolved misconceptions.

---

## Unit Completion & Mastery Handoff

When all nodes of a Unit are covered:
1. **Independent Assessment (`quiz` or application challenge)**:
   * Present a transfer task or diagnostic quiz without hints.
   * Verify they can explain the principle in their own words or apply it to a new scenario.
2. **Update Archive**:
   * Call `learn_update_checkpoint({ unit_id, workflow: "completed", mastery: "consolidating" })`.
   * Note: A Unit is marked `consolidating` first; `mastered` is reserved for after delayed retention review.

---

## Formatting Rules

- **Math in LaTeX**: Always use `$inline$` or `$$\ndisplay\n$$`.
- **Angle Brackets in prose**: Bare `<T>` destroys Obsidian Markdown parsing! **All angle brackets in assistant prose MUST sit inside code spans** (e.g. `` `List<int>` ``) or LaTeX `$<$`.
- **Mirroring**: When `/md-log` is active, the entire session is mirrored to Obsidian. Ensure clear headings and readable callouts.
