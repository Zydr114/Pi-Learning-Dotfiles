/**
 * learn-memory — Dedicated Learning Memory & State Engine for pi-learn.
 *
 * Implements:
 * 1. Course storage: courses/<course_id>/{ROADMAP.md, MASTERY.md, evidence.jsonl}
 * 2. L0 Active Snapshot injection via before_agent_start
 * 3. Automatic evidence capture from quiz completions via tool_result
 * 4. Structured tools: learn_save_roadmap, learn_get_context, learn_update_checkpoint,
 *    learn_list_courses, learn_switch_course
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// ── Directory & Path Resolution ─────────────────────────────────────────────

function getMemoryDir(): string {
	if (process.env.PI_MEMORY_DIR) return process.env.PI_MEMORY_DIR;
	return path.join(os.homedir(), ".pi/profiles/learning/memory");
}

const MEMORY_DIR = getMemoryDir();
const COURSES_DIR = path.join(MEMORY_DIR, "courses");
const ACTIVE_FILE = path.join(MEMORY_DIR, "active.json");

function ensureDirs() {
	if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
	if (!fs.existsSync(COURSES_DIR)) fs.mkdirSync(COURSES_DIR, { recursive: true });
}

function getCourseDir(courseId: string): string {
	return path.join(COURSES_DIR, courseId);
}

// ── Data Interfaces ─────────────────────────────────────────────────────────

interface ActiveState {
	activeCourseId?: string;
	activeUnitId?: string;
	updatedAt?: string;
}

interface RoadmapUnitMeta {
	id: string;
	title: string;
	requires: string[];
}

interface RoadmapMeta {
	schema: number;
	course_id: string;
	title: string;
	units: RoadmapUnitMeta[];
}

interface MisconceptionRecord {
	id: string;
	description?: string;
	status: "addressing" | "resolved";
}

interface LessonCheckpoint {
	phase?: "motivate" | "establish" | "connect" | "check" | "review";
	covered?: string[];
	pending?: string[];
	misconceptions?: MisconceptionRecord[];
	nextAction?: string;
}

interface MasteryUnitState {
	id: string;
	title?: string;
	workflow: "pending" | "active" | "paused" | "completed";
	mastery: "unknown" | "emerging" | "consolidating" | "mastered";
	checkpoint?: LessonCheckpoint;
	evidenceSummary?: string;
}

interface EvidenceRecord {
	id: string;
	timestamp: string;
	course_id: string;
	unit_id: string;
	type: "quiz" | "explanation" | "transfer" | "hint" | "assessment";
	outcome?: "correct" | "incorrect" | "unknown" | "adequate";
	hint_level?: number;
	note?: string;
	question?: string;
	correctIndices?: number[];
	answers?: Array<{ index: number; label: string }>;
	details?: unknown;
}

// ── Serialization & Parsing Utilities ───────────────────────────────────────

function parseSimpleYamlFrontmatter(text: string): { frontmatter: Record<string, any>; body: string } {
	const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) return { frontmatter: {}, body: text };
	const rawYaml = match[1];
	const body = match[2];

	const frontmatter: Record<string, any> = {};
	const lines = rawYaml.split("\n");
	let currentListKey: string | null = null;
	let currentList: any[] = [];
	let inUnits = false;
	let currentUnit: any = null;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		if (trimmed === "units:") {
			inUnits = true;
			currentListKey = "units";
			frontmatter.units = [];
			continue;
		}

		if (inUnits) {
			if (line.startsWith("  - id:")) {
				currentUnit = { id: line.replace("  - id:", "").trim(), requires: [] };
				frontmatter.units.push(currentUnit);
				continue;
			}
			if (currentUnit && line.startsWith("    title:")) {
				currentUnit.title = line.replace("    title:", "").trim().replace(/^["']|["']$/g, "");
				continue;
			}
			if (currentUnit && line.startsWith("    requires:")) {
				const reqStr = line.replace("    requires:", "").trim();
				const m = reqStr.match(/\[(.*)\]/);
				if (m) {
					currentUnit.requires = m[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
				}
				continue;
			}
			if (!line.startsWith(" ")) {
				inUnits = false;
			}
		}

		const kvMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
		if (kvMatch) {
			const k = kvMatch[1].trim();
			let v = kvMatch[2].trim().replace(/^["']|["']$/g, "");
			if (v === "true") v = true as any;
			else if (v === "false") v = false as any;
			else if (!isNaN(Number(v)) && v !== "") v = Number(v) as any;
			frontmatter[k] = v;
		}
	}

	return { frontmatter, body };
}

function formatRoadmapFile(meta: RoadmapMeta, bodyMarkdown: string): string {
	const lines: string[] = ["---", `schema: ${meta.schema || 1}`, `course_id: ${meta.course_id}`, `title: "${meta.title}"`, "units:"];
	for (const u of meta.units || []) {
		lines.push(`  - id: ${u.id}`);
		lines.push(`    title: "${u.title}"`);
		const reqs = (u.requires || []).map((r) => `"${r}"`).join(", ");
		lines.push(`    requires: [${reqs}]`);
	}
	lines.push("---", "", bodyMarkdown.trim(), "");
	return lines.join("\n");
}

function formatMasteryFile(courseId: string, revision: number, activeUnitId: string | undefined, units: MasteryUnitState[], recentEvidence: string[]): string {
	const lines: string[] = [
		"---",
		`course_id: ${courseId}`,
		`revision: ${revision}`,
		`active_unit: ${activeUnitId || ""}`,
		"---",
		"",
		"# 认知掌握状态",
		"",
	];

	for (const u of units) {
		lines.push(`## ${u.id} · ${u.title || u.id}`);
		lines.push(`- **Workflow**: ${u.workflow}`);
		lines.push(`- **Mastery**: ${u.mastery}`);
		if (u.checkpoint) {
			lines.push("- **Checkpoint**:");
			if (u.checkpoint.phase) lines.push(`  - Phase: ${u.checkpoint.phase}`);
			if (u.checkpoint.covered?.length) lines.push(`  - Covered: [${u.checkpoint.covered.join(", ")}]`);
			if (u.checkpoint.pending?.length) lines.push(`  - Pending: [${u.checkpoint.pending.join(", ")}]`);
			if (u.checkpoint.misconceptions?.length) {
				lines.push("  - Misconceptions:");
				for (const m of u.checkpoint.misconceptions) {
					lines.push(`    - ${m.id} (${m.status}): ${m.description || ""}`);
				}
			}
			if (u.checkpoint.nextAction) lines.push(`  - Next Action: ${u.checkpoint.nextAction}`);
		}
		if (u.evidenceSummary) {
			lines.push(`- **Evidence**: ${u.evidenceSummary}`);
		}
		lines.push("");
	}

	if (recentEvidence.length > 0) {
		lines.push("## 最近学习记录");
		for (const rec of recentEvidence.slice(-8)) {
			lines.push(`- ${rec}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

// ── Evidence & State Store (Single Writer Queue) ────────────────────────────

class LearningStore {
	private writeQueue = Promise.resolve();

	private withLock<T>(fn: () => Promise<T>): Promise<T> {
		const next = this.writeQueue.then(fn);
		this.writeQueue = next.then(() => {}, () => {});
		return next;
	}

	async getActive(): Promise<ActiveState> {
		ensureDirs();
		if (!fs.existsSync(ACTIVE_FILE)) return {};
		try {
			const raw = await fs.promises.readFile(ACTIVE_FILE, "utf8");
			return JSON.parse(raw);
		} catch {
			return {};
		}
	}

	private async rawWriteActive(state: ActiveState): Promise<void> {
		ensureDirs();
		state.updatedAt = new Date().toISOString();
		await fs.promises.writeFile(ACTIVE_FILE, JSON.stringify(state, null, 2), "utf8");
	}

	async setActive(state: ActiveState): Promise<void> {
		return this.withLock(async () => {
			await this.rawWriteActive(state);
		});
	}

	async saveRoadmap(meta: RoadmapMeta, bodyMarkdown: string, activate = false): Promise<void> {
		return this.withLock(async () => {
			ensureDirs();
			const cdir = getCourseDir(meta.course_id);
			if (!fs.existsSync(cdir)) fs.mkdirSync(cdir, { recursive: true });

			const rpath = path.join(cdir, "ROADMAP.md");
			const content = formatRoadmapFile(meta, bodyMarkdown);
			await fs.promises.writeFile(rpath, content, "utf8");

			// Ensure MASTERY.md exists
			const mpath = path.join(cdir, "MASTERY.md");
			if (!fs.existsSync(mpath)) {
				const initialUnits: MasteryUnitState[] = (meta.units || []).map((u, i) => ({
					id: u.id,
					title: u.title,
					workflow: i === 0 ? "active" : "pending",
					mastery: "unknown",
				}));
				const initialActive = initialUnits[0]?.id;
				const masteryText = formatMasteryFile(meta.course_id, 1, initialActive, initialUnits, []);
				await fs.promises.writeFile(mpath, masteryText, "utf8");
			}

			// Ensure evidence.jsonl exists
			const epath = path.join(cdir, "evidence.jsonl");
			if (!fs.existsSync(epath)) {
				await fs.promises.writeFile(epath, "", "utf8");
			}

			if (activate) {
				const active = await this.getActive();
				active.activeCourseId = meta.course_id;
				if (!active.activeUnitId && meta.units?.[0]) {
					active.activeUnitId = meta.units[0].id;
				}
				await this.rawWriteActive(active);
			}
		});
	}

	async getRoadmap(courseId: string): Promise<{ meta: RoadmapMeta; body: string } | null> {
		const rpath = path.join(getCourseDir(courseId), "ROADMAP.md");
		if (!fs.existsSync(rpath)) return null;
		const raw = await fs.promises.readFile(rpath, "utf8");
		const { frontmatter, body } = parseSimpleYamlFrontmatter(raw);
		return {
			meta: {
				schema: frontmatter.schema || 1,
				course_id: frontmatter.course_id || courseId,
				title: frontmatter.title || courseId,
				units: frontmatter.units || [],
			},
			body,
		};
	}

	async getMastery(courseId: string): Promise<string | null> {
		const mpath = path.join(getCourseDir(courseId), "MASTERY.md");
		if (!fs.existsSync(mpath)) return null;
		return fs.promises.readFile(mpath, "utf8");
	}

	async appendEvidence(record: EvidenceRecord): Promise<void> {
		return this.withLock(async () => {
			const cdir = getCourseDir(record.course_id);
			if (!fs.existsSync(cdir)) fs.mkdirSync(cdir, { recursive: true });
			const epath = path.join(cdir, "evidence.jsonl");
			const line = JSON.stringify(record) + "\n";
			await fs.promises.appendFile(epath, line, "utf8");

			// Update recent summary in MASTERY.md
			const mpath = path.join(cdir, "MASTERY.md");
			if (fs.existsSync(mpath)) {
				const raw = await fs.promises.readFile(mpath, "utf8");
				const summaryLine = `${record.timestamp.slice(0, 16)} | ${record.unit_id} | ${record.type}:${record.outcome || "recorded"}${record.note ? ` | Note: ${record.note}` : ""}`;
				// Append to recent records if section exists
				if (raw.includes("## 最近学习记录")) {
					const updated = raw.replace("## 最近学习记录", `## 最近学习记录\n- ${summaryLine}`);
					await fs.promises.writeFile(mpath, updated, "utf8");
				} else {
					await fs.promises.appendFile(mpath, `\n## 最近学习记录\n- ${summaryLine}\n`, "utf8");
				}
			}
		});
	}

	async updateCheckpoint(courseId: string, unitId: string, updates: {
		workflow?: MasteryUnitState["workflow"];
		mastery?: MasteryUnitState["mastery"];
		checkpoint?: LessonCheckpoint;
	}): Promise<void> {
		return this.withLock(async () => {
			const cdir = getCourseDir(courseId);
			const mpath = path.join(cdir, "MASTERY.md");
			if (!fs.existsSync(mpath)) return;

			let content = await fs.promises.readFile(mpath, "utf8");
			// Replace or append unit block
			const unitHeaderRegex = new RegExp(`##\\s+${unitId}\\b[^\n]*`, "i");
			const match = content.match(unitHeaderRegex);

			if (match) {
				const startIdx = match.index!;
				const nextHeaderIdx = content.indexOf("\n## ", startIdx + match[0].length);
				const endIdx = nextHeaderIdx === -1 ? content.indexOf("\n# ", startIdx + match[0].length) : nextHeaderIdx;
				const realEndIdx = endIdx === -1 ? content.length : endIdx;

				let unitBlock = `## ${unitId}\n`;
				if (updates.workflow) unitBlock += `- **Workflow**: ${updates.workflow}\n`;
				if (updates.mastery) unitBlock += `- **Mastery**: ${updates.mastery}\n`;
				if (updates.checkpoint) {
					unitBlock += `- **Checkpoint**:\n`;
					if (updates.checkpoint.phase) unitBlock += `  - Phase: ${updates.checkpoint.phase}\n`;
					if (updates.checkpoint.covered?.length) unitBlock += `  - Covered: [${updates.checkpoint.covered.join(", ")}]\n`;
					if (updates.checkpoint.pending?.length) unitBlock += `  - Pending: [${updates.checkpoint.pending.join(", ")}]\n`;
					if (updates.checkpoint.misconceptions?.length) {
						unitBlock += `  - Misconceptions:\n`;
						for (const m of updates.checkpoint.misconceptions) {
							unitBlock += `    - ${m.id} (${m.status}): ${m.description || ""}\n`;
						}
					}
					if (updates.checkpoint.nextAction) unitBlock += `  - Next Action: ${updates.checkpoint.nextAction}\n`;
				}

				content = content.slice(0, startIdx) + unitBlock.trim() + "\n\n" + content.slice(realEndIdx).trimStart();
				await fs.promises.writeFile(mpath, content, "utf8");
			}

			// Update active unit in active.json
			if (updates.workflow === "active") {
				const active = await this.getActive();
				active.activeCourseId = courseId;
				active.activeUnitId = unitId;
				await this.rawWriteActive(active);
			}
		});
	}

	async listCourses(): Promise<Array<{ id: string; title: string; active: boolean; unitCount: number }>> {
		ensureDirs();
		const entries = await fs.promises.readdir(COURSES_DIR, { withFileTypes: true });
		const active = await this.getActive();
		const result: Array<{ id: string; title: string; active: boolean; unitCount: number }> = [];

		for (const ent of entries) {
			if (!ent.isDirectory()) continue;
			const cid = ent.name;
			const rdata = await this.getRoadmap(cid);
			result.push({
				id: cid,
				title: rdata?.meta.title || cid,
				active: active.activeCourseId === cid,
				unitCount: rdata?.meta.units.length || 0,
			});
		}

		return result;
	}

	async buildL0Snapshot(): Promise<string | null> {
		const active = await this.getActive();
		if (!active.activeCourseId) return null;

		const rdata = await this.getRoadmap(active.activeCourseId);
		if (!rdata) return null;

		const unitId = active.activeUnitId || rdata.meta.units[0]?.id;
		const unitMeta = rdata.meta.units.find((u) => u.id === unitId);

		let checkpointInfo = "未开始教学";
		const mpath = path.join(getCourseDir(active.activeCourseId), "MASTERY.md");
		if (fs.existsSync(mpath)) {
			const mtext = await fs.promises.readFile(mpath, "utf8");
			if (unitId) {
				const regex = new RegExp(`##\\s+${unitId}\\b([\\s\\S]*?)(?=\\n##|$)`, "i");
				const match = mtext.match(regex);
				if (match) {
					checkpointInfo = match[1].trim();
				}
			}
		}

		return [
			"[PI-LEARN ACTIVE SNAPSHOT]",
			`Course: ${active.activeCourseId} (${rdata.meta.title})`,
			`Unit: ${unitId || "none"}${unitMeta ? ` · ${unitMeta.title}` : ""}`,
			`Requires: [${unitMeta?.requires.join(", ") || "none"}]`,
			`Status & Checkpoint:\n${checkpointInfo}`,
		].join("\n");
	}
}

const store = new LearningStore();

// ── Extension Implementation ────────────────────────────────────────────────

export default function learnMemory(pi: ExtensionAPI) {
	// 1. Session start: set status & check active
	pi.on("session_start", async (_event, ctx) => {
		const active = await store.getActive();
		if (active.activeCourseId) {
			const theme = ctx.ui.theme;
			const unitStr = active.activeUnitId ? ` | ${active.activeUnitId}` : "";
			ctx.ui.setStatus(
				"learn-memory",
				theme.fg("accent", "📚 ") + theme.fg("dim", `${active.activeCourseId}${unitStr}`),
			);
		}
	});

	// 2. Context Injection: inject L0 snapshot into system prompt for learning turns
	pi.on("before_agent_start", async (event, _ctx) => {
		const snapshot = await store.buildL0Snapshot();
		if (!snapshot) return;

		// Append compact snapshot to system prompt without inflating chat history
		return {
			systemPrompt: `${event.systemPrompt}\n\n<pi-learn-context>\n${snapshot}\n</pi-learn-context>`,
		};
	});

	// 3. Evidence Capture: automatically monitor quiz tool results
	pi.on("tool_result", async (event, _ctx) => {
		if (event.toolName !== "quiz") return;
		const active = await store.getActive();
		if (!active.activeCourseId) return;

		const details = (event as any).details;
		const dontKnow = details?.dontKnow === true;
		const correct = details?.correct === true;
		const outcome = dontKnow ? "unknown" : correct ? "correct" : "incorrect";

		const record: EvidenceRecord = {
			id: `quiz-${event.toolCallId || Date.now()}`,
			timestamp: new Date().toISOString(),
			course_id: active.activeCourseId,
			unit_id: active.activeUnitId || "general",
			type: "quiz",
			outcome,
			note: details?.note ? String(details.note).trim() : undefined,
			correctIndices: details?.correctIndices,
			answers: details?.answers,
			details: details?.explanation ? { explanation: details.explanation } : undefined,
		};

		await store.appendEvidence(record);
	});

	// 4. Register Learning Tools

	// 4.1 learn_save_roadmap
	pi.registerTool({
		name: "learn_save_roadmap",
		label: "learn_save_roadmap",
		description:
			"Save or update the curriculum roadmap (ROADMAP.md) for a course. Stores DAG dependencies in frontmatter and detailed objectives/invariants in Markdown body.",
		parameters: Type.Object({
			course_id: Type.String({ description: "Unique course identifier, e.g. 'csharp-concurrency' or 'calculus'" }),
			title: Type.String({ description: "Human-readable course title" }),
			units: Type.Array(
				Type.Object({
					id: Type.String({ description: "Unit identifier, e.g. 'u01', 'mutex'" }),
					title: Type.String({ description: "Unit title" }),
					requires: Type.Array(Type.String(), { description: "Prerequisite unit IDs" }),
				}),
				{ description: "List of learning units and their dependency relationships (DAG)" },
			),
			content: Type.String({
				description:
					"Markdown content defining each unit's Objectives, Core Principles / Invariants, and Acceptance criteria.",
			}),
			activate: Type.Optional(Type.Boolean({ description: "Set as the active course immediately (default: true)" })),
		}),
		execute: async (_toolCallId, args) => {
			const activate = args.activate ?? true;
			await store.saveRoadmap(
				{
					schema: 1,
					course_id: args.course_id,
					title: args.title,
					units: args.units,
				},
				args.content,
				activate,
			);
			return {
				content: [{ type: "text", text: `Roadmap saved successfully for course '${args.course_id}'. Units: ${args.units.length}. Active: ${activate}.` }],
			};
		},
	});

	// 4.2 learn_get_context
	pi.registerTool({
		name: "learn_get_context",
		label: "learn_get_context",
		description:
			"Retrieve structured learning context (L1) on demand: unit objectives, full roadmap DAG, current mastery status, or recent evidence.",
		parameters: Type.Object({
			course_id: Type.Optional(Type.String({ description: "Course ID (defaults to currently active course)" })),
			unit_id: Type.Optional(Type.String({ description: "Unit ID to inspect" })),
			scope: Type.Optional(
				Type.Union([Type.Literal("unit"), Type.Literal("roadmap"), Type.Literal("mastery"), Type.Literal("all")], {
					description: "Context scope to fetch (default: 'unit')",
				}),
			),
		}),
		execute: async (_toolCallId, args) => {
			const active = await store.getActive();
			const courseId = args.course_id || active.activeCourseId;
			if (!courseId) {
				return { content: [{ type: "text", text: "No active course. Use learn_list_courses or learn_save_roadmap first." }] };
			}

			const scope = args.scope || "unit";
			const rdata = await store.getRoadmap(courseId);
			if (!rdata) {
				return { content: [{ type: "text", text: `Course '${courseId}' not found.` }] };
			}

			const unitId = args.unit_id || active.activeUnitId || rdata.meta.units[0]?.id;

			if (scope === "roadmap") {
				return {
					content: [
						{
							type: "text",
							text: `# ROADMAP for ${rdata.meta.title} (${courseId})\n\nUnits:\n${JSON.stringify(rdata.meta.units, null, 2)}\n\nMarkdown Body:\n${rdata.body}`,
						},
					],
				};
			}

			if (scope === "mastery") {
				const mtext = (await store.getMastery(courseId)) || "(No mastery data)";
				return { content: [{ type: "text", text: mtext }] };
			}

			// scope === "unit" or "all"
			let unitSection = "(Unit markdown section not found)";
			if (unitId) {
				const regex = new RegExp(`(#+\\s+${unitId}\\b[\\s\\S]*?)(?=\\n#+\\s+[uU]\\d|\\n#+\\s+[a-zA-Z]|$)`, "i");
				const match = rdata.body.match(regex);
				if (match) unitSection = match[1].trim();
			}

			const unitMeta = rdata.meta.units.find((u) => u.id === unitId);
			const mtext = (await store.getMastery(courseId)) || "";
			let unitMastery = "";
			if (unitId && mtext) {
				const mRegex = new RegExp(`##\\s+${unitId}\\b([\\s\\S]*?)(?=\\n##|$)`, "i");
				const mMatch = mtext.match(mRegex);
				if (mMatch) unitMastery = mMatch[1].trim();
			}

			const out = [
				`=== Unit Context: ${unitId} (${unitMeta?.title || "Untitled"}) ===`,
				`Prerequisites: [${unitMeta?.requires.join(", ") || "none"}]`,
				`Mastery & Checkpoint:\n${unitMastery || "No checkpoint recorded yet"}`,
				`\nDefinition & Objectives:\n${unitSection}`,
			].join("\n");

			return { content: [{ type: "text", text: out }] };
		},
	});

	// 4.3 learn_update_checkpoint
	pi.registerTool({
		name: "learn_update_checkpoint",
		label: "learn_update_checkpoint",
		description:
			"Update the current teaching checkpoint, workflow state, or mastery rating for a learning unit in MASTERY.md.",
		parameters: Type.Object({
			course_id: Type.Optional(Type.String({ description: "Course ID (defaults to active course)" })),
			unit_id: Type.String({ description: "Unit identifier to update" }),
			workflow: Type.Optional(
				Type.Union(
					[Type.Literal("pending"), Type.Literal("active"), Type.Literal("paused"), Type.Literal("completed")],
					{ description: "Workflow state of this unit" },
				),
			),
			mastery: Type.Optional(
				Type.Union(
					[Type.Literal("unknown"), Type.Literal("emerging"), Type.Literal("consolidating"), Type.Literal("mastered")],
					{ description: "Cognitive mastery level" },
				),
			),
			checkpoint: Type.Optional(
				Type.Object({
					phase: Type.Optional(Type.Union([Type.Literal("motivate"), Type.Literal("establish"), Type.Literal("connect"), Type.Literal("check"), Type.Literal("review")])),
					covered: Type.Optional(Type.Array(Type.String())),
					pending: Type.Optional(Type.Array(Type.String())),
					nextAction: Type.Optional(Type.String()),
					misconceptions: Type.Optional(
						Type.Array(
							Type.Object({
								id: Type.String(),
								description: Type.Optional(Type.String()),
								status: Type.Union([Type.Literal("addressing"), Type.Literal("resolved")]),
							}),
						),
					),
				}),
			),
		}),
		execute: async (_toolCallId, args) => {
			const active = await store.getActive();
			const courseId = args.course_id || active.activeCourseId;
			if (!courseId) {
				return { content: [{ type: "text", text: "Error: No active course." }] };
			}

			await store.updateCheckpoint(courseId, args.unit_id, {
				workflow: args.workflow,
				mastery: args.mastery,
				checkpoint: args.checkpoint as LessonCheckpoint,
			});

			return {
				content: [{ type: "text", text: `Updated checkpoint for unit '${args.unit_id}' in course '${courseId}'.` }],
			};
		},
	});

	// 4.4 learn_list_courses
	pi.registerTool({
		name: "learn_list_courses",
		label: "learn_list_courses",
		description: "List all existing courses, their unit counts, and which course is currently active.",
		parameters: Type.Object({}),
		execute: async () => {
			const list = await store.listCourses();
			if (list.length === 0) {
				return { content: [{ type: "text", text: "No courses found. Create one using the curriculum skill or learn_save_roadmap." }] };
			}
			const lines = list.map((c) => `- ${c.active ? "[ACTIVE] " : ""}${c.id}: "${c.title}" (${c.unitCount} units)`);
			return { content: [{ type: "text", text: lines.join("\n") }] };
		},
	});

	// 4.5 learn_switch_course
	pi.registerTool({
		name: "learn_switch_course",
		label: "learn_switch_course",
		description: "Switch active course and active learning unit.",
		parameters: Type.Object({
			course_id: Type.String({ description: "Course ID to switch to" }),
			unit_id: Type.Optional(Type.String({ description: "Unit ID to activate (optional)" })),
		}),
		execute: async (_toolCallId, args) => {
			const rdata = await store.getRoadmap(args.course_id);
			if (!rdata) {
				return { content: [{ type: "text", text: `Course '${args.course_id}' does not exist.` }] };
			}
			const unitId = args.unit_id || rdata.meta.units[0]?.id;
			await store.setActive({
				activeCourseId: args.course_id,
				activeUnitId: unitId,
			});
			return {
				content: [{ type: "text", text: `Switched active course to '${args.course_id}', active unit: '${unitId}'.` }],
			};
		},
	});
}
