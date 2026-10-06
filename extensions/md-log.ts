/**
 * md-log — mirror the session to a markdown file for comfortable reading.
 *
 * Designed for long teaching/learning sessions where the terminal is hard on
 * the eyes and markdown/math/code don't render. The linked .md file is meant
 * to be viewed rendered (e.g. in Obsidian), so assistant text with $...$ math,
 * code blocks, and markdown all render natively — no rendering work here.
 *
 * Captures only reading-relevant content:
 *   - user prompts
 *   - assistant text (lesson prose, including embedded `![[viz-*.png|500]]`)
 *   - ask_user_question Q&A blocks
 * Everything else (bash, read, write, subagent, ...) is omitted.
 *
 * ── Local adaptations (this is a port of the upstream md-log) ───────────────
 *
 * 1. **One questionnaire tool, not two.** Upstream logged `ask_user_question`
 *    plus a separate graded `quiz` tool. Here the only questionnaire is
 *    `@juicesharp/rpiv-ask-user-question`'s `ask_user_question`, which carries
 *    1–4 questions per call. Grading is no longer a tool concern: the teacher
 *    states the correct answer in the following assistant turn, so the log just
 *    needs the questions and what was picked.
 * 2. **Questions come from the extension's event bus, not `tool_call`.** rpiv
 *    publishes `rpiv:ask-user:prompt` (channel name is immutable per its
 *    stability policy) after validation passes and just before the dialog is
 *    shown, so the block we write is exactly the payload the user saw — and a
 *    rejected questionnaire never produces a phantom question in the log.
 *    Upstream had to special-case quiz's option shuffling for the same reason;
 *    rpiv does not shuffle, so that whole path is gone.
 * 3. **Answers come from `tool_result` details**, which by then hold rpiv's
 *    envelope: `{ answers: [{ questionIndex, question, kind, answer, selected?,
 *    notes? }], cancelled, globalNote?, error? }`.
 * 4. **Subagents are deliberately not logged.** The learning setup delegates to
 *    pi-subagents (builtin `researcher`, plus `mermaid-maker` / `svg-maker`).
 *    Their transcripts are process-internal and add only noise here; whatever
 *    matters from a subagent reaches the reader through the teacher's own
 *    prose (which is logged) and through the embedded viz PNG.
 * 5. **Text typed for a terminal is HTML-neutralized on the way into markdown.**
 *    rpiv's questions and the learner's own prompts are written for a plain-text
 *    terminal, so a bare `List<int>` is common — and Obsidian reads it as inline
 *    HTML, which by its own documented rules ("HTML blocks must be complete and
 *    cannot contain blank lines within them") tears the block apart so the rest
 *    of the note renders as raw source, all the way to the end of the file. See
 *    `escapeAngles`. Assistant prose is NOT rewritten: that is the model's own
 *    markdown output and is mirrored verbatim, so the `teach` skill instead
 *    requires angle brackets in prose to sit inside code spans.
 *
 * Commands:
 *   /md-log <filepath>  — Link a markdown file and backfill the session.
 *   /md-unlog           — Stop logging.
 *
 * Append-only. No send-back-to-agent functionality (that lived in the old
 * .md-link extension this was modeled on).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

/** The one questionnaire tool in this setup (rpiv-ask-user-question). */
const ASK_TOOL = "ask_user_question";

/**
 * rpiv's public prompt event. The package publishes it on Pi's event bus with
 * `pi.events.emit`. Channel names in the `rpiv:*` namespace are immutable by
 * their stability policy, so a literal is safe and avoids depending on that
 * package's module resolution from this file's location.
 * (`@juicesharp/rpiv-ask-user-question/events` → ASK_USER_PROMPT_EVENT)
 */
const ASK_PROMPT_EVENT = "rpiv:ask-user:prompt";

interface PromptOption {
	label: string;
	description?: string;
	hasPreview?: boolean;
}

interface PromptQuestion {
	question: string;
	header?: string;
	multiSelect?: boolean;
	options?: PromptOption[];
}

interface PromptPayload {
	questions?: PromptQuestion[];
}

interface AskAnswerLine {
	questionIndex?: number;
	question?: string;
	kind?: "option" | "custom" | "multi";
	answer?: string | null;
	selected?: string[];
	notes?: string;
	preview?: string;
}

interface AskDetails {
	answers?: AskAnswerLine[];
	cancelled?: boolean;
	globalNote?: string;
	error?: string;
}

export default function mdLog(pi: ExtensionAPI) {
	let logFile: string | null = null;

	// --- State restoration on session restart ---

	pi.on("session_start", async (_event, ctx) => {
		let lastLinkData: { file: string | null } | undefined;
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type === "custom" && entry.customType === "md-log") {
				lastLinkData = entry.data as { file: string | null } | undefined;
			}
		}
		if (lastLinkData?.file) {
			logFile = lastLinkData.file;
			const theme = ctx.ui.theme;
			ctx.ui.setStatus(
				"md-log",
				theme.fg("accent", "🗒 ") + theme.fg("dim", path.basename(logFile)),
			);
		}
	});

	// --- Serialization: events can fire close together; keep appends ordered ---

	let writeLock: Promise<void> = Promise.resolve();
	function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
		const prev = writeLock;
		let release: () => void;
		writeLock = new Promise<void>((r) => {
			release = r;
		});
		return prev.then(fn).finally(() => release!());
	}

	function appendToFile(text: string): void {
		if (!logFile) return;
		try {
			let current = "";
			if (fs.existsSync(logFile)) {
				current = fs.readFileSync(logFile, "utf-8");
			}
			const prefix = current.trim().length > 0 ? "\n\n" : "";
			fs.writeFileSync(logFile, current + prefix + text + "\n", "utf-8");
		} catch {
			// File may have been deleted externally; ignore.
		}
	}

	// --- Formatting ---

	/**
	 * Neutralize angle brackets in text that was typed for a plain-text terminal
	 * (a questionnaire question/option/answer, or the learner's own prompt), not
	 * authored as markdown for Obsidian.
	 *
	 * Why this is not optional: Obsidian parses a bare `<string>` as inline HTML.
	 * Its help page "HTML content" documents the consequence — *"HTML blocks must
	 * be complete and cannot contain blank lines within them. Blank lines will
	 * break the HTML block."* A questionnaire answer line is followed by a blank
	 * `>` line and then the options, so the HTML block is broken mid-callout and
	 * the renderer falls back to raw source: the options and the answer callout
	 * come out as literal lines starting with `>`. One C# generics question
	 * ("…区分 List<int> 和 List<string>？") is enough to break the rest of the
	 * note.
	 *
	 * Emits HTML entities rather than backslash escapes. Obsidian's help lists
	 * the characters a backslash escapes (asterisk, underscore, hashtag, backtick,
	 * pipe, tilde, and the `.` after a list number) and `<`/`>` are not among
	 * them, while the same page recommends entities such as `&nbsp;`. With `&lt;`
	 * no `<` character ever reaches the file, so the HTML path cannot engage at
	 * all by construction.
	 *
	 * Deliberately left alone: backslash escapes, inline code spans, fenced code
	 * blocks, and $…$ / $$…$$ math. Inside a code span or a fence Obsidian does
	 * not parse HTML, and inside math the engine owns the text — substituting an
	 * entity there would corrupt it. Verified against Obsidian's own editor
	 * grammar (@lezer/markdown): the raw form yields an HTMLTag node, both
	 * escaped forms yield none.
	 */
	function escapeAngles(text: string): string {
		const out: string[] = [];
		let fence: string | null = null;
		for (const line of text.split("\n")) {
			const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
			if (fence) {
				out.push(line);
				if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null;
				continue;
			}
			if (fenceMatch) {
				fence = fenceMatch[1];
				out.push(line);
				continue;
			}
			out.push(escapeAnglesInline(line));
		}
		return out.join("\n");
	}

	function escapeAnglesInline(line: string): string {
		let out = "";
		let i = 0;
		while (i < line.length) {
			const ch = line[i];
			// An existing escape already neutralized the next character.
			if (ch === "\\" && i + 1 < line.length) {
				out += line.slice(i, i + 2);
				i += 2;
				continue;
			}
			// Inline code span: a run of N backticks, closed by the next run of N.
			if (ch === "`") {
				let n = 0;
				while (line[i + n] === "`") n++;
				const ticks = "`".repeat(n);
				const close = line.indexOf(ticks, i + n);
				const end = close === -1 ? line.length : close + n;
				out += line.slice(i, end);
				i = end;
				continue;
			}
			// Math: $$…$$ or $…$. An unmatched single $ is literal prose, not math.
			if (ch === "$") {
				const delim = line.startsWith("$$", i) ? "$$" : "$";
				const close = line.indexOf(delim, i + delim.length);
				if (close !== -1) {
					const end = close + delim.length;
					out += line.slice(i, end);
					i = end;
					continue;
				}
			}
			if (ch === "<" || ch === ">") {
				out += ch === "<" ? "&lt;" : "&gt;";
				i++;
				continue;
			}
			out += ch;
			i++;
		}
		return out;
	}

	function callout(type: string, title: string, bodyLines: string[]): string {
		const lines = [`> [!${type}] ${title}`];
		for (const line of bodyLines) {
			lines.push(line.length === 0 ? ">" : `> ${line}`);
		}
		return lines.join("\n");
	}

	/**
	 * The learner's prompt is typed into the terminal, not authored as markdown
	 * for Obsidian — same contract as the questionnaire, same failure mode: a bare
	 * `List<int>` here breaks the note from this point to the end of the file.
	 *
	 * Skill declarations (`<skill name="…"> …whole SKILL.md… </skill>`) are
	 * system-injected context, not prose, so each is replaced by a real callout
	 * noting the skill loaded — signal without the noise. Escaping and that
	 * substitution happen in ONE pass, escaping only the text between blocks:
	 * escaping the whole string first would turn `<skill …>` into an entity and
	 * the pattern would never match, while adding the marker first (and escaping
	 * after) would neuter the marker into literal `&gt; [!note]` text.
	 */
	function escapeWithSkillMarkers(text: string): string {
		const re = /<skill\b([^>]*)>[\s\S]*?<\/skill>/g;
		let out = "";
		let last = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text)) !== null) {
			out += escapeAngles(text.slice(last, m.index));
			const name = /name="([^"]+)"/.exec(m[1])?.[1];
			out += `> [!note] SKILL loaded: ${name ?? "(unknown)"}`;
			last = m.index + m[0].length;
		}
		return out + escapeAngles(text.slice(last));
	}

	/** Returns "" when there is nothing worth logging. */
	function userBlock(text: string): string {
		const body = escapeWithSkillMarkers(text.trim());
		if (!body.trim()) return "";
		return `> [!quote] YOU\n\n${body}`;
	}

	function assistantBlock(text: string): string {
		return `> [!abstract] PI\n\n${text}`;
	}

	/**
	 * One callout per question. The header (rpiv's chip label) becomes the
	 * title, the options are numbered exactly as the dialog numbers them.
	 */
	/**
	 * One callout per question. The header (rpiv's chip label) becomes the
	 * title, the options are numbered exactly as the dialog numbers them, and
	 * each option carries its description inline after an em dash — the log is
	 * read back later, and the description is where the option's real content
	 * usually lives. Descriptions are collapsed to a single line so the item
	 * stays one markdown list entry and can't break the blockquote.
	 */
	function questionCallout(header: string | undefined, q: PromptQuestion): string {
		const body: string[] = [];
		for (const line of escapeAngles(q.question).split("\n")) body.push(line);
		const options = q.options ?? [];
		if (options.length > 0) {
			body.push("");
			options.forEach((o, i) => {
				const desc = o.description?.replace(/\s*\n\s*/g, " ").trim();
				const suffix = desc ? ` — ${escapeAngles(desc)}` : "";
				body.push(`${i + 1}. ${escapeAngles(o.label)}${suffix}`);
			});
		}
		const suffix = q.multiSelect ? " (multi-select)" : "";
		const title = `Question — ${escapeAngles(header || "Question")}${suffix}`;
		return callout("question", title, body);
	}

	/** Render an answer line: label for options, the typed text for custom. */
	function answerLineText(a: AskAnswerLine): string {
		if (a.kind === "multi") return (a.selected ?? []).map(escapeAngles).join(", ") || "(none)";
		if (a.kind === "custom") return `Type something.: ${escapeAngles(a.answer ?? "")}`;
		return escapeAngles(a.answer ?? "(none)");
	}

	function answerCalloutAsk(details: AskDetails | undefined): string {
		// rpiv marks a rejection as BOTH cancelled and error is set, so the error
		// branch has to win — otherwise a rejected questionnaire (reserved label,
		// no UI, failed dialog load, …) would read as if the user skipped it.
		if (details?.error) {
			return callout("warning", "Question — unavailable", [String(details.error)]);
		}
		if (details?.cancelled) {
			const body = ["(user skipped)"];
			if (details?.globalNote) body.push("", `Global note: ${escapeAngles(details.globalNote)}`);
			return callout("warning", "Question — cancelled", body);
		}

		const answers = details?.answers ?? [];
		const body: string[] = [];
		if (answers.length === 0) body.push("(no answer)");
		for (const a of answers) {
			// rpiv's questionIndex is 0-based; the callouts above are 1-based.
			body.push(`${(a.questionIndex ?? 0) + 1}. ${answerLineText(a)}`);
			// Only present (in details) when the user actually wrote one.
			if (a.notes) {
				const noteLines = escapeAngles(String(a.notes)).split("\n");
				body.push(`   Note: ${noteLines[0]}`);
				for (const line of noteLines.slice(1)) body.push(`   ${line}`);
			}
		}
		if (details?.globalNote) {
			body.push("", `Global note: ${escapeAngles(details.globalNote)}`);
		}
		return callout("example", "Answer", body);
	}

	// --- Live question blocks ---

	// Fired by rpiv after validation passes and immediately before the dialog
	// blocks for input, so whatever we write here is what the user is about to
	// see. `pi.events.on` subscriptions are tracked by Pi per extension runtime
	// and dropped on reload, so subscribing here is reload-safe.
	pi.events.on(ASK_PROMPT_EVENT, (payload: unknown) => {
		if (!logFile) return;
		const questions = (payload as PromptPayload | undefined)?.questions;
		if (!Array.isArray(questions) || questions.length === 0) return;
		const blocks = questions.map((q) => questionCallout(q.header, q));
		void withLock(() => appendToFile(blocks.join("\n\n")));
	});

	// --- Event handlers ---

	pi.on("message_end", async (event, _ctx) => {
		if (!logFile) return;
		const msg = event.message;
		if (!msg || !("role" in msg)) return;

		if (msg.role === "user") {
			const text = typeof msg.content === "string"
				? msg.content
				: Array.isArray(msg.content)
					? msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n")
					: "";
			const block = userBlock(text);
			if (!block) return;
			await withLock(() => appendToFile(block));
			return;
		}

		if (msg.role === "assistant") {
			const textParts = (msg.content || [])
				.filter((c: any) => c.type === "text")
				.map((c: any) => (c.text as string).trim())
				.filter((t: string) => t.length > 0);
			if (textParts.length === 0) return;
			await withLock(() => appendToFile(assistantBlock(textParts.join("\n\n"))));
			return;
		}
		// toolResult messages are handled by the tool_result event (for the
		// questionnaire). Subagent runs are intentionally not mirrored.
	});

	pi.on("tool_result", async (event, _ctx) => {
		if (!logFile) return;
		if (event.toolName !== ASK_TOOL) return;
		// Nested calls issued by another tool (e.g. a codemode script) never
		// appear in the transcript, so they stay out of the log too.
		if (event.parentToolCallId) return;
		await withLock(() => appendToFile(answerCalloutAsk(event.details as AskDetails | undefined)));
	});

	// --- Commands ---

	pi.registerCommand("md-log", {
		description: "Mirror the session to a markdown file (backfills history)",
		handler: async (args, ctx) => {
			const filepath = args.trim();
			if (!filepath) {
				ctx.ui.notify("Usage: /md-log <filepath>", "warning");
				return;
			}
			if (typeof ctx.isIdle === "function" && !ctx.isIdle()) {
				ctx.ui.notify("Wait for the agent to finish before linking.", "warning");
				return;
			}

			const resolved = path.isAbsolute(filepath) ? filepath : path.resolve(ctx.cwd, filepath);

			// The file must already exist — /md-log links into an existing note,
			// it never creates one. This avoids silently scattering new files
			// (and parent directories) around the vault from a typo'd path.
			if (!fs.existsSync(resolved)) {
				ctx.ui.notify(`File does not exist: ${resolved}`, "error");
				return;
			}
			if (!fs.statSync(resolved).isFile()) {
				ctx.ui.notify(`Not a file: ${resolved}`, "error");
				return;
			}

			logFile = resolved;
			pi.appendEntry("md-log", { file: resolved });

			// Backfill the active branch.
			const written = backfill(ctx);

			const theme = ctx.ui.theme;
			ctx.ui.setStatus(
				"md-log",
				theme.fg("accent", "🗒 ") + theme.fg("dim", path.basename(resolved)),
			);
			ctx.ui.notify(`Linked: ${resolved} (${written} entries backfilled)`, "success");
		},
	});

	pi.registerCommand("md-unlog", {
		description: "Stop mirroring the session to a markdown file",
		handler: async (_args, ctx) => {
			if (!logFile) {
				ctx.ui.notify("No file linked", "warning");
				return;
			}
			const name = path.basename(logFile);
			logFile = null;
			pi.appendEntry("md-log", { file: null });
			ctx.ui.setStatus("md-log", undefined);
			ctx.ui.notify(`Unlinked: ${name}`, "info");
		},
	});

	// --- Backfill ---

	function backfill(ctx: any): number {
		if (!logFile) return 0;
		const entries: any[] = ctx.sessionManager.getEntries();
		if (entries.length === 0) return 0;

		const byId = new Map<string, any>();
		for (const e of entries) if (e.id) byId.set(e.id, e);

		// Active leaf = last entry that has an id (skip the session header).
		let leaf: any = null;
		for (let i = entries.length - 1; i >= 0; i--) {
			if (entries[i].id) {
				leaf = entries[i];
				break;
			}
		}
		if (!leaf) return 0;

		// Walk parent chain to root.
		const chain: any[] = [];
		let cur: any = leaf;
		const seen = new Set<string>();
		while (cur && cur.id && !seen.has(cur.id)) {
			seen.add(cur.id);
			chain.push(cur);
			cur = cur.parentId ? byId.get(cur.parentId) : null;
		}
		chain.reverse();

		// Track questionnaire args from assistant messages so we can pair them
		// with their results. rpiv does not shuffle options, so the authored
		// order in the tool call IS the order the user saw — no extra plumbing
		// needed (upstream needed it for quiz's shuffle).
		const askArgs = new Map<string, PromptQuestion[]>();

		const blocks: string[] = [];
		let count = 0;
		for (const entry of chain) {
			if (entry.type !== "message") continue;
			const msg = entry.message;
			if (!msg || !("role" in msg)) continue;
			count++;

			if (msg.role === "user") {
				const text = typeof msg.content === "string"
					? msg.content
					: Array.isArray(msg.content)
						? msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n")
						: "";
				const block = userBlock(text);
				if (block) blocks.push(block);
				continue;
			}

			if (msg.role === "assistant") {
				for (const c of msg.content || []) {
					if (c.type === "toolCall" && c.name === ASK_TOOL) {
						const questions = (c.arguments?.questions ?? []) as PromptQuestion[];
						if (questions.length > 0) askArgs.set(c.id, questions);
					}
				}
				const textParts = (msg.content || [])
					.filter((c: any) => c.type === "text")
					.map((c: any) => (c.text as string).trim())
					.filter((t: string) => t.length > 0);
				if (textParts.length > 0) blocks.push(assistantBlock(textParts.join("\n\n")));
				continue;
			}

			if (msg.role === "toolResult") {
				if (msg.toolName !== ASK_TOOL) continue;
				const questions = askArgs.get(msg.toolCallId);
				if (questions) {
					blocks.push(questions.map((q) => questionCallout(q.header, q)).join("\n\n"));
				}
				blocks.push(answerCalloutAsk(msg.details as AskDetails | undefined));
				continue;
			}
		}

		if (blocks.length > 0) {
			try {
				fs.writeFileSync(logFile, blocks.join("\n\n") + "\n", "utf-8");
			} catch {
				// ignore
			}
		}
		return count;
	}
}
