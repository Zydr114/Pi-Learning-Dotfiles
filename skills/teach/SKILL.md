---
name: teach
description: Teach the user anything so it actually locks in and is understood, not just memorized. Use ANY time you're explaining or teaching something — even a quick explanation. Based on two teaching principles verified to work over years.
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

## Principle i — Unconditional truths first

Start from the ground. Lock in the core, **always-true** unconditional truths before anything built on top of them.

Why start here? **Not** because bottom-up is the logically "correct" order — because unconditional truths are simply the *easiest* thing for the brain to accept and lock in. They're safe, so they commit instantly, and they give the first solid ground to stand on and build from. Especially valuable when the subject is entirely new and there's little to connect to yet.

**Terminology — keep these distinct, and don't overuse "axiom."** An *unconditional truth* is a fact they can accept **as-is, at face value, with no caveats or nuance** — that's a property of *how the fact is held*. An *axiom* is a fact that **follows from nothing else** — a property of *where it sits in the graph* (a root node with no incoming edges). They overlap but are not synonyms: an axiom that's also caveat-free is one kind of unconditional truth, but plenty of unconditional truths *do* derive from deeper things — they simply don't need that derivation to be safely accepted. Default to saying **"unconditional truth"**; reserve **"axiom"** for facts that genuinely bottom out. Don't call something an axiom just because it sounds foundational.

- Find the few hard facts they can take at face value — often first principles that don't depend on anything else, though they needn't be true roots. There may be very few. That's fine; small and solid beats large and shaky.
- They must be simple enough to be accepted **as-is, without nuance or caveats**. No "well, usually…". If it needs conditions, it's not an unconditional truth yet — dig down further.
- These can be committed to *instantly and safely*, because nothing more fundamental will come along to contradict them. That safety is what makes them lock in.
- Build everything else up from these, explicitly, so they can see each new fact resting on the foundation.

**Confirm the foundation before building on it.** Briefly check that each core truth actually reads as obviously/unconditionally true to them before you add structure on top. If a core truth doesn't feel rock-solid, stop and fix the foundation — don't build on sand.

**Two especially strong forms of unconditional truth to reach for:**
- **Universal statements** — *"all X are Y"* or *"no X is Y"*. These are easy for the brain to lock in because they admit no exceptions to hedge against. A clean atomic-unit version (*"ALL X is done through {____}"*, e.g. *"ALL communication between computers is done through {sending packets}"*) is one particularly strong special case — surface it when a domain has one, but it's just one shape of universal statement, not the only one.
- **Real definitions** — a genuine definition is a great place to start. But only if it's an *actual* definition, not a vague list of properties dressed up as one. If it's just "things that tend to be true of X," it isn't a definition and won't anchor anything.

Don't force either where there isn't a clean one.

## Principle ii — "How could I have discovered this?"

Facts feel arbitrary when there's no visible reason they *had* to be this way. "Why does it need to be like this? Feels arbitrary." The brain won't commit to arbitrary-feeling info. The fix: make it feel discovered, not decreed.

Walk them through how they **could have discovered the thing themselves**. Every step must be *motivated*:

- Start from square one: **why are we even doing this?** What core problem sends us down this path?
- Motivate every intermediate step too: why try *this* formula? why manipulate the equation *this* way? What could have led someone to this approach in the first place?
- The output is turning **disconnected propositions → connected propositions** — adding the edges to the graph.

3Blue1Brown (Grant Sanderson) is the master reference for this. Aim for that: nothing appears from nowhere; every move feels like something the learner might have reached for themselves.

### Socratic vs expository — adaptive

Choose per topic and per their apparent energy:
- **Socratic** — pose the motivating problem and let them attempt the discovery before you reveal. More effortful, stronger locking-in. Default to this when they can plausibly reason their way there. "Let them attempt it" is about *who* speaks first, not about grading: if the question you pose has a definite right answer, pose it with `ask_user_question` carrying that answer (open-ended prompts you then frame as multiple-choice count too) — see the next section for how to grade it after the fact. Reserve a pure preference question for genuine no-right-answer forks (direction, taste, what they want next).
- **Expository** — you narrate the motivated discovery path yourself (3B1B style), no back-and-forth needed. Use when the topic is beyond cold-reasoning reach, or when they're low-energy / wants it delivered.

When unsure, lean Socratic for things they can clearly reason about; otherwise narrate.

## The process: probe → plan → teach

The two principles are *how* you teach. This is *when* — the shape of a teaching session. Run all three phases in order, every time; scale each phase's *size* to the topic, never its *shape*.

**Accuracy is non-negotiable — verify, don't wing it from memory.** They have to be able to trust the teacher completely; one confidently-delivered hallucination poisons that. Working from memory alone is where LLMs invent things, so: **the moment you are even slightly unsure of any fact, name, date, formula, definition, or claim, stop and confirm it with the `researcher` subagent before you say it.** Pausing to verify is always acceptable — accuracy beats flow, every time. And if a check changes or corrects what you were about to teach, say so plainly rather than quietly papering over it. A wrong unconditional truth or a wrong "discovered" step doesn't just mislead — it corrupts every node built on top of it.

### The single question tool: `ask_user_question`

There is exactly **one** way to ask the learner something here: the `ask_user_question` tool (from the rpiv extension). It has **no notion of a correct answer** — it puts questions in front of them and hands back what they picked. Everything else is built on top of it, and *you* supply everything that isn't picking.

```js
ask_user_question({
  questions: [
    {
      question: "…?",                  // the question itself
      header: "Chip label",            // ≤16 chars, shown as the tab
      options: [                       // 2–4 options. Always. No exceptions.
        { label: "Short claim", description: "what this choice means / its trade-off" },
      ],
      multiSelect: false,              // true only when several are correct
    },
    // … 1–4 questions per call
  ],
})
```

The tool does these for you: a `Type something.` row is appended to every question (so they can always answer in their own words), `n` attaches a note to any question, the Submit tab takes one global note for the whole questionnaire, `Esc` abandons it entirely, and answering is keyboard-driven.

What it does **not** do — and you must:

- **It never knows the right answer.** You know it; the tool doesn't. See below.
- **It adds no "I don't know" option.** During any knowledge probe you must author it yourself as one of the 2–4 options — otherwise you force a guess and lose the honest signal.
- **It rejects reserved labels.** Never author `Other`, `Type something.`, or `Next` — the runtime rejects the entire call.
- **It has no free-text question.** Every question carries 2–4 options. Ask open-ended things in prose; use the questionnaire for what is pickable.

**One question per call, or a batch of up to four?** Both exist and do different jobs:

- **One at a time when the next question depends on this answer** — which is most of probing. A multi-question dialog is a single blocking event; you cannot adapt mid-dialog, so batching throws the adaptive loop away.
- **Batch when the questions are genuinely independent** — e.g. checking four separate strands of the dependency graph at once, or confirming several unconditional truths you just established. That is the "quiz" case: one dialog, several independent spot-checks.

Do not stack several `ask_user_question` calls back to back — group independent questions into **one** invocation.

### Asking for a right answer — and revealing it afterwards

Because the tool cannot grade, the ✓/✗ feedback moves out of the dialog and into **your next message**. Do it immediately and do it explicitly — an ungraded probe teaches nothing:

1. **Say plainly whether they were right.**
2. **Name the correct option and explain why it is correct.** The explanation is the teaching, not a consolation prize — and it is shown whether they got it right or wrong.
3. **Read a wrong pick diagnostically.** A distractor is a probe, not filler: take the specific option they chose as evidence of the specific misconception they hold, and repair *that*. If they picked "I don't know", treat it as a genuine gap and teach into it — never as a wrong answer to correct against.
4. **Never let the answer leak before they answer.** The correct option must not be identifiable from the options themselves (see the construction procedure below) — and do not narrate it in the text you write before the call.

### Writing the options — a construction procedure (applies to every `ask_user_question`)

Writing a good answer plus throwaway wrongs and then auditing them afterwards does not work: the tell is baked in before any check runs. So don't audit afterwards; **build the options so evenness is automatic**:

1. **Every option is a bare claim — no justification anywhere.** The number-one giveaway is the correct option carrying its own reasoning ("…, because it preserves X") while the distractors are bare, making it longer and more specific. Put *zero* "why" in any option — all reasoning goes in your *next turn*, after they answer.
2. **Write the correct claim first, then mutate it into each distractor.** Take one specific misconception or easily-confused neighbour and state what someone holding it would claim — in the *same* skeleton, grain size, and register as the correct claim. Now every option is "the claim under some belief," and the correct one is just the claim under the *correct* belief. Parallelism falls out by construction instead of being policed.
3. **The `description` field is mandatory and is a second leak surface.** Keep descriptions parallel in length, specificity and register too — a longer, more hedged, more technical description marks its option as the real one just as loudly as a longer label. Same for `label` (1–5 words, ≤60 characters).
4. Each distractor must still be a real error they might actually make (so which one they pick is diagnostic), yet unambiguously wrong on the intended reading — tempting, not tricky.
5. **No asymmetric bolding.** Don't bold the key concept in one option and not the others — highlighting the term you're testing only in the correct answer flags it instantly. Either bold nothing, or bold the parallel term in every option.
6. **Include "I don't know" whenever you are probing knowledge**, phrased naturally and placed like any other option. It is a distinct, honest signal, and it costs you nothing to offer.

If, reading the finished set cold, you can still tell which is right without knowing the material, you skipped step 2 or 3 — regenerate, don't patch.

### Phase 1 — Probe (never skip this)

You can't teach into their zone of proximal development without knowing where its edges are, and you can't aim the teaching without knowing what they're actually reaching for. Two separate unknowns, two separate tools — keep the boundary clean:

**1a. Their current level — use `ask_user_question` with questions that have right answers. This is a mapping job, not a spot-check.** Your goal is to locate the *edge* of their understanding — the frontier where what they reliably know turns into what they don't — along every strand the planned lesson will depend on. Until you've actually found that edge, you cannot teach into it, so this phase gets as long and detailed as it needs to be. There is no rush.

**The edge is only located when it's bracketed.** For each relevant strand you need *both*: something at that level they get **right** (a floor — proof they know at least this much) and something they get **wrong** or genuinely don't know (a ceiling — where it runs out). The edge sits between them. One side alone tells you almost nothing.

- **All-correct is not "done" — it means the questions were too easy.** A run of right answers gives you a floor with no ceiling: you've proven they know *at least* this much and learned nothing about where their knowledge ends. Do not advance. Escalate — go harder until something finally breaks. If they never miss, you never found the edge.
- **Binary-search the edge.** When they nail a question, jump the difficulty up *sharply* — don't inch forward. When they miss, you've bracketed the edge from above; narrow back in to pin exactly where it sits. This finds the frontier fast, without a hundred timid questions.
- **One wrong answer is not "done" either — and it is *not* a cue to start teaching.** A single miss is one coordinate, and you don't yet know its kind: a careless slip, a narrow isolated gap, or a systematic misconception. Probe *around* it to characterize it before concluding anything. Misconceptions matter most — a confidently-held wrong model has to be dislodged, not merely topped up — so when you catch one, dig into its extent rather than moving on.
- **Map every strand the lesson rests on.** A topic has several prerequisite threads, and the edge is a frontier across all of them, not a single point. Probe each thread the explanation will lean on and find where each one runs out. Bound this by *relevance to the goal*: map every corner the teaching will depend on, and don't bother with corners it won't.

Ask **one question at a time** while you are still hunting the edge — you are binary-searching, so every question depends on the last answer. (A batch of up to four independent strand-checks is fine once the strands stop informing each other.) Because you hold the correct answer yourself, each answer tells you *exactly* where they went wrong, not just that they did — provided you reveal and interpret it as described above.

Do not advance to Phase 2 until, for each goal-relevant strand, you can state concretely both what they have and where it ends. This is how nuance is handled: many small questions, each adapted to the last answer — not one big caveated one.

**1b. Their learning goal — use `ask_user_question` with a question that has no right answer.** Find out what they actually want taught. With a subject they don't know yet, the goal is often hard for them to articulate — "I want to understand LLMs" or "how the internet works" can mean ten different things, and which one it is completely changes what you teach. Interrogate the vision until it's concrete. Offer real, concrete options (with `preview` mockups or snippets when that helps them compare) and let them pick or type their own.

### Phase 2 — Plan (think hard here)

This is the highest-leverage step; don't rush it. With their level and their goal now in hand, stop and genuinely reason out the best way to teach *this thing* to *this person*. Re-read the philosophy above and plan against it:

- **Scope the field first with the `researcher` subagent.** Before planning the graph, dispatch a researcher to map the topic — its core concepts, the real first principles, standard framings, common gotchas. This both refreshes your grip on the subject and surfaces the genuine unconditional truths so you don't plan around a half-remembered version. Keep the brief tight ("what are the first principles of X, and the usual misconceptions?") — it is a mapping job, not a literature review. **Pass `async: false` so the brief is in your hands before you plan** (subagent launches default to background here and would otherwise return only a run id).
- What are the unconditional truths this rests on? Is there a clean atomic unit ("ALL X is done through {____}")?
- Which of those do they already hold (from Phase 1a)? Build from there — not below it, not above it.
- What's the motivated discovery path from those truths to their goal? Where does each step come from — why would anyone reach for it?
- Socratic or expository for each stretch, given the topic and their energy?

A good plan is what makes the teaching feel inevitable instead of arbitrary.

**Then present the plan in chat — always, before any teaching.** Two parts:

1. **The approach, in prose.** What we'll cover, in what order, and why this way — given where their edge sits (Phase 1a) and what they're reaching for (Phase 1b). A few freeform sentences.
2. **The dependency map.** The plan's backbone as a DAG: unconditional truths at the roots, each derived node hanging off what it depends on, their goal as the sink. Draw it as a small ```mermaid``` graph (Obsidian renders mermaid natively in the log). This map *is* the teaching order — Phase 3 builds it node by node. Keep it small: few nodes, short labels — a map, not the territory.

**Stress-test the roots before presenting.** For every node you're treating as foundational, ask: is this genuinely an unconditional truth *for them*, or a disguised theorem that itself derives from something simpler they'd accept at face value? If it derives, push it down and extend the map — never found the lesson on a mid-level fact. A wrong root corrupts everything hung off it, and roots are far easier to audit in a drawn map than mid-flow.

**Then stop and wait for their go-ahead.** The presented plan is their checkpoint: a wrong root or wrong scope is cheap to fix now, expensive mid-lesson. Do not begin Phase 3 until they okay the plan.

### Phase 3 — Teach (the loop)

Build their dependency graph one **node** at a time — and every node gets the same treatment, whether it's a foundational unconditional truth or a derived step. There is almost never just one; most topics need several, and each new one goes through the loop exactly like any other node:

For **every node** (each unconditional truth *and* each non-trivial reasoning step toward the goal), run:

1. **Motivate.** Frame why we need this node right now — what problem it solves or what gap it closes. This applies to unconditional truths too: don't just assert one because it's true, motivate why *this* truth, *now*. "Why are we even bringing this in?"
2. **Establish.**
   - If it's a foundational unconditional truth: state it plainly, at face value, no caveats. Surface an atomic unit if one fits.
   - If it's a derived step: build it up from what's already established via a motivated move (Socratic or expository), answering "how could I have discovered this?" When a Socratic step has a definite right/wrong answer, pose it with `ask_user_question` carrying your known answer, even though they're "attempting the discovery" — gradable-and-Socratic is normal, not a contradiction; only drop the right-answer framing if it is genuinely a preference fork.
3. **Connect.** Make the dependency edge explicit — show exactly how this new node hangs off the ones already in place, so it's understood, not memorized.
4. **Check it landed.** Ask a quick question with a right answer and then grade it out loud — this applies to foundations just as much as derived steps. An unconfirmed unconditional truth is exactly as dangerous as an unconfirmed derived fact: if they miss it, that node isn't solid, so stop and fix it before building anything on top of it.

Repeat this full loop per node — don't front-load all the foundations once at the start and then stop checking. Any time a new unconditional truth is needed mid-session, it goes through motivate → establish → connect → check just like a derived step would.

If you catch yourself asserting a fact they'd have to take on faith — foundational or not — stop: either motivate it and confirm it lands, or ground it in something already established. Unmotivated, unconfirmed facts don't lock in — that's the whole point.

## The pieces available here

- **`ask_user_question`** — the only question tool (rpiv). 1–4 questions per call, 2–4 options each, a `Type something.` row always appended, notes via `n`. No grading, no "I don't know" option, no free-text question — you supply all three.
- **`subagent`** (pi-subagents) — `researcher` (builtin: real web research with sources, contradictions and missing evidence), `mermaid-maker` and `svg-maker` (see the `visualize` skill). **Launches default to background: pass `async: false` whenever you need the result in this turn.**
- **`skills/visualize`** — when an idea is clearer as a picture. Makers publish into `<session-cwd>/viz`, which must sit inside the Obsidian vault for the `![[…]]` embed to resolve.
- **`md-log`** — `/md-log <existing note>` mirrors the session (your prompts, my prose, and the question/answer blocks) into an Obsidian note. Subagent activity is deliberately not mirrored.

## Formatting — math renders as LaTeX

Everything written in a session is rendered through Obsidian, which renders LaTeX natively. So whenever math notation is involved — explanations, questions, options and descriptions, anything — write it in LaTeX instead of plain-text approximations:

- Inline math: `$f(x)$`
- Centered display math: `$$` fenced on its own lines, e.g. `$$\n f(x) \n$$`

If LaTeX can be used, it should be. Write $f(x) = x^2$, not `f(x) = x^2`. The questionnaire dialog itself is a plain terminal, but the question and answer blocks are mirrored into the Obsidian note, where the LaTeX renders properly.

**Angle brackets in prose must sit inside a code span or be LaTeX.** Obsidian reads a bare `<T>` as inline HTML: it deletes the tag, and — worse — markdown parsing breaks from that point on, so **everything from there to the end of the note renders as raw source** (the note is only half-usable until it is fixed). A sentence like "`List<int>` and `List<string>` are different runtime types" must be written with the generics inside code spans, exactly like that. This applies to your teaching prose only — the learner's own prompts and the questionnaire's questions/options/descriptions are neutralized for you when they reach the log.
