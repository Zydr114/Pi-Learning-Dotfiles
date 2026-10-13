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
 *   - quiz / ask_user_question Q&A blocks
 * Other tools (bash, read, write, edit, subagent, ...) are omitted.
 *
 * Quiz/ask questions are written BEFORE the user answers (on tool_call /
 * tool_execution_update for quiz shuffle), so the reader sees the question
 * appear live; the answer + feedback are appended on tool_result.
 *
 * All user text and question/option texts are angle-bracket neutralized via
 * escapeAngles so bare generics like `List<int>` won't break Obsidian HTML parsing.
 *
 * Commands:
 *   /md-log <filepath>  — Link a markdown file and backfill the session.
 *   /md-unlog           — Stop logging.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

const QA_TOOLS = new Set(["quiz", "ask_user_question"]);

export default function mdLog(pi: ExtensionAPI) {
	let logFile: string | null = null;

	// Simple write queue to serialize file writes and avoid interleaving.
	let writeQueue = Promise.resolve();
	function withLock(fn: () => Promise<void>): Promise<void> {
		writeQueue = writeQueue.then(fn).catch((err) => {
			console.error("[md-log] write failed:", err);
		});
		return writeQueue;
	}

	async function appendToFile(text: string) {
		if (!logFile) return;
		try {
			await fs.promises.appendFile(logFile, `${text}\n\n`, "utf8");
		} catch (err) {
			console.error("[md-log] append error:", err);
		}
	}

	// Restore state on session resume.
	pi.on("session_start", async (_event, ctx) => {
		let lastLinkData: { file: string | null } | undefined;
		const entries = ctx.sessionManager?.getEntries?.() ?? [];
		for (const entry of entries) {
			if (entry.type === "custom" && entry.customType === "md-log") {
				lastLinkData = entry.data as { file: string | null } | undefined;
			}
		}
		if (lastLinkData?.file && fs.existsSync(lastLinkData.file)) {
			logFile = lastLinkData.file;
			const theme = ctx.ui.theme;
			ctx.ui.setStatus(
				"md-log",
				theme.fg("accent", "🗒 ") + theme.fg("dim", path.basename(logFile)),
			);
		}
	});

	// --- Formatting & Escaping ---

	/**
	 * Neutralize angle brackets in text that was typed for a plain-text terminal
	 * (a questionnaire question/option/answer, or the learner's own prompt), not
	 * authored as markdown for Obsidian.
	 *
	 * Preserves inline code spans, code fences, and LaTeX math.
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
			if (ch === "\\" && i + 1 < line.length) {
				out += line.slice(i, i + 2);
				i += 2;
				continue;
			}
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

	function userBlock(text: string): string {
		const body = escapeWithSkillMarkers(text.trim());
		if (!body.trim()) return "";
		return `> [!quote] YOU\n\n${body}`;
	}

	function assistantBlock(text: string): string {
		return `> [!abstract] PI\n\n${text}`;
	}

	function optionsList(options: Array<{ label: string; description?: string }>): string[] {
		return options.map((o, i) => {
			const desc = o.description?.replace(/\s*\n\s*/g, " ").trim();
			const suffix = desc ? ` — ${escapeAngles(desc)}` : "";
			return `${i + 1}. ${escapeAngles(o.label)}${suffix}`;
		});
	}

	function questionCallout(
		label: string,
		question: string,
		context: string | undefined,
		options: Array<{ label: string; description?: string }>,
	): string {
		const body: string[] = [];
		for (const line of escapeAngles(question).split("\n")) body.push(line);
		if (context) {
			body.push("");
			for (const line of escapeAngles(context).split("\n")) body.push(line);
		}
		if (options.length > 0) {
			body.push("");
			body.push(...optionsList(options));
		}
		return callout("question", `${label}`, body);
	}

	function answerCalloutQuiz(details: any): string {
		const status = details?.status;
		if (status === "cancelled") {
			return callout("warning", "Quiz — cancelled", ["(user skipped)"]);
		}
		if (status === "unavailable") {
			return callout("warning", "Quiz — unavailable", [details?.message || ""]);
		}
		const dontKnow = details?.dontKnow === true;
		const correct = details?.correct === true;
		const type = dontKnow ? "example" : correct ? "success" : "failure";
		const title = dontKnow
			? "Quiz — I don't know"
			: correct
				? "Quiz — correct ✓"
				: "Quiz — incorrect ✗";
		const body: string[] = [];

		if (dontKnow) {
			body.push("Your answer: I don't know");
		} else {
			const answers: any[] = details?.answers || [];
			const sel = answers.map((a) => `${a.index}. ${escapeAngles(a.label)}`).join(", ") || "(none)";
			body.push(`Your answer: ${sel}`);
		}

		const correctIndices: number[] = details?.correctIndices || [];
		const correctStr = correctIndices.map((i) => `${i}`).join(", ");
		if (correctStr) {
			body.push(`Correct answer: ${correctStr}`);
		}

		if (details?.note) {
			body.push("");
			const noteLines = escapeAngles(String(details.note)).split("\n");
			body.push(`Note: ${noteLines[0]}`);
			for (let i = 1; i < noteLines.length; i++) body.push(noteLines[i]);
		}

		if (details?.explanation) {
			body.push("");
			for (const line of escapeAngles(String(details.explanation)).split("\n")) body.push(line);
		}
		return callout(type, title, body);
	}

	function answerCalloutAsk(details: any): string {
		const status = details?.status;
		if (status === "cancelled") {
			return callout("warning", "Question — cancelled", ["(user skipped)"]);
		}
		if (status === "unavailable") {
			return callout("warning", "Question — unavailable", [details?.message || ""]);
		}
		const answers: any[] = details?.answers || [];
		const body: string[] = answers.map((a) => {
			if (a.type === "other") return `Other: ${escapeAngles(a.label)}`;
			if (a.type === "text") return escapeAngles(a.label);
			return `${a.index}. ${escapeAngles(a.label)}`;
		});
		if (body.length === 0) body.push("(no answer)");
		return callout("example", "Answer", body);
	}

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
	});

	// ask_user_question never shuffles its options, so the tool_call args are
	// already the true display order.
	pi.on("tool_call", async (event, _ctx) => {
		if (!logFile) return;
		const toolName = (event as any).toolName;
		if (toolName !== "ask_user_question") return;
		const input = (event as any).input || {};
		const question: string = input.question || "";
		const context: string | undefined = input.details?.trim() || undefined;
		const options: Array<{ label: string; description?: string }> = Array.isArray(input.options) ? input.options : [];
		const block = questionCallout("Question", question, context, options);
		await withLock(() => appendToFile(block));
	});

	// quiz DOES shuffle its options inside execute(), so tool_call args are pre-shuffle.
	// quiz emits onUpdate() with the post-shuffle order before blocking on user answer.
	const loggedQuizQuestion = new Set<string>();
	pi.on("tool_execution_update", async (event, _ctx) => {
		if (!logFile) return;
		const toolName = (event as any).toolName;
		if (toolName !== "quiz") return;
		const toolCallId = (event as any).toolCallId;
		if (loggedQuizQuestion.has(toolCallId)) return;
		const shuffled = (event as any).partialResult?.details?.options as Array<{ index: number; label: string; description?: string }> | undefined;
		if (!shuffled || shuffled.length === 0) return;
		loggedQuizQuestion.add(toolCallId);
		const input = (event as any).args || {};
		const question: string = input.question || "";
		const context: string | undefined = input.details?.trim() || undefined;
		const options = shuffled.map((o) => ({ label: o.label, description: o.description }));
		const block = questionCallout("Quiz", question, context, options);
		await withLock(() => appendToFile(block));
	});

	pi.on("tool_result", async (event, _ctx) => {
		if (!logFile) return;
		const toolName = (event as any).toolName;
		if (!QA_TOOLS.has(toolName)) return;
		const details = (event as any).details;
		const block = toolName === "quiz"
			? answerCalloutQuiz(details)
			: answerCalloutAsk(details);
		await withLock(() => appendToFile(block));
	});

	// --- Commands ---

	pi.registerCommand("md-log", {
		description: "Mirror the session to a markdown file (backfills history)",
		handler: async (args, ctx: any) => {
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
		handler: async (_args, ctx: any) => {
			if (!logFile) {
				ctx.ui.notify("No markdown file is currently linked.", "warning");
				return;
			}
			const prev = logFile;
			logFile = null;
			pi.appendEntry("md-log", { file: null });
			ctx.ui.setStatus("md-log", undefined);
			ctx.ui.notify(`Unlinked: ${prev}`, "info");
		},
	});

	// --- Backfill ---

	function backfill(ctx: any): number {
		if (!logFile) return 0;

		const branch = ctx.sessionManager.getBranch();
		const messages = ctx.sessionManager.getEntries();
		const entryMap = new Map<string, any>();
		for (const e of messages) {
			if (e.id) entryMap.set(e.id, e);
		}

		const chain: any[] = [];
		let currentId: string | null = branch;
		while (currentId) {
			const entry = entryMap.get(currentId);
			if (!entry) break;
			chain.push(entry);
			currentId = entry.parentId || null;
		}
		chain.reverse();

		const toolCallArgs = new Map<string, { name: string; args: any }>();
		const blocks: string[] = [];
		let count = 0;

		for (const entry of chain) {
			const msg = entry.message;
			if (!msg || !("role" in msg)) continue;

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
					if (c.type === "toolCall" && QA_TOOLS.has(c.name)) {
						toolCallArgs.set(c.id, { name: c.name, args: c.arguments });
					}
				}
				const textParts = (msg.content || [])
					.filter((c: any) => c.type === "text")
					.map((c: any) => (c.text as string).trim())
					.filter((t: string) => t.length > 0);
				if (textParts.length > 0) {
					blocks.push(assistantBlock(textParts.join("\n\n")));
				}
				continue;
			}

			if (msg.role === "toolResult") {
				if (!QA_TOOLS.has(msg.toolName)) continue;
				const tc = toolCallArgs.get(msg.toolCallId);
				if (tc) {
					const a = tc.args || {};
					const label = tc.name === "quiz" ? "Quiz" : "Question";
					const shuffled = msg.toolName === "quiz"
						? (msg.details?.options as Array<{ index: number; label: string; description?: string }> | undefined)
						: undefined;
					const options = shuffled && shuffled.length > 0
						? shuffled.map((o) => ({ label: o.label, description: o.description }))
						: (Array.isArray(a.options) ? a.options : []);
					blocks.push(questionCallout(label, a.question || "", a.details?.trim() || undefined, options));
				}
				if (msg.toolName === "quiz") {
					blocks.push(answerCalloutQuiz(msg.details));
				} else {
					blocks.push(answerCalloutAsk(msg.details));
				}
				continue;
			}
		}

		if (blocks.length > 0) {
			count = blocks.length;
			void withLock(() => appendToFile(blocks.join("\n\n")));
		}

		return count;
	}
}
