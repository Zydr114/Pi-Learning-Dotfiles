---
name: curriculum
description: Design long-term learning roadmaps, conduct adaptive macro diagnostics, and structure knowledge into dependency-ordered Learning Units. Use whenever the user asks for a learning plan, curriculum roadmap, wants to systematically master a subject/domain, or says "我想系统学习...", "做一份长期规划", "制定路线图".
---

# Curriculum Planning (Macro Learning Architecture)

The goal of `curriculum` is to turn an expansive, intimidating subject into a coherent, dependency-ordered **Roadmap of Learning Units** anchored in the learner's Zone of Proximal Development (ZPD).

Where `teach` zooms into one specific concept via motivated discovery, `curriculum` orchestrates the **entire journey**: assessing the macroscopic frontier, decomposing the domain into units, and generating the persistent course roadmap.

---

## The Three-Phase Workflow

```
Phase 1: Macro Diagnostic (5–8 adaptive probes to map ZPD)
   │
   ▼
Phase 2: Decomposition & Dependency DAG (Drafting Units & Invariants)
   │
   ▼
Phase 3: Persistence & Handoff (Saving to learn-memory & activating Unit 1)
```

---

## Phase 1 — Adaptive Macro Diagnostic (5–8 Questions)

**Principle**: The goal is NOT an exhaustive exam of all concepts. The goal is low-cost hypothesis testing: *Where does the learner's knowledge frontier sit right now? Which branches can be provisionally skipped, and which unit should we begin with?*

Use **`quiz`** for questions with correct answers (enables instant feedback and honest `I don't know` signals), and **`ask_user_question`** for background/goal alignment.

### The 5–8 Probe Sequence:

1. **Probe 1 · Goals & Prior Experience (`ask_user_question`)**:
   - Ask about their current background, familiar languages/tools, and ultimate target application.
2. **Probes 2–3 · Core Prerequisite Anchors (`quiz`)**:
   - Test foundational concepts necessary to enter the intermediate layer of the domain.
   - If they pick `I don't know` or fail here, the roadmap must include foundational units.
3. **Probes 4–5 · Capability Frontier Probes (`quiz`)**:
   - Test intermediate concepts to locate where independent reasoning breaks down.
4. **Probe 6 · Transfer & Counter-Intuitive Invariant (`quiz`)**:
   - Use an edge-case or non-obvious scenario to distinguish deep understanding from rote pattern-matching.
5. **Probe 7 · Dynamic Assistance Probe (ZPD Probe) (`quiz`)**:
   - Present a challenging problem with a directional hint. Observe whether they can make productive progress with scaffolding.

> **ZPD Assessment Rule**:
> - Concepts they solve independently -> can be provisionally skipped or set as prerequisites.
> - Concepts they solve with light scaffolding -> this is their **Zone of Proximal Development** (the exact starting point for Unit 1).
> - Concepts completely out of reach even with hints -> place in later units.

---

## Phase 2 — Domain Decomposition & Dependency DAG

Decompose the domain into **3 to 8 sequential Learning Units**. Avoid overwhelming mega-plans (15+ units) on day one.

### Structure of Each Learning Unit:
Each unit must define:
1. **`id`**: Short unique slug (e.g. `u01`, `u02`, `syntax`, `concurrency`).
2. **`title`**: Concise human-readable name.
3. **`requires`**: Explicit prerequisite unit IDs.
4. **`Objectives`**: What the learner will be able to do independently after completing the unit.
5. **`Core Principles / Invariants`**: The fundamental, underlying domain truths (not arbitrary syntax rules).
6. **`Acceptance Criteria`**: Concrete tasks required to graduate this unit.

### Presenting the Plan:
Present the roadmap to the learner with:
1. **Overview Prose**: Brief summary of the chosen path tailored to their diagnostic outcome.
2. **Mermaid Dependency Graph**:
   ```mermaid
   graph TD
     u01[U01: Basic Shared Memory] --> u02[U02: Race Conditions & Interleaving]
     u02 --> u03[U03: Mutex & Critical Sections]
     u02 --> u04[U04: Atomic Primitives]
   ```
3. **Review Checkpoint**: Ask the learner if the pace, scope, and target outcomes align with their expectations.

---

## Phase 3 — Persistence & Handoff Contract

Once the learner approves the roadmap, persist the plan using the `learn_save_roadmap` tool.

### Call `learn_save_roadmap`:
```typescript
learn_save_roadmap({
  course_id: "domain-slug", // e.g. "csharp-concurrency", "linear-algebra"
  title: "Full Course Title",
  units: [
    { id: "u01", title: "Shared Memory & Threads", requires: [] },
    { id: "u02", title: "Race Conditions & Interleaving", requires: ["u01"] },
    { id: "u03", title: "Mutual Exclusion & Critical Sections", requires: ["u02"] }
  ],
  content: `
# U01 · Shared Memory & Threads

## Objectives
- Explain thread memory isolation vs shared heap

## Core Principles
- Threads share process address space

## Acceptance
- Diagram thread stack vs heap allocation

# U02 · Race Conditions & Interleaving

## Objectives
- Identify non-atomic read-modify-write patterns

## Core Principles
- Operations on shared state can interleave arbitrarily

## Acceptance
- Analyze a lost-update sequence and identify the race window

# U03 · Mutual Exclusion & Critical Sections

## Objectives
- Use synchronization locks to protect critical sections

## Core Principles
- Critical sections require mutual exclusion to ensure atomicity

## Acceptance
- Refactor a racy counter using a lock and explain lock scope
  `.trim(),
  activate: true
})
```

### The Handoff to `teach`:
After saving:
1. Announce that the course has been recorded in the persistent archive (`ROADMAP.md` + `MASTERY.md`).
2. Clearly declare the active unit:
   > *"The roadmap is locked in! We are set to begin **U01: Shared Memory & Threads**. Whenever you are ready, say 'Let's begin' or type `/skill:teach` to dive into the first lesson!"*
