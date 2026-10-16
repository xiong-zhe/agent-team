import Schema from "@deepseek-ai/schemastery";
import { randomUUID } from "node:crypto";
import { Service } from "@deepseek-ai/cordis";
import { WorkspaceId } from "@deepseek-ai/dsh-workspace";
import { isModelInvocable, isSkillName, isUserInvocable } from "@deepseek-ai/dsh-skill";
import { z } from "zod";
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { preloadPatchDiff } from "@pierre/diffs/ssr";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { watch } from "chokidar";
import { assembleContextFor, installModelSelection } from "@deepseek-ai/dsh-agent";
import { MessageId, ReasoningEffortId, createUserMessage, freezeMessage } from "@deepseek-ai/dsh-llm";
import { SessionId } from "@deepseek-ai/dsh-session";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { RpcId } from "@deepseek-ai/dsh-host-apiproxy";
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
//#region src/config.ts
const Config = Schema.object({
	maxRequestBytes: Schema.number().min(1024).max(1048576).default(131072),
	sseHeartbeatMs: Schema.number().min(5e3).max(12e4).default(2e4),
	runtimeConcurrency: Schema.number().min(1).max(32).default(4),
	directMemberChatDefault: Schema.boolean().default(true),
	assistantBuilderProvider: Schema.string().default(""),
	assistantBuilderModel: Schema.string().default(""),
	assistantBuilderAgentPresetId: Schema.string().default(""),
	assistantBuilderPermissionPresetId: Schema.string().default("")
});
//#endregion
//#region src/domain/errors.ts
var AgentTeamError = class extends Error {
	code;
	details;
	constructor(code, message, details, options) {
		super(message, options);
		this.code = code;
		this.details = details;
		this.name = "AgentTeamError";
	}
};
function isAgentTeamError(error) {
	return error instanceof AgentTeamError;
}
//#endregion
//#region src/domain/mcp.ts
const MCP_SERVER_NAME = /^[A-Za-z0-9_-]{1,32}$/;
const MCP_TOOL_NAME = /^mcp__([A-Za-z0-9_-]{1,32})__/;
function isMcpServerName(value) {
	return MCP_SERVER_NAME.test(value);
}
function mcpServerFromToolName(toolName) {
	return MCP_TOOL_NAME.exec(toolName)?.[1];
}
//#endregion
//#region src/domain/schemas.ts
const isoDate = z.iso.datetime({ offset: true });
const nonEmpty = z.string().trim().min(1);
const assistantSnapshotSchema = z.object({
	assistantId: nonEmpty,
	revision: z.int().positive(),
	name: nonEmpty,
	instructions: z.string(),
	provider: nonEmpty,
	model: nonEmpty,
	reasoningEffort: nonEmpty.optional(),
	agentPresetId: nonEmpty,
	permissionPresetId: nonEmpty,
	skillAllowlist: z.array(nonEmpty),
	mcpServers: z.array(nonEmpty)
}).strict();
const assistantTemplateSchema = z.object({
	schemaVersion: z.literal(1),
	id: nonEmpty,
	name: nonEmpty,
	description: z.string().optional(),
	icon: z.string().optional(),
	instructions: z.string(),
	provider: nonEmpty,
	model: nonEmpty,
	reasoningEffort: nonEmpty.optional(),
	agentPresetId: nonEmpty,
	permissionPresetId: nonEmpty,
	skillAllowlist: z.array(nonEmpty),
	mcpServers: z.array(nonEmpty),
	revision: z.int().positive(),
	createdAt: isoDate,
	updatedAt: isoDate
}).strict();
const memberRuntimeStateSchema = z.enum([
	"offline",
	"starting",
	"idle",
	"running",
	"waiting_approval",
	"error"
]);
const teamMemberSlotSchema = z.object({
	id: nonEmpty,
	assistantId: nonEmpty,
	displayName: nonEmpty,
	role: z.enum(["leader", "member"]),
	assistantSnapshot: assistantSnapshotSchema,
	permissionPresetId: nonEmpty,
	reasoningEffort: nonEmpty.optional(),
	sessionId: nonEmpty,
	desiredState: z.enum([
		"online",
		"offline",
		"removing"
	]),
	lastRuntimeState: memberRuntimeStateSchema,
	joinedAt: isoDate
}).strict();
const retiredMemberSessionSchema = z.object({
	formerSlotId: nonEmpty,
	sessionId: nonEmpty,
	displayName: nonEmpty,
	removedAt: isoDate
}).strict();
const teamTaskSchema = z.object({
	id: nonEmpty,
	title: nonEmpty,
	description: z.string(),
	status: z.enum([
		"pending",
		"assigned",
		"running",
		"blocked",
		"completed",
		"failed",
		"cancelled"
	]),
	ownerSlotId: nonEmpty.optional(),
	createdBySlotId: nonEmpty.optional(),
	dependencyIds: z.array(nonEmpty),
	fileScopes: z.array(nonEmpty),
	result: z.string().optional(),
	error: z.string().optional(),
	revision: z.int().positive(),
	createdAt: isoDate,
	updatedAt: isoDate
}).strict();
const fileScopeLeaseSchema = z.object({
	id: nonEmpty,
	slotId: nonEmpty,
	taskId: nonEmpty,
	path: nonEmpty,
	acquiredAt: isoDate,
	expiresAt: isoDate.optional()
}).strict();
const attachmentRefSchema = z.object({
	kind: z.enum(["workspace_path", "url"]),
	value: nonEmpty,
	label: z.string().optional()
}).strict();
const teamMessageSchema = z.object({
	schemaVersion: z.literal(1),
	id: nonEmpty,
	teamId: nonEmpty,
	sender: z.object({
		kind: z.enum([
			"user",
			"member",
			"system"
		]),
		id: nonEmpty
	}).strict(),
	recipient: z.object({
		kind: z.enum([
			"leader",
			"member",
			"broadcast"
		]),
		slotId: nonEmpty.optional()
	}).strict(),
	type: z.enum([
		"instruction",
		"progress",
		"result",
		"question",
		"warning",
		"system"
	]),
	content: z.string(),
	relatedTaskId: nonEmpty.optional(),
	attachments: z.array(attachmentRefSchema),
	deliveryState: z.enum([
		"queued",
		"delivered",
		"read",
		"failed"
	]),
	idempotencyKey: nonEmpty,
	createdAt: isoDate
}).strict();
const teamAggregateSchema = z.object({
	schemaVersion: z.literal(1),
	id: nonEmpty,
	name: nonEmpty,
	workspaceId: nonEmpty,
	workspacePath: nonEmpty,
	leaderSlotId: nonEmpty,
	state: z.enum([
		"draft",
		"starting",
		"active",
		"ownership_conflict",
		"deleting",
		"delete_blocked",
		"error"
	]),
	directMemberChat: z.boolean(),
	members: z.record(z.string(), teamMemberSlotSchema),
	retiredSessions: z.record(z.string(), retiredMemberSessionSchema),
	tasks: z.record(z.string(), teamTaskSchema),
	leases: z.record(z.string(), fileScopeLeaseSchema),
	outbox: z.record(z.string(), teamMessageSchema),
	revision: z.int().positive(),
	createdAt: isoDate,
	updatedAt: isoDate
}).strict();
const teamActivitySchema = z.object({
	schemaVersion: z.literal(1),
	id: nonEmpty,
	teamId: nonEmpty,
	kind: nonEmpty,
	entityId: nonEmpty.optional(),
	summary: z.string(),
	revision: z.int().nonnegative(),
	createdAt: isoDate
}).strict();
const operationSchema = z.object({
	schemaVersion: z.literal(1),
	id: nonEmpty,
	teamId: nonEmpty.optional(),
	kind: z.enum([
		"dissolve_team",
		"remove_member",
		"sync_member",
		"migrate_records"
	]),
	state: z.enum([
		"pending",
		"running",
		"blocked",
		"completed",
		"failed"
	]),
	stage: nonEmpty,
	cursor: z.string().optional(),
	errorCode: z.string().optional(),
	errorMessage: z.string().optional(),
	createdAt: isoDate,
	updatedAt: isoDate
}).strict();
const createAssistantInputSchema = assistantTemplateSchema.pick({
	name: true,
	description: true,
	icon: true,
	instructions: true,
	provider: true,
	model: true,
	reasoningEffort: true,
	agentPresetId: true,
	permissionPresetId: true,
	skillAllowlist: true,
	mcpServers: true
});
const updateAssistantInputSchema = createAssistantInputSchema.partial().strict();
const createTeamMemberInputSchema = z.object({
	assistantId: nonEmpty,
	role: z.enum(["leader", "member"])
}).strict();
const addTeamMemberInputSchema = createTeamMemberInputSchema.omit({ role: true }).strict();
const createTeamDraftInputSchema = z.object({
	name: nonEmpty,
	workspaceId: nonEmpty,
	directMemberChat: z.boolean().optional(),
	members: z.array(createTeamMemberInputSchema).min(1)
}).strict();
const cloneTeamInputSchema = z.object({
	name: nonEmpty,
	workspaceId: nonEmpty
}).strict();
//#endregion
//#region src/domain/types.ts
function snapshotAssistant(assistant) {
	return {
		assistantId: assistant.id,
		revision: assistant.revision,
		name: assistant.name,
		instructions: assistant.instructions,
		provider: assistant.provider,
		model: assistant.model,
		...assistant.reasoningEffort === void 0 ? {} : { reasoningEffort: assistant.reasoningEffort },
		agentPresetId: assistant.agentPresetId,
		permissionPresetId: assistant.permissionPresetId,
		skillAllowlist: [...assistant.skillAllowlist],
		mcpServers: [...assistant.mcpServers]
	};
}
//#endregion
//#region src/service/workspace-diff-renderer.ts
async function renderWorkspaceGitDiff(patch, layout, theme) {
	return (await preloadPatchDiff({
		patch,
		options: {
			diffStyle: layout,
			diffIndicators: "bars",
			hunkSeparators: "line-info",
			lineDiffType: "word-alt",
			overflow: "scroll",
			theme: theme === "dark" ? "pierre-dark" : "pierre-light",
			themeType: theme,
			disableFileHeader: true,
			tokenizeMaxLineLength: 2e3,
			tokenizeMaxLength: 2e5
		}
	})).prerenderedHTML;
}
//#endregion
//#region src/service/workspace-tracker.ts
const execFileAsync = promisify(execFile);
const MAX_GIT_CHANGES = 2e3;
var WorkspaceTracker = class {
	onChange;
	onError;
	watched = /* @__PURE__ */ new Map();
	constructor(onChange, onError) {
		this.onChange = onChange;
		this.onError = onError;
	}
	watch(teamId, workspacePath) {
		const current = this.watched.get(teamId);
		if (current?.path === workspacePath) return;
		if (current !== void 0) this.unwatch(teamId);
		const fileWatcher = watch(workspacePath, {
			ignored: [/(^|[/\\])\.git([/\\]|$)/, /(^|[/\\])node_modules([/\\]|$)/],
			ignoreInitial: true,
			awaitWriteFinish: {
				stabilityThreshold: 180,
				pollInterval: 50
			}
		});
		const gitWatcher = watch([
			join(workspacePath, ".git", "index"),
			join(workspacePath, ".git", "HEAD"),
			join(workspacePath, ".git", "refs")
		], { ignoreInitial: true });
		const watched = {
			path: workspacePath,
			fileWatcher,
			gitWatcher
		};
		this.watched.set(teamId, watched);
		fileWatcher.on("all", () => {
			this.schedule(teamId);
		});
		gitWatcher.on("all", () => {
			this.schedule(teamId);
		});
		fileWatcher.on("error", (error) => {
			this.onError(teamId, error);
		});
		gitWatcher.on("error", (error) => {
			this.onError(teamId, error);
		});
	}
	async unwatch(teamId) {
		const watched = this.watched.get(teamId);
		if (watched === void 0) return;
		this.watched.delete(teamId);
		if (watched.timer !== void 0) clearTimeout(watched.timer);
		await Promise.all([watched.fileWatcher.close(), watched.gitWatcher.close()]);
	}
	async dispose() {
		await Promise.all([...this.watched.keys()].map((teamId) => this.unwatch(teamId)));
	}
	schedule(teamId) {
		const watched = this.watched.get(teamId);
		if (watched === void 0) return;
		if (watched.timer !== void 0) clearTimeout(watched.timer);
		watched.timer = setTimeout(() => {
			const latest = this.watched.get(teamId);
			if (latest === void 0) return;
			delete latest.timer;
			this.onChange(teamId);
		}, 220);
	}
};
async function readWorkspaceGitStatus(workspacePath) {
	const workspaceRoot = await realpath(workspacePath);
	try {
		await lstat(join(workspaceRoot, ".git"));
	} catch (error) {
		if (isMissingPath(error)) return {
			state: "not-repository",
			changes: [],
			truncated: false
		};
		throw error;
	}
	const rootResult = await execFileAsync("git", [
		"-C",
		workspaceRoot,
		"rev-parse",
		"--show-toplevel"
	], {
		encoding: "utf8",
		timeout: 1e4,
		maxBuffer: 1048576
	});
	if (await realpath(rootResult.stdout.trim()) !== workspaceRoot) return {
		state: "not-repository",
		changes: [],
		truncated: false
	};
	const allChanges = parseGitPorcelain((await execFileAsync("git", [
		"-C",
		workspaceRoot,
		"status",
		"--porcelain=v1",
		"-z",
		"--untracked-files=all",
		"--ignored=no"
	], {
		encoding: "utf8",
		timeout: 1e4,
		maxBuffer: 8388608
	})).stdout);
	return {
		state: "repository",
		changes: allChanges.slice(0, MAX_GIT_CHANGES),
		truncated: allChanges.length > MAX_GIT_CHANGES
	};
}
async function readWorkspaceGitDiff(workspacePath, rawPath, scope) {
	const workspaceRoot = await realpath(workspacePath);
	const status = await readWorkspaceGitStatus(workspaceRoot);
	if (status.state !== "repository") throw new Error("Workspace is not a Git repository");
	const path = validateGitPath(workspaceRoot, rawPath);
	const change = status.changes.find((candidate) => candidate.path === path);
	if (change === void 0) throw new Error(`Git change '${path}' no longer exists`);
	if (scope === "staged" && !change.staged) throw new Error(`Git change '${path}' has no staged changes`);
	if (scope === "unstaged" && !change.unstaged) throw new Error(`Git change '${path}' has no unstaged changes`);
	const patch = change.kind === "untracked" ? await diffUntrackedFile(workspaceRoot, path) : await runGitDiff([
		"-c",
		"core.quotePath=false",
		"-C",
		workspaceRoot,
		"diff",
		"--no-color",
		"--no-ext-diff",
		"--find-renames",
		...scope === "staged" ? ["--cached"] : [],
		"--",
		path
	]);
	return {
		path,
		scope,
		patch,
		binary: /^(?:Binary files .* differ|GIT binary patch)$/m.test(patch)
	};
}
function parseGitPorcelain(output) {
	const records = output.split("\0");
	const changes = [];
	for (let index = 0; index < records.length; index += 1) {
		const record = records[index];
		if (!record || record.length < 4) continue;
		const indexCode = record[0] ?? " ";
		const workTreeCode = record[1] ?? " ";
		const path = record.slice(3);
		const originalPath = indexCode === "R" || workTreeCode === "R" || indexCode === "C" || workTreeCode === "C" ? records[++index] : void 0;
		const kind = changeKind(indexCode, workTreeCode);
		changes.push({
			path,
			...originalPath === void 0 ? {} : { originalPath },
			kind,
			staged: indexCode !== " " && indexCode !== "?",
			unstaged: workTreeCode !== " " || indexCode === "?",
			indexCode,
			workTreeCode
		});
	}
	return changes.sort((left, right) => left.path.localeCompare(right.path));
}
function changeKind(indexCode, workTreeCode) {
	const pair = `${indexCode}${workTreeCode}`;
	if ([
		"DD",
		"AU",
		"UD",
		"UA",
		"DU",
		"AA",
		"UU"
	].includes(pair)) return "unmerged";
	if (pair === "??") return "untracked";
	if (indexCode === "R" || workTreeCode === "R") return "renamed";
	if (indexCode === "C" || workTreeCode === "C") return "copied";
	if (indexCode === "D" || workTreeCode === "D") return "deleted";
	if (indexCode === "A" || workTreeCode === "A") return "added";
	if (indexCode === "T" || workTreeCode === "T") return "type-changed";
	return "modified";
}
function isMissingPath(error) {
	if (!(error instanceof Error)) return false;
	return error.code === "ENOENT";
}
function validateGitPath(workspaceRoot, rawPath) {
	if (rawPath.length === 0 || isAbsolute(rawPath)) throw new Error("Git path must be relative");
	const absolutePath = resolve(workspaceRoot, rawPath);
	const workspaceRelativePath = relative(workspaceRoot, absolutePath);
	if (workspaceRelativePath.length === 0 || workspaceRelativePath === ".." || workspaceRelativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(workspaceRelativePath)) throw new Error("Git path escapes the Workspace");
	return workspaceRelativePath.split(process.platform === "win32" ? "\\" : "/").join("/");
}
async function diffUntrackedFile(workspaceRoot, path) {
	const patch = await runGitDiff([
		"-c",
		"core.quotePath=false",
		"diff",
		"--no-index",
		"--no-color",
		"--no-ext-diff",
		"--",
		"/dev/null",
		path
	], workspaceRoot);
	if (patch.length > 0) return patch;
	return `diff --git a/${path} b/${path}\nnew file mode 100644\n`;
}
async function runGitDiff(args, cwd) {
	try {
		return (await execFileAsync("git", args, {
			...cwd === void 0 ? {} : { cwd },
			encoding: "utf8",
			timeout: 2e4,
			maxBuffer: 16777216
		})).stdout;
	} catch (error) {
		const failure = error;
		if (failure.code === 1 && typeof failure.stdout === "string") return failure.stdout;
		throw error;
	}
}
//#endregion
//#region src/service/workspace-service.ts
var WorkspaceService = class {
	ctx;
	store;
	tracker;
	constructor(ctx, store, onChange, onError) {
		this.ctx = ctx;
		this.store = store;
		this.tracker = new WorkspaceTracker(onChange, onError);
	}
	startTracking() {
		for (const team of this.store.listTeams()) this.watch(team.id, team.workspacePath);
	}
	dispose() {
		return this.tracker.dispose();
	}
	watch(teamId, workspacePath) {
		this.tracker.watch(teamId, workspacePath);
	}
	unwatch(teamId) {
		return this.tracker.unwatch(teamId);
	}
	async list(teamId, rawPath = "") {
		const team = await this.requireWorkspace(teamId);
		if (isAbsolute(rawPath)) throw new AgentTeamError("INVALID_REQUEST", "Workspace path must be relative");
		const root = await realpath(team.workspacePath);
		const requested = resolve(root, rawPath);
		if (requested !== root && !requested.startsWith(`${root}${sep}`)) throw new AgentTeamError("INVALID_REQUEST", "Workspace path escapes the team Workspace");
		const target = await realpath(requested);
		if (target !== root && !target.startsWith(`${root}${sep}`)) throw new AgentTeamError("INVALID_REQUEST", "Workspace path resolves outside the team Workspace");
		return (await readdir(target, { withFileTypes: true })).filter((entry) => entry.name !== ".git" && entry.name !== "node_modules").map((entry) => {
			const path = relative(root, resolve(target, entry.name)).split(sep).join("/");
			return {
				name: entry.name,
				path,
				kind: entry.isSymbolicLink() ? "symlink" : entry.isDirectory() ? "directory" : "file"
			};
		}).sort((left, right) => {
			if (left.kind === "directory" && right.kind !== "directory") return -1;
			if (left.kind !== "directory" && right.kind === "directory") return 1;
			return left.name.localeCompare(right.name);
		}).slice(0, 500);
	}
	async search(teamId, rawQuery = "", limit = 40) {
		const team = await this.requireWorkspace(teamId);
		const root = await realpath(team.workspacePath);
		const query = rawQuery.trim().replaceAll("\\", "/").toLocaleLowerCase();
		const boundedLimit = Math.max(1, Math.min(limit, 100));
		const pendingDirectories = [""];
		const matches = [];
		let inspectedEntries = 0;
		while (pendingDirectories.length > 0 && inspectedEntries < 2e4) {
			const directory = pendingDirectories.shift();
			const requested = resolve(root, directory);
			let target;
			try {
				target = await realpath(requested);
			} catch {
				continue;
			}
			if (target !== root && !target.startsWith(`${root}${sep}`)) continue;
			let entries;
			try {
				entries = await readdir(target, { withFileTypes: true });
			} catch {
				continue;
			}
			entries.sort((left, right) => left.name.localeCompare(right.name));
			for (const entry of entries) {
				inspectedEntries += 1;
				if (inspectedEntries > 2e4) break;
				if (entry.name === ".git" || entry.name === "node_modules") continue;
				if (entry.isSymbolicLink()) continue;
				const path = relative(root, resolve(target, entry.name)).split(sep).join("/");
				if (entry.isDirectory()) {
					pendingDirectories.push(path);
					continue;
				}
				if (!entry.isFile() || query.length > 0 && !path.toLocaleLowerCase().includes(query)) continue;
				matches.push({
					name: entry.name,
					path,
					kind: "file"
				});
				if (query.length === 0 && matches.length >= boundedLimit) return matches;
			}
		}
		return matches.sort((left, right) => workspaceSearchRank(left.path, query) - workspaceSearchRank(right.path, query) || left.path.length - right.path.length || left.path.localeCompare(right.path)).slice(0, boundedLimit);
	}
	async changes(teamId) {
		const team = await this.requireWorkspace(teamId);
		try {
			return await readWorkspaceGitStatus(team.workspacePath);
		} catch (error) {
			throw new AgentTeamError("WORKSPACE_GIT_UNAVAILABLE", "Unable to read Git changes for this Workspace", void 0, { cause: error });
		}
	}
	async diff(teamId, path, scope, layout, theme) {
		const team = await this.requireWorkspace(teamId);
		try {
			const diff = await readWorkspaceGitDiff(team.workspacePath, path, scope);
			return {
				path: diff.path,
				scope: diff.scope,
				layout,
				theme,
				binary: diff.binary,
				html: diff.binary || !diff.patch.includes("@@") ? "" : await renderWorkspaceGitDiff(diff.patch, layout, theme)
			};
		} catch (error) {
			throw new AgentTeamError("WORKSPACE_GIT_UNAVAILABLE", error instanceof Error ? error.message : "Unable to read the Git diff for this Workspace", void 0, { cause: error });
		}
	}
	async upload(teamId, rawName, data) {
		const team = await this.requireWorkspace(teamId);
		const root = await realpath(team.workspacePath);
		const uploadDirectory = resolve(root, ".agent-team", "uploads");
		await mkdir(uploadDirectory, { recursive: true });
		const resolvedUploadDirectory = await realpath(uploadDirectory);
		if (!resolvedUploadDirectory.startsWith(`${root}${sep}`)) throw new AgentTeamError("INVALID_REQUEST", "Workspace upload directory resolves outside the team Workspace");
		const name = safeUploadName(rawName);
		for (let index = 0; index < 1e3; index += 1) {
			const candidate = uploadCandidateName(name, index);
			const target = resolve(resolvedUploadDirectory, candidate);
			try {
				await writeFile(target, data, { flag: "wx" });
				return {
					name: candidate,
					path: relative(root, target).split(sep).join("/"),
					bytes: data.byteLength
				};
			} catch (error) {
				if (error.code === "EEXIST") {
					const existing = await readFile(target);
					if (existing.equals(data)) return {
						name: candidate,
						path: relative(root, target).split(sep).join("/"),
						bytes: existing.byteLength
					};
					continue;
				}
				throw error;
			}
		}
		throw new AgentTeamError("INVALID_REQUEST", `Unable to allocate a unique upload name for '${name}'`);
	}
	async requireWorkspace(teamId) {
		const team = this.store.getTeam(teamId);
		if (team === void 0) throw new AgentTeamError("TEAM_NOT_FOUND", `Unknown team '${teamId}'`);
		const workspace = this.ctx.workspaceRegistry.get(WorkspaceId(team.workspaceId));
		if (workspace === void 0 || await workspace.status() !== "ok" || workspace.path !== team.workspacePath) throw new AgentTeamError("WORKSPACE_UNAVAILABLE", `Workspace '${team.workspaceId}' is unavailable or changed`);
		this.watch(team.id, team.workspacePath);
		return team;
	}
};
function workspaceSearchRank(path, query) {
	if (query.length === 0) return 0;
	const normalized = path.toLocaleLowerCase();
	const name = basename(path).toLocaleLowerCase();
	if (name.startsWith(query)) return 0;
	if (normalized.startsWith(query)) return 1;
	if (name.includes(query)) return 2;
	return 3;
}
function safeUploadName(rawName) {
	const name = basename(rawName).normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, "_").trim();
	if (name.length === 0 || name === "." || name === "..") throw new AgentTeamError("INVALID_REQUEST", "Uploaded file name is invalid");
	const extension = extname(name).slice(0, 40);
	return `${name.slice(0, name.length - extension.length).slice(0, 180) || "file"}${extension}`;
}
function uploadCandidateName(name, index) {
	if (index === 0) return name;
	const extension = extname(name);
	return `${name.slice(0, name.length - extension.length)} (${index})${extension}`;
}
//#endregion
//#region src/service/agent-team-service.ts
const PERMISSION_PRESET_LABELS = {
	"read-only": "只读",
	"workspace-write": "工作区可写",
	"danger-full-access": "完全访问",
	standard: "标准"
};
var AgentTeamService = class extends Service {
	config;
	store;
	listeners = /* @__PURE__ */ new Set();
	cursor = 0;
	runtime;
	assistantBuilderRuntime;
	workspace;
	constructor(ctx, config, store) {
		super(ctx, "agentTeam");
		this.config = config;
		this.store = store;
		this.workspace = new WorkspaceService(ctx, store, (teamId) => {
			const team = this.store.getTeam(teamId);
			if (team !== void 0) this.publish("workspace", teamId, team.revision, "workspace.changed");
		}, (teamId, error) => {
			this.ctx.logger.warn(`agent-team: Workspace watcher failed for team '${teamId}'`, error);
		});
		ctx.on("llm/adapters-updated", () => {
			this.publish("catalog", "models", 0, "catalog.models_updated");
		});
	}
	subscribe(listener) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
	attachRuntime(runtime) {
		if (this.runtime !== void 0) throw new Error("Agent Team runtime is already attached");
		this.runtime = runtime;
	}
	attachAssistantBuilderRuntime(runtime) {
		if (this.assistantBuilderRuntime !== void 0) throw new Error("Assistant Builder runtime is already attached");
		this.assistantBuilderRuntime = runtime;
	}
	startWorkspaceTracking() {
		this.workspace.startTracking();
	}
	disposeWorkspaceTracking() {
		return this.workspace.dispose();
	}
	async catalog() {
		const providers = this.ctx.llm.listProviders();
		const modelEntries = await Promise.all(providers.map(async (provider) => [provider.id, (await this.ctx.llm.listModels(provider.id)).map((model) => ({
			id: model.id,
			name: model.name,
			...model.description === void 0 ? {} : { description: model.description }
		}))]));
		const presets = await this.ctx.agentPresets.list();
		const workspaces = await Promise.all(this.ctx.workspaceRegistry.list().map(async (workspace) => ({
			id: String(workspace.id),
			path: workspace.path,
			title: workspace.title,
			status: await workspace.status()
		})));
		return {
			providers,
			models: Object.fromEntries(modelEntries),
			agentPresets: presets.map((preset) => ({
				id: preset.id,
				name: preset.name ?? preset.id,
				...preset.description === void 0 ? {} : { description: preset.description },
				...preset.broken === void 0 ? {} : { broken: preset.broken }
			})),
			permissionPresets: this.ctx.permissionPresets.names.map((name) => {
				const option = this.ctx.permissionPresets.optionOf(name);
				return {
					...option,
					name: PERMISSION_PRESET_LABELS[option.value] ?? option.name
				};
			}),
			workspaces
		};
	}
	async modelCapabilities(providerValue, modelValue) {
		const provider = providerValue.trim();
		const model = modelValue.trim();
		let info;
		try {
			info = await this.ctx.llm.resolveModelInfo(provider, model);
		} catch (error) {
			throw new AgentTeamError("MODEL_REFERENCE_INVALID", `Cannot resolve model '${provider}/${model}'`, void 0, { cause: error });
		}
		return {
			provider,
			model,
			...info.reasoning === void 0 ? {} : { reasoning: {
				efforts: info.reasoning.efforts.map((effort) => ({
					id: String(effort.id),
					name: effort.name,
					...effort.description === void 0 ? {} : { description: effort.description }
				})),
				...info.reasoning.defaultEffort === void 0 ? {} : { defaultEffort: String(info.reasoning.defaultEffort) }
			} }
		};
	}
	async skillCatalog(agentPresetId) {
		try {
			await this.ctx.agentPresets.resolve(agentPresetId);
			const scope = await this.ctx.agentPresets.standingKeyFor(agentPresetId);
			if (this.ctx.tools.get("skill", scope) === void 0) return {
				agentPresetId,
				skills: []
			};
			return {
				agentPresetId,
				skills: (await this.ctx.skills.list({ scope })).filter((skill) => isModelInvocable(skill) || isUserInvocable(skill)).map((skill) => ({
					name: skill.name,
					description: skill.description,
					source: skill.source,
					modelInvocable: isModelInvocable(skill),
					userInvocable: isUserInvocable(skill)
				}))
			};
		} catch (error) {
			if (error instanceof AgentTeamError) throw error;
			throw new AgentTeamError("PRESET_REFERENCE_INVALID", `Cannot read Skills for agent preset '${agentPresetId}'`, void 0, { cause: error });
		}
	}
	async mcpCatalog(agentPresetId) {
		try {
			await this.ctx.agentPresets.resolve(agentPresetId);
			const scope = await this.ctx.agentPresets.standingKeyFor(agentPresetId);
			const servers = /* @__PURE__ */ new Map();
			for (const tool of this.ctx.tools.schemas(scope)) {
				const serverName = mcpServerFromToolName(tool.name);
				if (serverName === void 0) continue;
				const entries = servers.get(serverName) ?? [];
				entries.push({
					name: tool.name,
					description: tool.description
				});
				servers.set(serverName, entries);
			}
			return {
				agentPresetId,
				servers: [...servers.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([name, tools]) => ({
					name,
					tools: tools.sort((left, right) => left.name.localeCompare(right.name))
				}))
			};
		} catch (error) {
			if (error instanceof AgentTeamError) throw error;
			throw new AgentTeamError("PRESET_REFERENCE_INVALID", `Cannot read MCP Servers for agent preset '${agentPresetId}'`, void 0, { cause: error });
		}
	}
	getAssistant(id) {
		return requireAssistant(this.store, id);
	}
	listAssistants() {
		const items = this.store.listAssistants().sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
		return {
			items,
			total: items.length
		};
	}
	async createAssistant(raw) {
		const input = await this.validateAssistantDraft(raw);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const assistant = {
			schemaVersion: 1,
			id: randomUUID(),
			...input,
			revision: 1,
			createdAt: now,
			updatedAt: now
		};
		await this.store.putAssistant(assistant);
		await this.activity("assistant.created", assistant.id, assistant.revision, `Assistant ${assistant.name} created`);
		this.publish("assistant", assistant.id, assistant.revision, "assistant.created");
		return assistant;
	}
	async validateAssistantDraft(raw) {
		const input = normalizeAssistantInput(createAssistantInputSchema.parse(raw));
		await this.validateAssistantReferences(input);
		return input;
	}
	async updateAssistant(id, raw, options = {}) {
		const patch = updateAssistantInputSchema.parse(raw);
		const current = requireAssistant(this.store, id);
		assertRevision("assistant", current.revision, options.expectedRevision);
		const candidate = normalizeAssistantInput(createAssistantInputSchema.parse({
			...assistantInputOf(current),
			...patch
		}));
		await this.validateAssistantReferences(candidate);
		const next = await this.store.updateAssistant(id, (value) => ({
			...value,
			...candidate,
			revision: value.revision + 1,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		}));
		await this.activity("assistant.updated", next.id, next.revision, `Assistant ${next.name} updated`);
		this.publish("assistant", next.id, next.revision, "assistant.updated");
		return next;
	}
	async cloneAssistant(id, name) {
		const source = requireAssistant(this.store, id);
		return this.createAssistant({
			...assistantInputOf(source),
			name: name?.trim() || `${source.name} Copy`
		});
	}
	async deleteAssistant(id) {
		const assistant = requireAssistant(this.store, id);
		const references = this.store.listTeams().filter((team) => Object.values(team.members).some((member) => member.assistantId === id)).map((team) => ({
			id: team.id,
			name: team.name
		}));
		if (references.length > 0) throw new AgentTeamError("ASSISTANT_IN_USE", `Assistant '${assistant.name}' is used by active team members`, { teams: references });
		await this.store.deleteAssistant(id);
		await this.activity("assistant.deleted", id, assistant.revision + 1, `Assistant ${assistant.name} deleted`);
		this.publish("assistant", id, assistant.revision + 1, "assistant.deleted");
	}
	listAssistantBuilderConversations() {
		return this.requireAssistantBuilderRuntime().listConversations();
	}
	getAssistantBuilderDraft() {
		return this.requireAssistantBuilderRuntime().getDraft();
	}
	configureAssistantBuilderDraft(provider, model) {
		return this.requireAssistantBuilderRuntime().configureDraft(provider, model);
	}
	startAssistantBuilderConversation(provider, model, content) {
		return this.requireAssistantBuilderRuntime().startConversation(provider, model, content);
	}
	getAssistantBuilderConversation(sessionId) {
		return this.requireAssistantBuilderRuntime().getConversation(sessionId);
	}
	configureAssistantBuilder(sessionId, provider, model) {
		return this.requireAssistantBuilderRuntime().configure(sessionId, provider, model);
	}
	sendAssistantBuilderMessage(sessionId, content) {
		return this.requireAssistantBuilderRuntime().sendMessage(sessionId, content);
	}
	respondToAssistantBuilderInteraction(sessionId, interactionId, response) {
		return this.requireAssistantBuilderRuntime().respondToInteraction(sessionId, interactionId, response);
	}
	stopAssistantBuilder(sessionId) {
		return this.requireAssistantBuilderRuntime().stop(sessionId);
	}
	archiveAssistantBuilderConversation(sessionId) {
		return this.requireAssistantBuilderRuntime().archiveConversation(sessionId);
	}
	getTeam(id) {
		return requireTeam(this.store, id);
	}
	listTeams() {
		const items = this.store.listTeams();
		return {
			items,
			total: items.length
		};
	}
	async createTeamDraft(raw) {
		const input = createTeamDraftInputSchema.parse(raw);
		if (input.members.filter((member) => member.role === "leader").length !== 1) throw new AgentTeamError("TEAM_INVALID_LEADER", "A team must contain exactly one leader");
		const workspace = this.ctx.workspaceRegistry.get(WorkspaceId(input.workspaceId));
		if (workspace === void 0 || await workspace.status() !== "ok") throw new AgentTeamError("WORKSPACE_UNAVAILABLE", `Workspace '${input.workspaceId}' is unavailable`);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const members = {};
		let leaderSlotId = "";
		for (const item of input.members) {
			const assistant = requireAssistant(this.store, item.assistantId);
			const slotId = randomUUID();
			members[slotId] = {
				id: slotId,
				assistantId: assistant.id,
				displayName: assistant.name,
				role: item.role,
				assistantSnapshot: snapshotAssistant(assistant),
				permissionPresetId: assistant.permissionPresetId,
				...assistant.reasoningEffort === void 0 ? {} : { reasoningEffort: assistant.reasoningEffort },
				sessionId: `agent-team:${randomUUID()}`,
				desiredState: "offline",
				lastRuntimeState: "offline",
				joinedAt: now
			};
			if (item.role === "leader") leaderSlotId = slotId;
		}
		const team = {
			schemaVersion: 1,
			id: randomUUID(),
			name: input.name.trim(),
			workspaceId: String(workspace.id),
			workspacePath: workspace.path,
			leaderSlotId,
			state: "draft",
			directMemberChat: input.directMemberChat ?? this.config.directMemberChatDefault,
			members,
			retiredSessions: {},
			tasks: {},
			leases: {},
			outbox: {},
			revision: 1,
			createdAt: now,
			updatedAt: now
		};
		await this.store.putTeam(team);
		this.workspace.watch(team.id, team.workspacePath);
		await this.activity("team.created", team.id, team.revision, `Team ${team.name} draft created`);
		this.publish("team", team.id, team.revision, "team.created");
		return team;
	}
	async cloneTeam(sourceTeamId, raw) {
		const input = cloneTeamInputSchema.parse(raw);
		const source = requireTeam(this.store, sourceTeamId);
		const workspace = this.ctx.workspaceRegistry.get(WorkspaceId(input.workspaceId));
		if (workspace === void 0 || await workspace.status() !== "ok") throw new AgentTeamError("WORKSPACE_UNAVAILABLE", `Workspace '${input.workspaceId}' is unavailable`);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const members = {};
		let leaderSlotId = "";
		for (const sourceMember of Object.values(source.members)) {
			const member = cloneMemberSlot(sourceMember, now);
			members[member.id] = member;
			if (sourceMember.id === source.leaderSlotId) leaderSlotId = member.id;
		}
		if (leaderSlotId === "") throw new AgentTeamError("TEAM_INVALID_LEADER", "Source team has no valid leader");
		const team = {
			schemaVersion: 1,
			id: randomUUID(),
			name: input.name.trim(),
			workspaceId: String(workspace.id),
			workspacePath: workspace.path,
			leaderSlotId,
			state: "draft",
			directMemberChat: source.directMemberChat,
			members,
			retiredSessions: {},
			tasks: {},
			leases: {},
			outbox: {},
			revision: 1,
			createdAt: now,
			updatedAt: now
		};
		await this.store.putTeam(team);
		this.workspace.watch(team.id, team.workspacePath);
		await this.activity("team.cloned", team.id, team.revision, `Team ${team.name} cloned from ${source.name}`);
		this.publish("team", team.id, team.revision, "team.cloned");
		return team;
	}
	async changeLeader(teamId, successorSlotId, options = {}) {
		const current = requireTeam(this.store, teamId);
		assertTeamMutable(current);
		assertRevision("team", current.revision, options.expectedRevision);
		if (current.members[successorSlotId] === void 0) throw new AgentTeamError("MEMBER_NOT_FOUND", `Unknown member '${successorSlotId}'`);
		if (current.leaderSlotId === successorSlotId) throw new AgentTeamError("INVALID_REQUEST", "The selected member is already the team leader");
		const next = await this.store.updateTeam(teamId, (team) => ({
			...team,
			members: Object.fromEntries(Object.entries(team.members).map(([slotId, member]) => [slotId, {
				...member,
				role: slotId === successorSlotId ? "leader" : "member"
			}])),
			leaderSlotId: successorSlotId,
			revision: team.revision + 1,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		}));
		await this.activity("team.leader_changed", teamId, next.revision, "Team leader changed");
		this.publish("team", teamId, next.revision, "team.leader_changed");
		return next;
	}
	async addMember(teamId, raw, options = {}) {
		const input = addTeamMemberInputSchema.parse(raw);
		const team = requireTeam(this.store, teamId);
		assertTeamMutable(team);
		assertRevision("team", team.revision, options.expectedRevision);
		if (team.state !== "draft" && team.state !== "active") throw new AgentTeamError("TEAM_NOT_ACTIVE", `Cannot add a member while team is '${team.state}'`);
		const assistant = requireAssistant(this.store, input.assistantId);
		const displayName = assistant.name;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const member = createMemberSlot(assistant, displayName, "member", now, team.state === "draft" ? "offline" : "online");
		const next = await this.store.updateTeam(teamId, (current) => ({
			...current,
			members: {
				...current.members,
				[member.id]: member
			},
			revision: current.revision + 1,
			updatedAt: now
		}));
		await this.activity("team.member_added", teamId, next.revision, `Member ${displayName} added`);
		this.publish("team", teamId, next.revision, "team.member_added");
		if (next.state !== "draft") return this.requireRuntime().activateMember(teamId, member.id);
		return next;
	}
	async removeMember(teamId, slotId, options = {}) {
		const team = requireTeam(this.store, teamId);
		assertTeamMutable(team);
		assertRevision("team", team.revision, options.expectedRevision);
		const member = team.members[slotId];
		if (member === void 0) throw new AgentTeamError("MEMBER_NOT_FOUND", `Unknown member '${slotId}'`);
		if (slotId === team.leaderSlotId) throw new AgentTeamError("MEMBER_IS_LEADER", "Choose a successor before removing the current leader");
		assertMemberHasNoOpenTasks(team, slotId);
		if (team.state === "draft") {
			const next = await this.store.updateTeam(teamId, (current) => {
				const members = { ...current.members };
				delete members[slotId];
				return {
					...current,
					members,
					revision: current.revision + 1,
					updatedAt: (/* @__PURE__ */ new Date()).toISOString()
				};
			});
			await this.activity("team.member_removed", teamId, next.revision, `Member ${member.displayName} removed`);
			this.publish("team", teamId, next.revision, "team.member_removed");
			return next;
		}
		return this.requireRuntime().removeMember(teamId, slotId);
	}
	async startTeam(teamId, options = {}) {
		assertRevision("team", requireTeam(this.store, teamId).revision, options.expectedRevision);
		return this.requireRuntime().startTeam(teamId);
	}
	async resetTeam(teamId, confirmation, options = {}) {
		const team = requireTeam(this.store, teamId);
		assertTeamMutable(team);
		assertRevision("team", team.revision, options.expectedRevision);
		if (confirmation !== team.name) throw new AgentTeamError("INVALID_REQUEST", "Team name confirmation does not match");
		return this.requireRuntime().resetTeam(teamId);
	}
	async sendUserMessage(teamId, content, targetSlotId) {
		return this.requireRuntime().sendUserMessage(teamId, content, targetSlotId);
	}
	getWorkbench(teamId) {
		requireTeam(this.store, teamId);
		return this.requireRuntime().getWorkbench(teamId);
	}
	stopMember(teamId, slotId) {
		requireTeam(this.store, teamId);
		return this.requireRuntime().stopMember(teamId, slotId);
	}
	async respondToInteraction(teamId, slotId, interactionId, response) {
		if (requireTeam(this.store, teamId).members[slotId] === void 0) throw new AgentTeamError("MEMBER_NOT_FOUND", `Unknown member '${slotId}'`);
		await this.requireRuntime().respondToInteraction(teamId, slotId, interactionId, response);
	}
	async setMemberPermissionPreset(teamId, slotId, rawPermissionPresetId, options = {}) {
		const permissionPresetId = rawPermissionPresetId.trim();
		const team = requireTeam(this.store, teamId);
		assertTeamMutable(team);
		assertRevision("team", team.revision, options.expectedRevision);
		const member = team.members[slotId];
		if (member === void 0) throw new AgentTeamError("MEMBER_NOT_FOUND", `Unknown member '${slotId}'`);
		if (!this.ctx.permissionPresets.names.includes(permissionPresetId)) throw new AgentTeamError("PERMISSION_PRESET_INVALID", `Unknown permission preset '${permissionPresetId}'`);
		if (member.permissionPresetId === permissionPresetId) return team;
		if (team.state === "draft") {
			const next = await this.store.updateTeam(teamId, (current) => ({
				...current,
				members: Object.fromEntries(Object.entries(current.members).map(([id, currentMember]) => [id, id === slotId ? {
					...currentMember,
					permissionPresetId
				} : currentMember])),
				revision: current.revision + 1,
				updatedAt: (/* @__PURE__ */ new Date()).toISOString()
			}));
			await this.activity("team.member_permission_changed", teamId, next.revision, `Member ${member.displayName} permission changed to ${permissionPresetId}`);
			this.publish("team", teamId, next.revision, "team.member_permission_changed");
			return next;
		}
		return this.requireRuntime().setMemberPermissionPreset(teamId, slotId, permissionPresetId);
	}
	async setMemberReasoningEffort(teamId, slotId, rawReasoningEffort, options = {}) {
		const reasoningEffort = rawReasoningEffort?.trim() || void 0;
		const team = requireTeam(this.store, teamId);
		assertTeamMutable(team);
		assertRevision("team", team.revision, options.expectedRevision);
		const member = team.members[slotId];
		if (member === void 0) throw new AgentTeamError("MEMBER_NOT_FOUND", `Unknown member '${slotId}'`);
		await this.validateReasoningEffort(member.assistantSnapshot.provider, member.assistantSnapshot.model, reasoningEffort);
		if (member.reasoningEffort === reasoningEffort) return team;
		if (team.state === "draft") {
			const next = await this.store.updateTeam(teamId, (current) => ({
				...current,
				members: Object.fromEntries(Object.entries(current.members).map(([id, currentMember]) => [id, id === slotId ? withReasoningEffort$1(currentMember, reasoningEffort) : currentMember])),
				revision: current.revision + 1,
				updatedAt: (/* @__PURE__ */ new Date()).toISOString()
			}));
			await this.activity("team.member_reasoning_changed", teamId, next.revision, `Member ${member.displayName} reasoning changed to ${reasoningEffort ?? "model default"}`);
			this.publish("team", teamId, next.revision, "team.member_reasoning_changed");
			return next;
		}
		return this.requireRuntime().setMemberReasoningEffort(teamId, slotId, reasoningEffort);
	}
	publishConversation(teamId, revision, conversation) {
		this.publish("conversation", teamId, revision, "member.conversation", conversation);
	}
	publishAssistantBuilderConversation(conversation) {
		const change = {
			cursor: ++this.cursor,
			entityType: "assistant-builder",
			entityId: conversation.sessionId,
			revision: Math.max(0, conversation.throughSeq + 1),
			kind: "assistant.builder.conversation",
			assistantBuilderConversation: conversation
		};
		for (const listener of this.listeners) listener(change);
	}
	async listWorkspace(teamId, rawPath = "") {
		return this.workspace.list(teamId, rawPath);
	}
	async searchWorkspace(teamId, query = "", limit = 40) {
		return this.workspace.search(teamId, query, limit);
	}
	async getWorkspaceChanges(teamId) {
		return this.workspace.changes(teamId);
	}
	async getWorkspaceDiff(teamId, path, scope, layout, theme) {
		return this.workspace.diff(teamId, path, scope, layout, theme);
	}
	async uploadWorkspaceFile(teamId, rawName, data) {
		return this.workspace.upload(teamId, rawName, data);
	}
	listMessages(teamId) {
		requireTeam(this.store, teamId);
		const items = this.store.listMessages(teamId);
		return {
			items,
			total: items.length
		};
	}
	async updateRuntimeTeam(teamId, update, kind, summary) {
		const next = await this.store.updateTeam(teamId, (current) => {
			return {
				...update(current),
				revision: current.revision + 1,
				updatedAt: (/* @__PURE__ */ new Date()).toISOString()
			};
		});
		await this.activity(kind, teamId, next.revision, summary);
		this.publish("team", teamId, next.revision, kind);
		return next;
	}
	async putRuntimeMessage(message) {
		await this.store.putMessage(message);
		const team = requireTeam(this.store, message.teamId);
		this.publish("team", team.id, team.revision, "team.message");
	}
	async retireQueuedMessages(teamId) {
		requireTeam(this.store, teamId);
		const queued = this.store.listMessages(teamId).filter((message) => message.deliveryState === "queued");
		await Promise.all(queued.map((message) => this.store.putMessage({
			...message,
			deliveryState: "failed"
		})));
	}
	async dissolveTeam(teamId, confirmation, options = {}) {
		const team = requireTeam(this.store, teamId);
		assertRevision("team", team.revision, options.expectedRevision);
		if (confirmation !== team.name) throw new AgentTeamError("INVALID_REQUEST", "Team name confirmation does not match");
		if (team.state !== "draft") return this.requireRuntime().dissolveTeam(teamId);
		await this.deleteTeamRecords(teamId);
	}
	async deleteTeamRecords(teamId) {
		const team = requireTeam(this.store, teamId);
		await Promise.all(this.store.listMessages(teamId).map((message) => this.store.deleteMessage(message.id)));
		await Promise.all(this.store.listActivities(teamId).map((activity) => this.store.deleteActivity(activity.id)));
		await this.store.deleteTeam(teamId);
		await this.workspace.unwatch(teamId);
		this.publish("team", teamId, team.revision + 1, "team.deleted");
	}
	getOperation(id) {
		const operation = this.store.getOperation(id);
		if (operation === void 0) throw new AgentTeamError("INVALID_REQUEST", `Unknown operation '${id}'`);
		return operation;
	}
	async validateAssistantReferences(input) {
		const invalidSkill = input.skillAllowlist.find((name) => !isSkillName(name));
		if (invalidSkill !== void 0) throw new AgentTeamError("SKILL_REFERENCE_INVALID", `Invalid Skill name '${invalidSkill}'`);
		const invalidMcpServer = input.mcpServers.find((name) => !isMcpServerName(name));
		if (invalidMcpServer !== void 0) throw new AgentTeamError("MCP_REFERENCE_INVALID", `Invalid MCP Server name '${invalidMcpServer}'`);
		await this.validateReasoningEffort(input.provider, input.model, input.reasoningEffort);
		try {
			await this.ctx.agentPresets.resolve(input.agentPresetId);
		} catch (error) {
			throw new AgentTeamError("PRESET_REFERENCE_INVALID", `Unknown agent preset '${input.agentPresetId}'`, void 0, { cause: error });
		}
		if (!this.ctx.permissionPresets.names.includes(input.permissionPresetId)) throw new AgentTeamError("PERMISSION_PRESET_INVALID", `Unknown permission preset '${input.permissionPresetId}'`);
		if (input.mcpServers.length > 0) {
			const catalog = await this.mcpCatalog(input.agentPresetId);
			const available = new Set(catalog.servers.map((server) => server.name));
			const missing = input.mcpServers.filter((name) => !available.has(name));
			if (missing.length > 0) throw new AgentTeamError("MCP_REFERENCE_INVALID", `Agent Preset '${input.agentPresetId}' cannot access MCP Server(s): ${missing.join(", ")}`, { missing });
		}
	}
	async validateReasoningEffort(provider, model, reasoningEffort) {
		const capabilities = await this.modelCapabilities(provider, model);
		if (reasoningEffort === void 0) return;
		if (!(capabilities.reasoning?.efforts.some((effort) => effort.id === reasoningEffort) ?? false)) throw new AgentTeamError("MODEL_REFERENCE_INVALID", `Model '${provider}/${model}' does not support reasoning effort '${reasoningEffort}'`, {
			reasoningEffort,
			supportedEfforts: capabilities.reasoning?.efforts.map((effort) => effort.id) ?? []
		});
	}
	async activity(kind, entityId, revision, summary) {
		const activity = {
			schemaVersion: 1,
			id: randomUUID(),
			teamId: kind.startsWith("team.") ? entityId : "assistant-library",
			kind,
			entityId,
			summary,
			revision,
			createdAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		try {
			await this.store.putActivity(activity);
		} catch (error) {
			this.ctx.logger.warn("agent-team: activity write failed after primary mutation", error);
		}
	}
	publish(entityType, entityId, revision, kind, conversation) {
		const change = {
			cursor: ++this.cursor,
			entityType,
			entityId,
			revision,
			kind,
			...conversation === void 0 ? {} : { conversation }
		};
		for (const listener of this.listeners) listener(change);
	}
	requireRuntime() {
		if (this.runtime === void 0) throw new Error("Agent Team runtime is not attached");
		return this.runtime;
	}
	requireAssistantBuilderRuntime() {
		if (this.assistantBuilderRuntime === void 0) throw new Error("Assistant Builder runtime is not attached");
		return this.assistantBuilderRuntime;
	}
};
function requireAssistant(store, id) {
	const assistant = store.getAssistant(id);
	if (assistant === void 0) throw new AgentTeamError("ASSISTANT_NOT_FOUND", `Unknown assistant '${id}'`);
	return assistant;
}
function requireTeam(store, id) {
	const team = store.getTeam(id);
	if (team === void 0) throw new AgentTeamError("TEAM_NOT_FOUND", `Unknown team '${id}'`);
	return team;
}
function assertRevision(entity, actual, expected) {
	if (expected !== void 0 && expected !== actual) throw new AgentTeamError(entity === "assistant" ? "ASSISTANT_REVISION_CONFLICT" : "TEAM_REVISION_CONFLICT", `${entity} revision conflict: expected ${expected}, current ${actual}`, {
		expected,
		actual
	});
}
function assertTeamMutable(team) {
	if (team.state === "deleting" || team.state === "delete_blocked") throw new AgentTeamError("TEAM_DELETING", `Team '${team.id}' is deleting`);
}
function assistantInputOf(assistant) {
	return {
		name: assistant.name,
		...assistant.description === void 0 ? {} : { description: assistant.description },
		...assistant.icon === void 0 ? {} : { icon: assistant.icon },
		instructions: assistant.instructions,
		provider: assistant.provider,
		model: assistant.model,
		...assistant.reasoningEffort === void 0 ? {} : { reasoningEffort: assistant.reasoningEffort },
		agentPresetId: assistant.agentPresetId,
		permissionPresetId: assistant.permissionPresetId,
		skillAllowlist: [...assistant.skillAllowlist],
		mcpServers: [...assistant.mcpServers]
	};
}
function normalizeAssistantInput(input) {
	return {
		...input,
		name: input.name.trim(),
		provider: input.provider.trim(),
		model: input.model.trim(),
		...input.reasoningEffort === void 0 ? {} : { reasoningEffort: input.reasoningEffort.trim() },
		agentPresetId: input.agentPresetId.trim(),
		permissionPresetId: input.permissionPresetId.trim(),
		skillAllowlist: unique(input.skillAllowlist),
		mcpServers: unique(input.mcpServers)
	};
}
function unique(values) {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
function createMemberSlot(assistant, displayName, role, now, desiredState) {
	return {
		id: randomUUID(),
		assistantId: assistant.id,
		displayName,
		role,
		assistantSnapshot: snapshotAssistant(assistant),
		permissionPresetId: assistant.permissionPresetId,
		...assistant.reasoningEffort === void 0 ? {} : { reasoningEffort: assistant.reasoningEffort },
		sessionId: `agent-team:${randomUUID()}`,
		desiredState,
		lastRuntimeState: desiredState === "online" ? "starting" : "offline",
		joinedAt: now
	};
}
function cloneMemberSlot(source, now) {
	return {
		id: randomUUID(),
		assistantId: source.assistantId,
		displayName: source.displayName,
		role: source.role,
		assistantSnapshot: {
			...source.assistantSnapshot,
			skillAllowlist: [...source.assistantSnapshot.skillAllowlist],
			mcpServers: [...source.assistantSnapshot.mcpServers]
		},
		permissionPresetId: source.permissionPresetId,
		...source.reasoningEffort === void 0 ? {} : { reasoningEffort: source.reasoningEffort },
		sessionId: `agent-team:${randomUUID()}`,
		desiredState: "offline",
		lastRuntimeState: "offline",
		joinedAt: now
	};
}
function withReasoningEffort$1(member, reasoningEffort) {
	const { reasoningEffort: _current, ...rest } = member;
	return reasoningEffort === void 0 ? rest : {
		...rest,
		reasoningEffort
	};
}
function assertMemberHasNoOpenTasks(team, slotId) {
	const open = Object.values(team.tasks).filter((task) => task.ownerSlotId === slotId && ![
		"completed",
		"failed",
		"cancelled"
	].includes(task.status));
	if (open.length > 0) throw new AgentTeamError("MEMBER_BUSY", "Reassign, complete, fail, or cancel this member’s open tasks before removal", { taskIds: open.map((task) => task.id) });
}
//#endregion
//#region src/runtime/conversation-projector.ts
function projectContextUsage(events) {
	let latestUsage;
	let contextWindow;
	for (const event of events) {
		if (event.type === "request/context") contextWindow = event.data.contextWindow;
		const usage = event.type === "assistant/chunk" && event.data.chunk.type === "usage" ? event.data.chunk.usage : event.type === "assistant/message" ? event.data.usage : void 0;
		if (usage !== void 0) latestUsage = usage;
	}
	if (latestUsage === void 0) return void 0;
	const cacheReadTokens = latestUsage.cacheReadTokens ?? 0;
	const cacheWriteTokens = latestUsage.cacheWriteTokens ?? 0;
	const inputTokens = latestUsage.inputTokens + cacheReadTokens + cacheWriteTokens;
	const outputTokens = latestUsage.outputTokens;
	return {
		usedTokens: inputTokens + outputTokens,
		inputTokens,
		outputTokens,
		cacheReadTokens,
		cacheWriteTokens,
		reasoningTokens: latestUsage.reasoningTokens ?? 0,
		...contextWindow === void 0 ? {} : { contextWindow }
	};
}
function projectConversation(events, limit = 240, teamContext) {
	const nodes = [];
	const tools = /* @__PURE__ */ new Map();
	const partials = /* @__PURE__ */ new Map();
	const teamMessages = new Map(teamContext?.messages.map((message) => [message.id, message]) ?? []);
	for (const event of events) switch (event.type) {
		case "user/message": {
			if (!isVisibleUserSource(event.data.source)) break;
			const text = textOf(event.data.content);
			if (text.length > 0) {
				const messageId = String(event.data.id);
				const teamMessage = teamMessages.get(messageId);
				if (teamContext !== void 0 && teamMessage !== void 0 && teamMessage.sender.kind !== "user") nodes.push(teamMessageNode(teamContext.team, teamMessage, event.seq, event.time));
				else nodes.push({
					id: messageId,
					kind: "user",
					seq: event.seq,
					time: event.time,
					text
				});
			}
			break;
		}
		case "assistant/chunk": {
			const key = `${event.data.turn}:${event.data.step}`;
			const current = partials.get(key) ?? {
				id: `stream:${key}`,
				seq: event.seq,
				time: event.time,
				text: "",
				reasoning: ""
			};
			const chunk = event.data.chunk;
			if (chunk.type === "text-delta") {
				current.text += chunk.text;
				if (chunk.text.length > 0 && current.reasoningStartedAt !== void 0) current.reasoningCompletedAt ??= event.time;
			}
			if (chunk.type === "reasoning-delta") {
				current.reasoning += chunk.text;
				if (chunk.text.length > 0) {
					current.reasoningStartedAt ??= event.time;
					if (current.text.length > 0) current.reasoningCompletedAt ??= event.time;
				}
			}
			if (chunk.type === "block-end" && chunk.block.type === "text") {
				current.text = chunk.block.text;
				if (current.reasoningStartedAt !== void 0) current.reasoningCompletedAt ??= event.time;
			}
			if (chunk.type === "block-end" && chunk.block.type === "reasoning") {
				current.reasoning = chunk.block.text;
				if (chunk.block.text.length > 0) {
					current.reasoningStartedAt ??= current.time;
					current.reasoningCompletedAt ??= event.time;
				}
			}
			current.seq = event.seq;
			partials.set(key, current);
			break;
		}
		case "assistant/message": {
			const partial = partials.get(`${event.data.turn}:${event.data.step}`);
			partials.delete(`${event.data.turn}:${event.data.step}`);
			const text = textOf(event.data.message.content);
			const reasoning = reasoningOf(event.data.message.content);
			if (text.length > 0 || reasoning.length > 0) nodes.push({
				id: String(event.data.message.id),
				kind: "assistant",
				seq: event.seq,
				time: event.time,
				text,
				...reasoning.length === 0 ? {} : { reasoning },
				...partial?.reasoningStartedAt === void 0 ? {} : {
					reasoningStartedAt: partial.reasoningStartedAt,
					reasoningCompletedAt: partial.reasoningCompletedAt ?? event.time
				}
			});
			break;
		}
		case "tool/call": {
			const callId = String(event.data.callId);
			tools.set(callId, nodes.length);
			nodes.push({
				id: `tool:${callId}`,
				kind: "tool",
				seq: event.seq,
				time: event.time,
				callId,
				name: event.data.name,
				arguments: event.data.arguments,
				status: "running"
			});
			break;
		}
		case "tool/result": {
			const callId = String(event.data.message.content[0].toolCallId);
			const index = tools.get(callId);
			const result = textOf(event.data.message.content[0].content);
			const error = event.data.error === void 0 ? void 0 : `${event.data.error.name}: ${event.data.error.code}`;
			if (index !== void 0) {
				const node = nodes[index];
				if (node?.kind === "tool") nodes[index] = {
					...node,
					seq: event.seq,
					status: event.data.message.content[0].isError === true || error !== void 0 ? "error" : "success",
					...result.length === 0 ? {} : { result },
					...error === void 0 ? {} : { error }
				};
			} else nodes.push({
				id: `tool:${callId}`,
				kind: "tool",
				seq: event.seq,
				time: event.time,
				callId,
				name: "tool",
				arguments: "",
				status: event.data.message.content[0].isError === true || error !== void 0 ? "error" : "success",
				...result.length === 0 ? {} : { result },
				...error === void 0 ? {} : { error }
			});
			break;
		}
		case "turn/end":
			if (event.data.reason.kind === "error") nodes.push({
				id: `turn-error:${event.seq}`,
				kind: "notice",
				seq: event.seq,
				time: event.time,
				tone: "error",
				text: event.data.reason.error.message
			});
			if (event.data.reason.kind === "max-tokens") nodes.push({
				id: `turn-warning:${event.seq}`,
				kind: "notice",
				seq: event.seq,
				time: event.time,
				tone: "warning",
				text: "本轮输出已达到模型长度上限。"
			});
	}
	for (const partial of partials.values()) {
		if (partial.text.length === 0 && partial.reasoning.length === 0) continue;
		nodes.push({
			id: partial.id,
			kind: "assistant",
			seq: partial.seq,
			time: partial.time,
			text: partial.text,
			...partial.reasoning.length === 0 ? {} : { reasoning: partial.reasoning },
			...partial.reasoningStartedAt === void 0 ? {} : {
				reasoningStartedAt: partial.reasoningStartedAt,
				...partial.reasoningCompletedAt === void 0 ? {} : { reasoningCompletedAt: partial.reasoningCompletedAt }
			},
			streaming: true
		});
	}
	nodes.sort((left, right) => left.seq - right.seq);
	return {
		throughSeq: events.at(-1)?.seq ?? -1,
		nodes: nodes.slice(-limit)
	};
}
function teamMessageNode(team, message, seq, time) {
	if (message.sender.kind === "system") return {
		id: message.id,
		kind: "team-message",
		seq,
		time,
		text: message.content,
		senderName: "团队事件",
		senderId: message.sender.id,
		senderRole: "system",
		messageType: message.type,
		...message.relatedTaskId === void 0 ? {} : { relatedTaskId: message.relatedTaskId }
	};
	const current = team.members[message.sender.id];
	const retired = Object.values(team.retiredSessions).find((session) => session.formerSlotId === message.sender.id);
	return {
		id: message.id,
		kind: "team-message",
		seq,
		time,
		text: message.content,
		senderName: current?.displayName ?? retired?.displayName ?? "已移出成员",
		senderId: message.sender.id,
		senderRole: message.sender.id === team.leaderSlotId ? "leader" : "member",
		messageType: message.type,
		...message.relatedTaskId === void 0 ? {} : { relatedTaskId: message.relatedTaskId }
	};
}
function isVisibleUserSource(source) {
	if (source.kind === "user") return true;
	if (source.kind !== "plugin") return false;
	return source.plugin === "dsh-agent-team" && source.form === "relay";
}
function textOf(blocks) {
	return blocks.flatMap((block) => {
		if (block.type === "text") return [block.text];
		if (block.type === "tool-result") return [textOf(block.content)];
		if (block.type === "image") return ["[图片]"];
		return [];
	}).filter(Boolean).join("\n");
}
function reasoningOf(blocks) {
	return blocks.flatMap((block) => block.type === "reasoning" ? [block.text] : []).join("\n");
}
const ASSISTANT_BUILDER_SESSION_PREFIX = `agent-team:assistant-builder:`;
const ASSISTANT_BUILDER_DRAFT_ID = `${ASSISTANT_BUILDER_SESSION_PREFIX}draft`;
const ASSISTANT_BUILDER_PROMPT = `
你是“团队 Agent 小助手”，负责通过对话帮助用户创建可复用的 Agent 助手模板。

工作规则：
1. 先理解用户希望这个助手承担的职责、工作边界、输出方式和协作习惯。
2. 创建前必须收集名称、Provider、模型、Agent Preset、权限预设和长期提示词。说明按需要收集；可用 Skills 和 MCP Servers 由用户从真实目录中选择，都可以不选。
3. 必须先调用 assistant_builder_get_catalog 获取当前真实可选项；Provider、模型、Preset 和权限只能使用目录中存在的标识，不能编造。确定模型后，再携带 provider 和 model 调用一次目录工具读取该模型真实支持的思考模式；未返回思考能力时不得配置。确定 Agent Preset 后，再携带 agentPresetId 调用一次目录工具，取得该 Preset 可用的 Skills 和 MCP Servers。
4. 参数不完整或意图含糊时，优先调用 ask_user_question，一次询问一至三个最关键的问题，并给出基于真实目录的简短选项和建议。问题较开放、需要用户详细描述，或只是普通解释时，可以直接输出中文文本。
5. 长期提示词应描述稳定职责、约束、工作流程和验收要求，不要写入用户眼前的一次性任务。
6. 只保存用户明确选择的 Skills 和 MCP Servers；未选择就表示不使用，不能猜测名称。不要询问或限制普通工具，工具能力由 Agent Preset 提供。
7. 配置完整后调用 assistant_builder_prepare 校验并暂存草稿；此步骤不会创建助手，新草稿会替代旧草稿。
8. 用简洁清单复述最终配置，并询问用户是否确认创建。用户可以用自然语言表达同意，例如“确认”“可以”“就这样创建”“没问题，创建吧”，不要要求固定口令。必须等待新的用户消息，不得在同一轮代替用户确认。
9. 只有用户对当前最终配置明确表达同意后才能调用 assistant_builder_commit。若用户的回复含糊、否定创建、提出问题或要求修改配置，不得提交；应先回答或修改草稿，再次展示最终配置并征求确认。
10. 创建成功后明确告知助手名称，并提示它现在可以加入团队。
11. 你只能帮助设计和创建助手模板，不创建团队、不修改或删除已有助手，也不执行 Workspace 任务。

保持中文、简洁、主动，但不要替用户猜测会显著影响成本、权限或能力范围的参数。
`.trim();
var AssistantBuilderRuntime = class {
	ctx;
	config;
	service;
	modelPreferences;
	interactions;
	handle;
	starting;
	reconfiguring;
	switching;
	activeSessionId;
	configuration;
	configurations = /* @__PURE__ */ new Map();
	pendingDrafts = /* @__PURE__ */ new Map();
	publishTimer;
	disposeStatusListener;
	disposeConversationListener;
	disposeInteractionScope;
	closing = false;
	constructor(ctx, config, service, modelPreferences, interactions) {
		this.ctx = ctx;
		this.config = config;
		this.service = service;
		this.modelPreferences = modelPreferences;
		this.interactions = interactions;
		this.disposeInteractionScope = interactions.registerScope({
			acceptsSession: isAssistantBuilderSessionId,
			onChange: (sessionId) => {
				if (sessionId === this.activeSessionId) this.publishCurrent();
			}
		});
		this.disposeStatusListener = ctx.on("agent/status", ({ agent }) => {
			if (String(agent.id) !== this.activeSessionId || this.closing) return;
			this.publishCurrent();
		});
		this.disposeConversationListener = ctx.on("session/event", (session) => {
			if (String(session.id) !== this.activeSessionId || this.closing || this.publishTimer !== void 0) return;
			this.publishTimer = setTimeout(() => {
				this.publishTimer = void 0;
				this.publishCurrent();
			}, 48);
		});
	}
	async listConversations() {
		const headers = (await this.ctx.sessionPersistence.list()).filter((header) => isAssistantBuilderSessionId(String(header.id)) && !this.isConversationArchived(String(header.id)));
		const active = this.handle?.agent.session;
		const ids = new Map(headers.map((header) => [String(header.id), header]));
		if (active !== void 0 && isAssistantBuilderSessionId(String(active.id)) && !this.isConversationArchived(String(active.id))) ids.set(String(active.id), active.header);
		const items = (await Promise.all([...ids.entries()].map(async ([sessionId, header]) => {
			const events = active !== void 0 && String(active.id) === sessionId ? active.events : (await this.ctx.sessionPersistence.inspect(SessionId(sessionId))).events;
			return summarizeConversation(sessionId, header.createdAt, events);
		}))).filter((item) => item.state !== "new");
		items.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt));
		return {
			items,
			total: items.length
		};
	}
	async getDraft() {
		return {
			schemaVersion: 1,
			configuration: await this.resolveConfiguration(ASSISTANT_BUILDER_DRAFT_ID)
		};
	}
	async configureDraft(rawProvider, rawModel) {
		const provider = rawProvider.trim();
		const model = rawModel.trim();
		await this.validateModelReference(provider, model);
		await this.modelPreferences.setLastSelectedModel(provider, model);
		return {
			schemaVersion: 1,
			configuration: {
				...await this.resolveConfiguration(ASSISTANT_BUILDER_DRAFT_ID),
				provider,
				model
			}
		};
	}
	async startConversation(rawProvider, rawModel, rawContent) {
		const provider = rawProvider.trim();
		const model = rawModel.trim();
		const content = rawContent.trim();
		if (content.length === 0) throw new AgentTeamError("INVALID_REQUEST", "Message content is required");
		await this.validateModelReference(provider, model);
		const base = await this.resolveConfiguration(ASSISTANT_BUILDER_DRAFT_ID);
		const sessionId = `${ASSISTANT_BUILDER_SESSION_PREFIX}${randomUUID()}`;
		const configuration = {
			...base,
			provider,
			model
		};
		this.configurations.set(sessionId, configuration);
		await this.modelPreferences.setSelectedModel(sessionId, provider, model);
		const handle = await this.ensureOnline(sessionId, true);
		const message = createUserMessage({
			content: [{
				type: "text",
				text: content
			}],
			source: { kind: "user" }
		});
		handle.agent.followup(message);
		return this.project(sessionId, handle.agent.session.events, handle.agent.status);
	}
	async getConversation(rawSessionId) {
		const sessionId = await this.requireExistingSessionId(rawSessionId);
		const handle = await this.ensureOnline(sessionId);
		return this.project(sessionId, handle.agent.session.events, handle.agent.status);
	}
	async sendMessage(sessionId, rawContent) {
		const content = rawContent.trim();
		if (content.length === 0) throw new AgentTeamError("INVALID_REQUEST", "Message content is required");
		const handle = await this.ensureOnline(await this.requireExistingSessionId(sessionId));
		const message = createUserMessage({
			content: [{
				type: "text",
				text: content
			}],
			source: { kind: "user" }
		});
		handle.agent.followup(message);
		return { messageId: String(message.id) };
	}
	async configure(sessionId, rawProvider, rawModel) {
		if (this.closing) throw new Error("Assistant Builder runtime is closing");
		if (this.reconfiguring !== void 0) await this.reconfiguring;
		const provider = rawProvider.trim();
		const model = rawModel.trim();
		if (provider.length === 0 || model.length === 0) throw new AgentTeamError("INVALID_REQUEST", "Assistant Builder provider and model are required");
		const targetSessionId = await this.requireExistingSessionId(sessionId);
		const reconfiguring = this.reconfigure(targetSessionId, provider, model);
		this.reconfiguring = reconfiguring;
		try {
			await reconfiguring;
		} finally {
			if (this.reconfiguring === reconfiguring) this.reconfiguring = void 0;
		}
		return this.getConversation(targetSessionId);
	}
	async stop(sessionId) {
		const handle = await this.ensureOnline(await this.requireExistingSessionId(sessionId));
		handle.agent.cancel({ kind: "user" }, { keepInbox: false });
		await handle.agent.whenIdle();
		this.publishCurrent();
	}
	async respondToInteraction(rawSessionId, interactionId, response) {
		const sessionId = await this.requireExistingSessionId(rawSessionId);
		await this.ensureOnline(sessionId);
		if (this.activeSessionId !== sessionId) throw new AgentTeamError("INTERACTION_NOT_FOUND", "该交互请求不属于当前团队 Agent 小助手会话");
		await this.interactions.respond(sessionId, interactionId, response);
	}
	async archiveConversation(rawSessionId) {
		if (this.closing) throw new Error("Assistant Builder runtime is closing");
		await this.reconfiguring?.catch(() => void 0);
		await this.switching?.catch(() => void 0);
		await this.starting?.catch(() => void 0);
		const sessionId = rawSessionId.trim();
		if (!isAssistantBuilderSessionId(sessionId)) throw new AgentTeamError("INVALID_REQUEST", `Invalid Assistant Builder conversation '${sessionId}'`);
		if (this.isConversationArchived(sessionId)) return;
		const current = sessionId === this.activeSessionId ? this.handle : void 0;
		if (current?.agent.status === "running") throw new AgentTeamError("INVALID_REQUEST", "请先停止团队 Agent 小助手当前回复，再归档会话");
		await this.ctx.workspaceRegistry.archiveSession(SessionId(sessionId));
		if (current !== void 0) {
			await this.ctx.sessions.flush(current.agent.session);
			await current.dispose();
			if (this.handle === current) this.handle = void 0;
			this.activeSessionId = void 0;
			this.configuration = void 0;
		}
		this.configurations.delete(sessionId);
		this.pendingDrafts.delete(sessionId);
	}
	async dispose() {
		if (this.closing) return;
		this.closing = true;
		this.disposeStatusListener();
		this.disposeConversationListener();
		this.disposeInteractionScope();
		if (this.publishTimer !== void 0) clearTimeout(this.publishTimer);
		this.publishTimer = void 0;
		await this.reconfiguring?.catch(() => void 0);
		await this.switching?.catch(() => void 0);
		await this.starting?.catch(() => void 0);
		const handle = this.handle;
		if (handle === void 0) return;
		handle.agent.cancel({ kind: "disposed" }, { keepInbox: true });
		await handle.agent.whenIdle().catch(() => void 0);
		try {
			await this.ctx.sessions.flush(handle.agent.session);
		} catch (error) {
			this.ctx.logger.warn("agent-team: assistant builder session flush failed", error);
		}
		await handle.dispose();
		this.handle = void 0;
	}
	async ensureOnline(sessionId, allowCreate = false) {
		if (this.closing) throw new Error("Assistant Builder runtime is closing");
		if (this.reconfiguring !== void 0) await this.reconfiguring;
		await this.activate(sessionId);
		if (this.handle !== void 0 && this.activeSessionId === sessionId) return this.handle;
		if (this.starting !== void 0) return this.starting;
		const starting = this.start(sessionId, allowCreate);
		this.starting = starting;
		try {
			const handle = await starting;
			this.handle = handle;
			return handle;
		} catch (error) {
			if (error instanceof AgentTeamError) throw error;
			const message = error instanceof Error ? error.message : String(error);
			this.ctx.logger.warn(`agent-team: assistant builder activation failed: ${message}`, error);
			throw new AgentTeamError("SESSION_CREATE_FAILED", `团队 Agent 小助手启动失败：${message}`, { cause: message }, { cause: error });
		} finally {
			if (this.starting === starting) this.starting = void 0;
		}
	}
	async activate(sessionId) {
		if (this.activeSessionId === sessionId) return;
		if (this.switching !== void 0) await this.switching;
		if (this.activeSessionId === sessionId) return;
		const switching = this.switchSession(sessionId);
		this.switching = switching;
		try {
			await switching;
		} finally {
			if (this.switching === switching) this.switching = void 0;
		}
	}
	async switchSession(sessionId) {
		await this.starting?.catch(() => void 0);
		const current = this.handle;
		if (current?.agent.status === "running") throw new AgentTeamError("INVALID_REQUEST", "请先停止当前小助手回复，再切换会话");
		if (current !== void 0) {
			await this.ctx.sessions.flush(current.agent.session);
			await current.dispose();
		}
		this.handle = void 0;
		this.configuration = this.configurations.get(sessionId);
		this.activeSessionId = sessionId;
	}
	async reconfigure(sessionId, provider, model) {
		await this.validateModelReference(provider, model);
		await this.activate(sessionId);
		await this.starting?.catch(() => void 0);
		const current = this.handle;
		if (current !== void 0 && current.agent.status === "running") throw new AgentTeamError("INVALID_REQUEST", "请先停止团队 Agent 小助手当前回复，再切换模型");
		if (this.configuration?.provider === provider && this.configuration.model === model) return;
		await this.modelPreferences.setSelectedModel(sessionId, provider, model);
		if (current !== void 0) {
			await this.ctx.sessions.flush(current.agent.session);
			await current.dispose();
			if (this.handle === current) this.handle = void 0;
		}
		const nextConfiguration = {
			...this.configuration ?? await this.resolveConfiguration(sessionId),
			provider,
			model
		};
		this.configurations.set(sessionId, nextConfiguration);
		this.configuration = nextConfiguration;
	}
	async start(rawSessionId, allowCreate) {
		const sessionId = SessionId(rawSessionId);
		const cwd = process.cwd();
		if (this.ctx.agents.get(sessionId) !== void 0) throw new AgentTeamError("AGENT_HANDLE_OWNERSHIP_CONFLICT", `Session '${rawSessionId}' is live without this plugin's AgentHandle`);
		const configuration = this.configurations.get(rawSessionId) ?? await this.resolveConfiguration(rawSessionId);
		this.configurations.set(rawSessionId, configuration);
		this.configuration = configuration;
		const rememberedModel = this.modelPreferences.getConversationModel(rawSessionId);
		if (rememberedModel?.provider !== configuration.provider || rememberedModel.model !== configuration.model) await this.modelPreferences.setConversationModel(rawSessionId, configuration.provider, configuration.model);
		const setup = async (agentCtx) => {
			await this.ctx.agentPresets.mount(agentCtx, configuration.agentPresetId);
			agentCtx.tools.presentAs("native");
			const agent = agentCtx.agent;
			if (agent === void 0) throw new Error("Harness did not bind the unpublished Assistant Builder Agent");
			if (agent.session.header.cwd === void 0) agentCtx.systemPrompt.variable("cwd", () => cwd);
			const allowedTools = /* @__PURE__ */ new Set([
				"assistant_builder_get_catalog",
				"assistant_builder_prepare",
				"assistant_builder_commit",
				"ask_user_question"
			]);
			agentCtx.tools.guard((execution) => allowedTools.has(execution.name) ? void 0 : "The built-in Assistant Builder may only read its catalog, prepare a draft, and commit an explicitly confirmed draft.");
			this.registerTools(agentCtx, rawSessionId);
			const deniedTools = agentCtx.tools.schemas(agent).map((tool) => tool.name).filter((name) => !allowedTools.has(name));
			if (deniedTools.length > 0) agentCtx.tools.restrict({ deny: deniedTools });
			const promptSection = "agent-team:assistant-builder";
			agentCtx.systemPrompt.section({
				name: promptSection,
				order: 10,
				text: ASSISTANT_BUILDER_PROMPT
			});
			this.ctx.permissionPresets.set(agent.session, configuration.permissionPresetId);
			if (!(await agentCtx.systemPrompt.assemble(assembleContextFor(agent))).sections.some((section) => section.name === promptSection)) throw new AgentTeamError("PRESET_PROMPT_INCOMPATIBLE", `Preset '${configuration.agentPresetId}' replaced the Assistant Builder prompt`);
		};
		const agentOptions = {
			provider: configuration.provider,
			model: configuration.model
		};
		const persisted = (await this.ctx.sessionPersistence.list()).some((header) => String(header.id) === rawSessionId);
		if (!persisted && !allowCreate) throw new AgentTeamError("INVALID_REQUEST", `Unknown Assistant Builder conversation '${rawSessionId}'`);
		return persisted ? this.ctx.agents.resume({
			resumeSessionId: sessionId,
			agentOptions,
			setup
		}) : this.ctx.agents.create({
			sessionId,
			meta: {
				cwd,
				agentPreset: configuration.agentPresetId
			},
			agentOptions,
			setup
		});
	}
	async resolveConfiguration(sessionId) {
		const selected = this.configurations.get(sessionId);
		const persisted = selected === void 0 ? this.modelPreferences.getConversationModel(sessionId) ?? this.modelPreferences.getLastSelectedModel() : void 0;
		const persistedModel = persisted === void 0 ? void 0 : await this.resolvePersistedModel(persisted);
		const requestedProvider = selected?.provider ?? persistedModel?.provider ?? this.config.assistantBuilderProvider.trim();
		const requestedModel = selected?.model ?? persistedModel?.model ?? this.config.assistantBuilderModel.trim();
		if (requestedModel.length > 0 && requestedProvider.length === 0) throw new AgentTeamError("INVALID_REQUEST", "assistantBuilderModel requires assistantBuilderProvider");
		const providers = this.ctx.llm.listProviders();
		const candidates = requestedProvider.length > 0 ? providers.filter((provider) => provider.id === requestedProvider) : providers;
		if (candidates.length === 0) throw new AgentTeamError("MODEL_REFERENCE_INVALID", requestedProvider.length > 0 ? `Unknown Assistant Builder provider '${requestedProvider}'` : "No model provider is available for the Assistant Builder");
		let provider = "";
		let model = "";
		for (const candidate of candidates) {
			const models = await this.ctx.llm.listModels(candidate.id);
			const selected = requestedModel.length > 0 ? models.find((item) => item.id === requestedModel) : models[0];
			if (selected === void 0) continue;
			provider = candidate.id;
			model = selected.id;
			break;
		}
		if (provider.length === 0 || model.length === 0) throw new AgentTeamError("MODEL_REFERENCE_INVALID", requestedModel.length > 0 ? `Unknown Assistant Builder model '${requestedProvider}/${requestedModel}'` : "No catalog model is available for the Assistant Builder");
		await this.ctx.llm.resolveModelInfo(provider, model);
		const agentPresetId = this.config.assistantBuilderAgentPresetId.trim() || this.ctx.agentPresets.defaultId;
		await this.ctx.agentPresets.resolve(agentPresetId);
		const permissionPresetId = this.config.assistantBuilderPermissionPresetId.trim() || (this.ctx.permissionPresets.names.includes("read-only") ? "read-only" : this.ctx.permissionPresets.defaultPreset);
		if (!this.ctx.permissionPresets.names.includes(permissionPresetId)) throw new AgentTeamError("PERMISSION_PRESET_INVALID", `Unknown Assistant Builder permission preset '${permissionPresetId}'`);
		return {
			provider,
			model,
			agentPresetId,
			permissionPresetId
		};
	}
	async resolvePersistedModel(preference) {
		try {
			await this.ctx.llm.resolveModelInfo(preference.provider, preference.model);
			return preference;
		} catch (error) {
			this.ctx.logger.warn(`agent-team: saved Assistant Builder model '${preference.provider}/${preference.model}' is unavailable; falling back`, error);
			return;
		}
	}
	async validateModelReference(provider, model) {
		if (provider.length === 0 || model.length === 0) throw new AgentTeamError("INVALID_REQUEST", "Assistant Builder provider and model are required");
		try {
			await this.ctx.llm.resolveModelInfo(provider, model);
		} catch (error) {
			throw new AgentTeamError("MODEL_REFERENCE_INVALID", `Cannot resolve Assistant Builder model '${provider}/${model}'`, void 0, { cause: error });
		}
	}
	async requireExistingSessionId(rawSessionId) {
		const sessionId = rawSessionId.trim();
		if (!isAssistantBuilderSessionId(sessionId)) throw new AgentTeamError("INVALID_REQUEST", `Invalid Assistant Builder conversation '${sessionId}'`);
		if (this.isConversationArchived(sessionId)) throw new AgentTeamError("INVALID_REQUEST", `Unknown Assistant Builder conversation '${sessionId}'`);
		if (sessionId === this.activeSessionId) return sessionId;
		if (!(await this.ctx.sessionPersistence.list()).some((header) => String(header.id) === sessionId)) throw new AgentTeamError("INVALID_REQUEST", `Unknown Assistant Builder conversation '${sessionId}'`);
		return sessionId;
	}
	isConversationArchived(sessionId) {
		return this.ctx.workspaceRegistry.archivedSessionIds.some((archivedSessionId) => String(archivedSessionId) === sessionId);
	}
	registerTools(agentCtx, sessionId) {
		agentCtx.tools.register(defineTool({
			name: "assistant_builder_get_catalog",
			description: "Read exact creation options. Pass provider and model after choosing a model to read its reasoning efforts. Pass agentPresetId to read its Skills and MCP Servers.",
			parameters: {
				provider: {
					type: "string",
					description: "Chosen Provider id; pass together with model."
				},
				model: {
					type: "string",
					description: "Chosen model id; pass together with provider."
				},
				agentPresetId: {
					type: "string",
					description: "Chosen Agent Preset id used to discover available Skills and MCP Servers."
				}
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: true
				},
				render: (_args, value) => [{
					type: "text",
					text: JSON.stringify(value)
				}]
			},
			execute: async (args, exec) => {
				this.assertToolIdentity(exec.agent?.id, sessionId);
				const catalog = await this.service.catalog();
				const skillCatalog = args.agentPresetId === void 0 ? void 0 : await this.service.skillCatalog(args.agentPresetId);
				const mcpCatalog = args.agentPresetId === void 0 ? void 0 : await this.service.mcpCatalog(args.agentPresetId);
				if (args.provider === void 0 !== (args.model === void 0)) throw new AgentTeamError("INVALID_REQUEST", "Provider and model must be supplied together");
				const modelCapabilities = args.provider === void 0 || args.model === void 0 ? void 0 : await this.service.modelCapabilities(args.provider, args.model);
				return {
					providers: catalog.providers.map((provider) => ({
						id: provider.id,
						name: provider.name
					})),
					models: catalog.models,
					agentPresets: catalog.agentPresets.filter((preset) => preset.broken === void 0),
					permissionPresets: catalog.permissionPresets.map((preset) => ({
						value: preset.value,
						name: preset.name,
						...preset.description === void 0 ? {} : { description: preset.description }
					})),
					existingAssistants: this.service.listAssistants().items.map((assistant) => assistant.name),
					...modelCapabilities === void 0 ? {} : { modelCapabilities: {
						provider: modelCapabilities.provider,
						model: modelCapabilities.model,
						...modelCapabilities.reasoning === void 0 ? {} : { reasoning: {
							efforts: modelCapabilities.reasoning.efforts.map((effort) => ({ ...effort })),
							...modelCapabilities.reasoning.defaultEffort === void 0 ? {} : { defaultEffort: modelCapabilities.reasoning.defaultEffort }
						} }
					} },
					...skillCatalog === void 0 ? {} : { skills: skillCatalog.skills },
					...mcpCatalog === void 0 ? {} : { mcpServers: mcpCatalog.servers.map((server) => ({
						name: server.name,
						toolCount: server.tools.length,
						tools: server.tools
					})) }
				};
			}
		}));
		agentCtx.tools.register(defineTool({
			name: "assistant_builder_prepare",
			description: "Validate and temporarily store one complete assistant draft. Replaces any older draft; this tool does not create the assistant.",
			parameters: {
				name: {
					type: "string",
					required: true,
					description: "Unique, user-facing assistant name."
				},
				description: {
					type: "string",
					description: "Short user-facing purpose."
				},
				instructions: {
					type: "string",
					required: true,
					description: "Stable responsibilities, constraints, workflow, and acceptance rules."
				},
				provider: {
					type: "string",
					required: true
				},
				model: {
					type: "string",
					required: true
				},
				reasoningEffort: {
					type: "string",
					description: "Optional exact reasoning effort id returned by modelCapabilities. Omit to use the model default."
				},
				agentPresetId: {
					type: "string",
					required: true
				},
				permissionPresetId: {
					type: "string",
					required: true
				},
				skills: {
					type: "array",
					items: { type: "string" },
					description: "Exact Skill names explicitly selected by the user from the chosen preset catalog."
				},
				mcpServers: {
					type: "array",
					items: { type: "string" },
					description: "Exact MCP Server names explicitly selected by the user from the chosen preset catalog."
				}
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: true
				},
				render: (_args, value) => [{
					type: "text",
					text: `草稿“${value.name}”已校验。请展示最终配置，并等待用户在新的消息中明确同意创建；用户可使用自然语言表达，无需固定口令。`
				}]
			},
			execute: async (args, exec) => {
				this.assertToolIdentity(exec.agent?.id, sessionId);
				if (exec.agent === void 0) throw new AgentTeamError("INVALID_REQUEST", "Assistant Builder Agent is unavailable");
				const input = await this.service.validateAssistantDraft({
					name: args.name,
					...args.description === void 0 ? {} : { description: args.description },
					instructions: args.instructions,
					provider: args.provider,
					model: args.model,
					...args.reasoningEffort === void 0 ? {} : { reasoningEffort: args.reasoningEffort },
					agentPresetId: args.agentPresetId,
					permissionPresetId: args.permissionPresetId,
					skillAllowlist: args.skills ?? [],
					mcpServers: args.mcpServers ?? []
				});
				this.pendingDrafts.set(sessionId, {
					input,
					preparedThroughSeq: exec.agent.session.events.at(-1)?.seq ?? -1
				});
				return {
					name: input.name,
					requiresExplicitUserConfirmation: true
				};
			}
		}));
		agentCtx.tools.register(defineTool({
			name: "assistant_builder_commit",
			description: "Create the currently prepared assistant only after a later, real user message clearly approves the final configuration. Natural-language approval is allowed; ambiguity, rejection, questions, or requested changes are not approval.",
			parameters: {},
			output: {
				schema: {
					type: "object",
					properties: {
						id: {
							type: "string",
							required: true
						},
						name: {
							type: "string",
							required: true
						},
						revision: {
							type: "number",
							required: true
						}
					},
					additionalProperties: false
				},
				render: (_args, value) => [{
					type: "text",
					text: `助手“${value.name}”已创建。`
				}]
			},
			execute: async (_args, exec) => {
				this.assertToolIdentity(exec.agent?.id, sessionId);
				if (exec.agent === void 0) throw new AgentTeamError("INVALID_REQUEST", "Assistant Builder Agent is unavailable");
				const pending = this.pendingDrafts.get(sessionId);
				if (pending === void 0) throw new AgentTeamError("INVALID_REQUEST", "没有等待确认的助手草稿，请先重新校验草稿");
				if (!hasFreshAssistantDraftUserResponse(exec.agent.session.events, pending.preparedThroughSeq)) throw new AgentTeamError("INVALID_REQUEST", "必须等待用户在新的消息中明确同意当前助手配置");
				const assistant = await this.service.createAssistant(pending.input);
				if (this.pendingDrafts.get(sessionId) === pending) this.pendingDrafts.delete(sessionId);
				return {
					id: assistant.id,
					name: assistant.name,
					revision: assistant.revision
				};
			}
		}));
	}
	assertToolIdentity(id, sessionId) {
		if (String(id) !== sessionId || !isAssistantBuilderSessionId(sessionId)) throw new AgentTeamError("INVALID_REQUEST", "Assistant Builder tool called outside its owned Agent");
	}
	project(sessionId, events, status) {
		if (this.configuration === void 0) throw new Error("Assistant Builder configuration is unavailable");
		return {
			schemaVersion: 1,
			sessionId,
			status,
			pendingInteractions: this.interactions.list(sessionId),
			...projectConversation(events),
			configuration: this.configuration
		};
	}
	publishCurrent() {
		const handle = this.handle;
		const sessionId = this.activeSessionId;
		if (handle === void 0 || sessionId === void 0 || this.configuration === void 0 || this.closing) return;
		this.service.publishAssistantBuilderConversation(this.project(sessionId, handle.agent.session.events, handle.agent.status));
	}
};
function hasFreshAssistantDraftUserResponse(events, preparedThroughSeq) {
	return events.findLast((event) => event.seq > preparedThroughSeq && event.type === "user/message" && event.data.source.kind === "user")?.type === "user/message";
}
function isAssistantBuilderSessionId(sessionId) {
	return sessionId === "agent-team:assistant-builder" || sessionId.startsWith(ASSISTANT_BUILDER_SESSION_PREFIX);
}
function summarizeConversation(sessionId, createdAt, events) {
	const projection = projectConversation(events, Number.MAX_SAFE_INTEGER);
	const firstUser = projection.nodes.find((node) => node.kind === "user");
	const lastUserSeq = projection.nodes.reduce((latest, node) => node.kind === "user" ? Math.max(latest, node.seq) : latest, -1);
	const lastCommitSeq = projection.nodes.reduce((latest, node) => node.kind === "tool" && node.name === "assistant_builder_commit" && node.status === "success" ? Math.max(latest, node.seq) : latest, -1);
	const lastEventAt = events.at(-1)?.time ?? createdAt;
	return {
		sessionId,
		title: firstUser?.kind === "user" ? conversationTitle(firstUser.text) : "新对话",
		createdAt: new Date(createdAt).toISOString(),
		updatedAt: new Date(lastEventAt).toISOString(),
		state: lastUserSeq < 0 ? "new" : lastCommitSeq >= lastUserSeq ? "completed" : "in_progress"
	};
}
function conversationTitle(text) {
	const compact = text.replace(/\s+/g, " ").trim();
	return compact.length <= 28 ? compact : `${compact.slice(0, 28)}…`;
}
//#endregion
//#region src/runtime/scoped-skills.ts
async function registerScopedSkillProvider(ctx, create) {
	await ctx.inject(["skills"], (injectedCtx) => {
		injectedCtx.skills.registerProvider(create);
	});
}
//#endregion
//#region src/runtime/team-messages.ts
function requireMessageContent(value) {
	const content = value.trim();
	if (content.length === 0) throw new AgentTeamError("INVALID_REQUEST", "Message content cannot be empty");
	if (content.length > 1e5) throw new AgentTeamError("INVALID_REQUEST", "Message content is too large");
	return content;
}
function createTeamMessage(input) {
	return {
		schemaVersion: 1,
		...input,
		attachments: [],
		deliveryState: "queued",
		createdAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
function createTaskDispatchMessage(input) {
	const id = String(MessageId(`agent-team:${randomUUID()}`));
	return createTeamMessage({
		id,
		teamId: input.team.id,
		sender: {
			kind: "member",
			id: input.senderSlotId
		},
		recipient: input.recipientSlotId === input.team.leaderSlotId ? {
			kind: "leader",
			slotId: input.recipientSlotId
		} : {
			kind: "member",
			slotId: input.recipientSlotId
		},
		type: input.type,
		content: input.content,
		relatedTaskId: input.taskId,
		idempotencyKey: id
	});
}
function createSystemTeamMessage(input) {
	const id = String(MessageId(`agent-team:${randomUUID()}`));
	return createTeamMessage({
		id,
		teamId: input.team.id,
		sender: {
			kind: "system",
			id: "dsh-agent-team"
		},
		recipient: input.recipientSlotId === input.team.leaderSlotId ? {
			kind: "leader",
			slotId: input.recipientSlotId
		} : {
			kind: "member",
			slotId: input.recipientSlotId
		},
		type: "system",
		content: input.content,
		idempotencyKey: id
	});
}
function assignmentContent(title, description, fileScopes) {
	return [
		`A team task has been assigned to you: ${title}`,
		description.length === 0 ? void 0 : `Description: ${description}`,
		fileScopes.length === 0 ? void 0 : `File scopes: ${fileScopes.join(", ")}`,
		"Read the task board for the task id, mark it running when you begin, and report progress or the final result with team_update_task."
	].filter((line) => line !== void 0).join("\n");
}
function reassignmentContent(title, result, error) {
	return [
		`A team task has been reassigned to you: ${title}`,
		result === void 0 ? void 0 : `Prior result: ${result}`,
		error === void 0 ? void 0 : `Prior error: ${error}`,
		"Read the task board for details and update the task with team_update_task."
	].filter((line) => line !== void 0).join("\n");
}
function taskUpdateContent(title, status, result, error) {
	return [
		`Task update: ${title}`,
		`Status: ${status}`,
		result === void 0 ? void 0 : `Result: ${result}`,
		error === void 0 ? void 0 : `Error: ${error}`
	].filter((line) => line !== void 0).join("\n");
}
function taskMessageType(status) {
	if (status === "completed") return "result";
	if (status === "blocked") return "question";
	if (status === "failed" || status === "cancelled") return "warning";
	return "progress";
}
function messageFromRecord(team, record) {
	if (record.sender.kind === "system") return freezeMessage({
		id: MessageId(record.id),
		role: "user",
		content: [{
			type: "text",
			text: `[Team event]\n${record.content}`
		}],
		source: {
			kind: "plugin",
			plugin: "dsh-agent-team",
			form: "relay"
		}
	});
	const sender = record.sender.kind === "member" ? team.members[record.sender.id] : void 0;
	const retiredSender = record.sender.kind === "member" ? Object.values(team.retiredSessions).find((session) => session.formerSlotId === record.sender.id) : void 0;
	const senderName = sender?.displayName ?? retiredSender?.displayName ?? "已移出成员";
	const text = record.sender.kind === "member" ? `${teamMessageHeader(senderName, record.sender.id)}\n${record.content}` : record.content;
	return freezeMessage({
		id: MessageId(record.id),
		role: "user",
		content: [{
			type: "text",
			text
		}],
		source: record.sender.kind === "member" ? {
			kind: "plugin",
			plugin: "dsh-agent-team",
			form: "relay"
		} : { kind: "user" }
	});
}
function teamMessageHeader(displayName, slotId) {
	return `[Team message from ${displayName}; slotId=${slotId}]`;
}
function sessionHasMessage(agent, messageId) {
	return agent.session.events.some((event) => {
		if (event.type !== "agent/inbox/spliced") return false;
		return event.data.inserted.some((message) => String(message.id) === messageId);
	});
}
//#endregion
//#region src/runtime/team-command-handler.ts
var TeamCommandHandler = class {
	service;
	port;
	constructor(service, port) {
		this.service = service;
		this.port = port;
	}
	async createTask(teamId, creatorSlotId, input) {
		const team = this.service.getTeam(teamId);
		if (team.leaderSlotId !== creatorSlotId) throw new AgentTeamError("INVALID_REQUEST", "Only the current team leader may create tasks");
		if (input.ownerSlotId !== void 0 && team.members[input.ownerSlotId] === void 0) throw new AgentTeamError("MEMBER_NOT_FOUND", `Unknown task owner '${input.ownerSlotId}'`);
		const title = requireShortText(input.title, "Task title", 500);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const taskId = randomUUID();
		const status = input.ownerSlotId === void 0 ? "pending" : "assigned";
		const owner = input.ownerSlotId === void 0 ? void 0 : team.members[input.ownerSlotId];
		const assignment = owner === void 0 || owner.id === creatorSlotId ? void 0 : createTaskDispatchMessage({
			team,
			senderSlotId: creatorSlotId,
			recipientSlotId: owner.id,
			taskId,
			type: "instruction",
			content: assignmentContent(title, input.description?.trim() ?? "", uniqueStrings(input.fileScopes ?? []))
		});
		await this.service.updateRuntimeTeam(teamId, (current) => ({
			...current,
			tasks: {
				...current.tasks,
				[taskId]: {
					id: taskId,
					title,
					description: input.description?.trim() ?? "",
					status,
					...input.ownerSlotId === void 0 ? {} : { ownerSlotId: input.ownerSlotId },
					createdBySlotId: creatorSlotId,
					dependencyIds: [],
					fileScopes: uniqueStrings(input.fileScopes ?? []),
					revision: 1,
					createdAt: now,
					updatedAt: now
				}
			},
			outbox: assignment === void 0 ? current.outbox : {
				...current.outbox,
				[assignment.id]: assignment
			}
		}), "team.task_created", `Task ${title} created`);
		if (assignment === void 0) return {
			taskId,
			status
		};
		return {
			taskId,
			status,
			deliveryState: await this.port.deliverMessage(teamId, assignment.id) ? "delivered" : "queued"
		};
	}
	async updateTask(teamId, callerSlotId, input) {
		const team = this.service.getTeam(teamId);
		const task = team.tasks[input.taskId];
		if (task === void 0) throw new AgentTeamError("INVALID_REQUEST", `Unknown task '${input.taskId}'`);
		if (callerSlotId !== team.leaderSlotId && task.ownerSlotId !== callerSlotId) throw new AgentTeamError("INVALID_REQUEST", "A member may update only its own task");
		if (input.ownerSlotId !== void 0) {
			if (callerSlotId !== team.leaderSlotId) throw new AgentTeamError("INVALID_REQUEST", "Only the team leader may reassign tasks");
			if (team.members[input.ownerSlotId] === void 0) throw new AgentTeamError("MEMBER_NOT_FOUND", `Unknown task owner '${input.ownerSlotId}'`);
		}
		const nextOwnerSlotId = input.ownerSlotId ?? task.ownerSlotId;
		const shouldDispatchAssignment = input.ownerSlotId !== void 0 && input.ownerSlotId !== task.ownerSlotId && nextOwnerSlotId !== void 0 && nextOwnerSlotId !== callerSlotId;
		const shouldNotifyLeader = callerSlotId !== team.leaderSlotId;
		const notification = shouldDispatchAssignment ? createTaskDispatchMessage({
			team,
			senderSlotId: callerSlotId,
			recipientSlotId: nextOwnerSlotId,
			taskId: task.id,
			type: "instruction",
			content: reassignmentContent(task.title, input.result, input.error)
		}) : shouldNotifyLeader ? createTaskDispatchMessage({
			team,
			senderSlotId: callerSlotId,
			recipientSlotId: team.leaderSlotId,
			taskId: task.id,
			type: taskMessageType(input.status),
			content: taskUpdateContent(task.title, input.status, input.result, input.error)
		}) : void 0;
		await this.service.updateRuntimeTeam(teamId, (current) => ({
			...current,
			tasks: {
				...current.tasks,
				[input.taskId]: {
					...current.tasks[input.taskId],
					status: input.status,
					...input.result === void 0 ? {} : { result: input.result },
					...input.error === void 0 ? {} : { error: input.error },
					...input.ownerSlotId === void 0 ? {} : { ownerSlotId: input.ownerSlotId },
					revision: current.tasks[input.taskId].revision + 1,
					updatedAt: (/* @__PURE__ */ new Date()).toISOString()
				}
			},
			outbox: notification === void 0 ? current.outbox : {
				...current.outbox,
				[notification.id]: notification
			}
		}), "team.task_updated", `Task ${task.title} entered ${input.status}`);
		if (notification === void 0) return {
			taskId: input.taskId,
			status: input.status
		};
		const delivered = await this.port.deliverMessage(teamId, notification.id);
		return {
			taskId: input.taskId,
			status: input.status,
			deliveryState: delivered ? "delivered" : "queued"
		};
	}
	async sendMemberMessage(teamId, senderSlotId, recipientSlotId, rawContent, type = "progress") {
		const team = this.service.getTeam(teamId);
		const sender = team.members[senderSlotId];
		const recipient = team.members[recipientSlotId];
		if (sender === void 0 || recipient === void 0) throw new AgentTeamError("MEMBER_NOT_FOUND", "Sender or recipient is not a current team member");
		if (senderSlotId !== team.leaderSlotId && recipientSlotId !== team.leaderSlotId && !team.directMemberChat) throw new AgentTeamError("INVALID_REQUEST", "Direct member-to-member messages are disabled");
		const content = requireMessageContent(rawContent);
		const relay = createUserMessage({
			content: [{
				type: "text",
				text: `${teamMessageHeader(sender.displayName, sender.id)}\n${content}`
			}],
			source: {
				kind: "plugin",
				plugin: "dsh-agent-team",
				form: "relay"
			}
		});
		const record = createTeamMessage({
			id: String(relay.id),
			teamId,
			sender: {
				kind: "member",
				id: senderSlotId
			},
			recipient: recipientSlotId === team.leaderSlotId ? {
				kind: "leader",
				slotId: recipientSlotId
			} : {
				kind: "member",
				slotId: recipientSlotId
			},
			type,
			content,
			idempotencyKey: String(relay.id)
		});
		await this.service.putRuntimeMessage(record);
		try {
			this.port.followup(recipient.sessionId, relay);
			await this.service.putRuntimeMessage({
				...record,
				deliveryState: "delivered"
			});
			return {
				messageId: record.id,
				deliveryState: "delivered"
			};
		} catch (error) {
			await this.service.putRuntimeMessage({
				...record,
				deliveryState: "failed"
			});
			throw error;
		}
	}
};
function requireShortText(value, label, maxLength) {
	const normalized = value.trim();
	if (normalized.length === 0) throw new AgentTeamError("INVALID_REQUEST", `${label} cannot be empty`);
	if (normalized.length > maxLength) throw new AgentTeamError("INVALID_REQUEST", `${label} is too long`);
	return normalized;
}
function uniqueStrings(values) {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
//#endregion
//#region src/runtime/team-interaction-bridge.ts
var TeamInteractionBridge = class {
	ctx;
	records = /* @__PURE__ */ new Map();
	scopes = /* @__PURE__ */ new Set();
	abortController;
	consumeTask;
	constructor(ctx, scope) {
		this.ctx = ctx;
		if (scope !== void 0) this.scopes.add(scope);
	}
	registerScope(scope) {
		this.scopes.add(scope);
		return () => {
			this.scopes.delete(scope);
		};
	}
	start() {
		if (this.abortController !== void 0) return;
		const controller = new AbortController();
		this.abortController = controller;
		this.consumeTask = this.consume(controller.signal).catch((error) => {
			if (!controller.signal.aborted) this.ctx.logger.error("agent-team: interaction mux stopped unexpectedly", error);
		});
	}
	list(sessionId) {
		return [...this.records.values()].filter((record) => String(record.sessionId) === sessionId).map(toView);
	}
	forget(sessionId) {
		for (const [id, record] of this.records) if (String(record.sessionId) === sessionId) this.records.delete(id);
	}
	async respond(sessionId, interactionId, response) {
		const record = this.records.get(interactionId);
		if (record === void 0) throw new AgentTeamError("INTERACTION_NOT_FOUND", "该交互请求已结束或不存在");
		if (String(record.sessionId) !== sessionId || !this.acceptsSession(sessionId)) throw new AgentTeamError("INTERACTION_NOT_FOUND", "该交互请求不属于指定的会话");
		let value;
		if (record.kind === "question") {
			if (response.kind !== "question") throw new AgentTeamError("INTERACTION_INVALID", "交互响应类型与待处理请求不匹配");
			value = {
				sessionId: record.sessionId,
				answer: { answers: normalizeQuestionAnswers(record.questions, response.answers) }
			};
		} else {
			if (response.kind !== "approval") throw new AgentTeamError("INTERACTION_INVALID", "交互响应类型与待处理请求不匹配");
			value = {
				sessionId: record.sessionId,
				approvalId: record.approvalId,
				outcome: response.outcome
			};
		}
		const receipt = await this.ctx.apiProxy.respond({
			type: "client-response",
			rpcId: record.rpcId,
			result: {
				ok: true,
				value
			}
		});
		if (receipt.accepted) return;
		if (receipt.reason === "not-pending") {
			this.records.delete(record.id);
			this.notifyChange(String(record.sessionId));
			throw new AgentTeamError("INTERACTION_NOT_PENDING", "该交互请求已由其他页面处理");
		}
		throw new AgentTeamError("INTERACTION_INVALID", "Harness 拒绝了该交互响应");
	}
	async dispose() {
		const controller = this.abortController;
		this.abortController = void 0;
		controller?.abort();
		await this.consumeTask;
		this.consumeTask = void 0;
		this.records.clear();
	}
	async consume(signal) {
		const stream = this.ctx.apiProxy.events.mux({
			rpcId: RpcId(randomUUID()),
			payload: {}
		}, signal);
		for await (const envelope of stream) {
			if (signal.aborted) return;
			this.accept(envelope);
		}
	}
	accept(envelope) {
		const frame = envelope.payload;
		if (frame.type === "question/requested") {
			if (!this.acceptsSession(String(frame.sessionId))) return;
			const record = {
				id: `question:${String(envelope.rpcId)}`,
				kind: "question",
				rpcId: envelope.rpcId,
				sessionId: frame.sessionId,
				questions: frame.questions.map((question) => ({
					id: question.id,
					question: question.question,
					...question.detail === void 0 ? {} : { detail: question.detail },
					...question.header === void 0 ? {} : { header: question.header },
					...question.options === void 0 ? {} : { options: question.options.map((option) => ({
						label: option.label,
						...option.description === void 0 ? {} : { description: option.description }
					})) },
					...question.multiSelect === void 0 ? {} : { multiSelect: question.multiSelect },
					...question.intent === void 0 ? {} : { intent: { ...question.intent } }
				}))
			};
			this.records.set(record.id, record);
			this.notifyChange(String(frame.sessionId));
			return;
		}
		if (frame.type === "approval/requested") {
			if (!this.acceptsSession(String(frame.sessionId))) return;
			const record = {
				id: `approval:${String(frame.approvalId)}`,
				kind: "approval",
				rpcId: envelope.rpcId,
				sessionId: frame.sessionId,
				approvalId: frame.approvalId,
				toolName: frame.toolName,
				...frame.callId === void 0 ? {} : { callId: String(frame.callId) },
				...frame.reason === void 0 ? {} : { reason: frame.reason }
			};
			this.records.set(record.id, record);
			this.notifyChange(String(frame.sessionId));
			return;
		}
		if (frame.type === "question/resolved") {
			this.remove(`question:${String(frame.questionRpcId)}`, String(frame.sessionId));
			return;
		}
		if (frame.type === "approval/resolved") this.remove(`approval:${String(frame.approvalId)}`, String(frame.sessionId));
	}
	remove(id, sessionId) {
		if (!this.records.delete(id)) return;
		this.notifyChange(sessionId);
	}
	acceptsSession(sessionId) {
		return [...this.scopes].some((scope) => scope.acceptsSession(sessionId));
	}
	notifyChange(sessionId) {
		for (const scope of this.scopes) if (scope.acceptsSession(sessionId)) scope.onChange(sessionId);
	}
};
function normalizeQuestionAnswers(questions, answers) {
	const byId = /* @__PURE__ */ new Map();
	for (const answer of answers) {
		if (byId.has(answer.id)) throw new AgentTeamError("INTERACTION_INVALID", `问题“${answer.id}”存在重复答案`);
		byId.set(answer.id, answer);
	}
	if (byId.size !== questions.length) throw new AgentTeamError("INTERACTION_INVALID", "请完成全部问题后再提交");
	return questions.map((question) => {
		const answer = byId.get(question.id);
		if (answer === void 0) throw new AgentTeamError("INTERACTION_INVALID", `缺少问题“${question.id}”的答案`);
		const selected = [...answer.selected];
		if (new Set(selected).size !== selected.length) throw new AgentTeamError("INTERACTION_INVALID", `问题“${question.id}”包含重复选项`);
		const allowed = new Set(question.options?.map((option) => option.label) ?? []);
		if (selected.some((label) => !allowed.has(label))) throw new AgentTeamError("INTERACTION_INVALID", `问题“${question.id}”包含无效选项`);
		if (question.multiSelect !== true && selected.length > 1) throw new AgentTeamError("INTERACTION_INVALID", `问题“${question.id}”只能选择一个选项`);
		const custom = answer.custom?.trim();
		if (question.multiSelect !== true && custom !== void 0 && custom.length > 0 && selected.length > 0) throw new AgentTeamError("INTERACTION_INVALID", `问题“${question.id}”的自定义答案不能与单选项同时提交`);
		if (selected.length === 0 && (custom === void 0 || custom.length === 0)) throw new AgentTeamError("INTERACTION_INVALID", `请回答问题“${question.question}”`);
		return {
			id: question.id,
			selected,
			...custom === void 0 || custom.length === 0 ? {} : { custom }
		};
	});
}
function toView(record) {
	if (record.kind === "question") return {
		id: record.id,
		kind: record.kind,
		questions: record.questions
	};
	return {
		id: record.id,
		kind: record.kind,
		approvalId: String(record.approvalId),
		toolName: record.toolName,
		...record.callId === void 0 ? {} : { callId: record.callId },
		...record.reason === void 0 ? {} : { reason: record.reason }
	};
}
//#endregion
//#region src/runtime/team-message-dispatcher.ts
var TeamMessageDispatcher = class {
	service;
	port;
	constructor(service, port) {
		this.service = service;
		this.port = port;
	}
	async recover(team) {
		for (const messageId of Object.keys(team.outbox)) await this.deliver(team.id, messageId);
		team = this.service.getTeam(team.id);
		const pending = this.service.listMessages(team.id).items.filter((message) => message.deliveryState === "queued");
		for (const record of pending) {
			const slotId = record.recipient.slotId;
			if (slotId === void 0) continue;
			const recipient = team.members[slotId];
			if (recipient === void 0) {
				await this.service.putRuntimeMessage({
					...record,
					deliveryState: "failed"
				});
				continue;
			}
			const agent = this.port.resolveAgent(recipient.sessionId);
			if (!sessionHasMessage(agent, record.id)) agent.followup(messageFromRecord(team, record));
			await this.service.putRuntimeMessage({
				...record,
				deliveryState: "delivered"
			});
		}
	}
	async deliver(teamId, messageId) {
		const current = this.service.getTeam(teamId);
		const record = current.outbox[messageId];
		if (record === void 0) return true;
		const slotId = record.recipient.slotId;
		const recipient = slotId === void 0 ? void 0 : current.members[slotId];
		if (recipient === void 0) {
			await this.service.putRuntimeMessage({
				...record,
				deliveryState: "failed"
			});
			return false;
		}
		try {
			await this.service.putRuntimeMessage({
				...record,
				deliveryState: "queued"
			});
			const agent = this.port.resolveAgent(recipient.sessionId);
			if (!sessionHasMessage(agent, record.id)) agent.followup(messageFromRecord(current, record));
			await this.service.putRuntimeMessage({
				...record,
				deliveryState: "delivered"
			});
			await this.service.updateRuntimeTeam(teamId, (team) => {
				if (team.outbox[messageId] === void 0) return team;
				const outbox = { ...team.outbox };
				delete outbox[messageId];
				return {
					...team,
					outbox
				};
			}, "team.message_delivered", `Team message ${messageId} delivered`);
			return true;
		} catch (error) {
			await this.service.putRuntimeMessage({
				...record,
				deliveryState: "failed"
			});
			this.port.warn(`agent-team: queued message ${messageId} delivery failed`, error);
			return false;
		}
	}
};
//#endregion
//#region src/runtime/team-prompts.ts
function memberPrompt(team, member) {
	return [
		`You are ${member.displayName}, an independent Agent in the team “${team.name}”.`,
		`Your role is ${member.role}. The leader coordinates work but does not own other Agents.`,
		"All team members operate in the same Workspace. Coordinate before editing overlapping files.",
		member.assistantSnapshot.instructions
	].filter(Boolean).join("\n\n");
}
function rosterPrompt(team) {
	return [
		`Team roster:\n${Object.values(team.members).map((member) => `- ${member.displayName} (${member.role}), slotId=${member.id}`).join("\n")}`,
		"The shared task board and durable team mailbox are the coordination protocol.",
		"Leaders assign work with team_create_task; assigning an owner automatically queues and delivers the task to that member.",
		"Members must use team_update_task for status and results; member updates automatically notify the Leader.",
		"Use team_send_message for questions and other explicit member communication."
	].join("\n");
}
//#endregion
//#region src/runtime/team-tools.ts
function registerTeamTools(agentCtx, handlers) {
	agentCtx.tools.register(defineTool({
		name: "team_get_task_board",
		description: "Read the current shared task board for this Agent Team.",
		parameters: {},
		output: {
			schema: {
				type: "object",
				additionalProperties: true
			},
			render: (_args, value) => [{
				type: "text",
				text: JSON.stringify(value)
			}]
		},
		execute: async (_args, exec) => {
			handlers.assertIdentity(exec.agent);
			return handlers.getTaskBoard();
		}
	}));
	agentCtx.tools.register(defineTool({
		name: "team_create_task",
		description: "Create and optionally assign a task on the shared team task board. Only the current leader may call this.",
		parameters: {
			title: {
				type: "string",
				required: true
			},
			description: { type: "string" },
			ownerSlotId: {
				type: "string",
				description: "Current member slot id to assign."
			},
			fileScopes: {
				type: "array",
				items: { type: "string" },
				description: "Workspace-relative file scopes."
			}
		},
		output: {
			schema: {
				type: "object",
				properties: {
					taskId: {
						type: "string",
						required: true
					},
					status: {
						type: "string",
						required: true
					},
					deliveryState: {
						type: "string",
						enum: ["queued", "delivered"]
					}
				},
				additionalProperties: false
			},
			render: (_args, value) => [{
				type: "text",
				text: `Created team task ${value.taskId} (${value.status})${value.deliveryState === void 0 ? "" : `; assignment ${value.deliveryState}`}`
			}]
		},
		execute: async (args, exec) => {
			handlers.assertIdentity(exec.agent);
			return handlers.createTask(args);
		}
	}));
	agentCtx.tools.register(defineTool({
		name: "team_update_task",
		description: "Update a task you own; the team leader may update any task.",
		parameters: {
			taskId: {
				type: "string",
				required: true
			},
			status: {
				type: "string",
				required: true,
				enum: [
					"pending",
					"assigned",
					"running",
					"blocked",
					"completed",
					"failed",
					"cancelled"
				]
			},
			result: { type: "string" },
			error: { type: "string" },
			ownerSlotId: {
				type: "string",
				description: "Leader-only reassignment target."
			}
		},
		output: {
			schema: {
				type: "object",
				properties: {
					taskId: {
						type: "string",
						required: true
					},
					status: {
						type: "string",
						required: true
					},
					deliveryState: {
						type: "string",
						enum: ["queued", "delivered"]
					}
				},
				additionalProperties: false
			},
			render: (_args, value) => [{
				type: "text",
				text: `Updated team task ${value.taskId} (${value.status})${value.deliveryState === void 0 ? "" : `; notification ${value.deliveryState}`}`
			}]
		},
		execute: async (args, exec) => {
			handlers.assertIdentity(exec.agent);
			return handlers.updateTask(args);
		}
	}));
	agentCtx.tools.register(defineTool({
		name: "team_send_message",
		description: "Send a message to another member in this Agent Team and wake that member.",
		parameters: {
			recipientSlotId: {
				type: "string",
				required: true,
				description: "Recipient member slot id."
			},
			content: {
				type: "string",
				required: true,
				description: "Message content."
			},
			type: {
				type: "string",
				enum: [
					"instruction",
					"progress",
					"result",
					"question",
					"warning"
				],
				description: "Message purpose."
			}
		},
		output: {
			schema: {
				type: "object",
				properties: {
					messageId: {
						type: "string",
						required: true
					},
					deliveryState: {
						type: "string",
						const: "delivered",
						required: true
					}
				},
				additionalProperties: false
			},
			render: (_args, value) => [{
				type: "text",
				text: `Delivered team message ${value.messageId}`
			}]
		},
		execute: async (args, exec) => {
			handlers.assertIdentity(exec.agent);
			return handlers.sendMessage(args.recipientSlotId, args.content, args.type);
		}
	}));
}
//#endregion
//#region src/runtime/team-runtime.ts
var TeamRuntime = class {
	ctx;
	config;
	service;
	owned = /* @__PURE__ */ new Map();
	activating = /* @__PURE__ */ new Map();
	operations = /* @__PURE__ */ new Map();
	disposeStatusListener;
	disposeConversationListener;
	conversationPublishes = /* @__PURE__ */ new Map();
	messages;
	commands;
	interactions;
	closing = false;
	constructor(ctx, config, service) {
		this.ctx = ctx;
		this.config = config;
		this.service = service;
		this.messages = new TeamMessageDispatcher(service, {
			resolveAgent: (sessionId) => this.requireOwned(sessionId).handle.agent,
			warn: (message, error) => {
				ctx.logger.warn(message, error);
			}
		});
		this.commands = new TeamCommandHandler(service, {
			deliverMessage: (teamId, messageId) => this.messages.deliver(teamId, messageId),
			followup: (sessionId, message) => {
				this.requireOwned(sessionId).handle.agent.followup(message);
			}
		});
		this.interactions = new TeamInteractionBridge(ctx, {
			acceptsSession: (sessionId) => this.owned.has(sessionId),
			onChange: (sessionId) => {
				this.publishOwnedConversation(sessionId);
			}
		});
		this.disposeStatusListener = ctx.on("agent/status", ({ agent, status }) => {
			const owned = this.owned.get(String(agent.id));
			if (owned === void 0) return;
			this.setMemberRuntimeState(owned.teamId, owned.slotId, status).catch((error) => this.ctx.logger.warn("agent-team: failed to persist agent status", error));
		});
		this.disposeConversationListener = ctx.on("session/event", (session) => {
			if (this.owned.get(String(session.id)) === void 0 || this.conversationPublishes.has(String(session.id))) return;
			const timer = setTimeout(() => {
				this.conversationPublishes.delete(String(session.id));
				try {
					this.publishOwnedConversation(String(session.id));
				} catch (error) {
					this.ctx.logger.warn("agent-team: failed to publish conversation update", error);
				}
			}, 48);
			this.conversationPublishes.set(String(session.id), timer);
		});
	}
	startInteractionBridge() {
		this.interactions.start();
	}
	interactionBridge() {
		return this.interactions;
	}
	async getWorkbench(teamId) {
		const team = this.service.getTeam(teamId);
		const conversations = await Promise.all(Object.values(team.members).map(async (member) => {
			let events = this.owned.get(member.sessionId)?.handle.agent.session.events;
			if (events === void 0) try {
				events = (await this.ctx.sessionPersistence.inspect(SessionId(member.sessionId))).events;
			} catch {
				events = [];
			}
			return this.projectMemberConversation(team, member, events);
		}));
		return {
			schemaVersion: 1,
			teamId: team.id,
			revision: team.revision,
			conversations
		};
	}
	async stopMember(teamId, slotId) {
		const team = this.service.getTeam(teamId);
		if (team.state !== "active") throw new AgentTeamError("TEAM_NOT_ACTIVE", `Team '${team.name}' is not active`);
		const member = team.members[slotId];
		if (member === void 0) throw new AgentTeamError("MEMBER_NOT_FOUND", `Unknown member '${slotId}'`);
		const owned = this.requireOwned(member.sessionId);
		owned.handle.agent.cancel({ kind: "user" });
		await owned.handle.agent.whenIdle();
		await this.setMemberRuntimeState(teamId, slotId, "idle");
		const current = this.service.getTeam(teamId);
		const currentMember = current.members[slotId];
		if (currentMember !== void 0) this.service.publishConversation(teamId, current.revision, this.projectMemberConversation(current, currentMember, owned.handle.agent.session.events));
	}
	async respondToInteraction(teamId, slotId, interactionId, response) {
		const member = this.service.getTeam(teamId).members[slotId];
		if (member === void 0) throw new AgentTeamError("MEMBER_NOT_FOUND", `Unknown member '${slotId}'`);
		const owned = this.owned.get(member.sessionId);
		if (owned === void 0 || owned.teamId !== teamId || owned.slotId !== slotId) throw new AgentTeamError("INTERACTION_NOT_FOUND", "该交互请求不属于指定的团队成员");
		await this.interactions.respond(member.sessionId, interactionId, response);
	}
	setMemberPermissionPreset(teamId, slotId, permissionPresetId) {
		return this.exclusive(teamId, async () => {
			const team = this.service.getTeam(teamId);
			if (team.state !== "active" && team.state !== "error") throw new AgentTeamError("TEAM_NOT_ACTIVE", `Cannot change member permission while team is '${team.state}'`);
			const member = team.members[slotId];
			if (member === void 0) throw new AgentTeamError("MEMBER_NOT_FOUND", `Unknown member '${slotId}'`);
			const owned = this.requireOwned(member.sessionId);
			const previous = member.permissionPresetId;
			this.ctx.permissionPresets.set(owned.handle.agent.session, permissionPresetId);
			try {
				return await this.service.updateRuntimeTeam(teamId, (current) => ({
					...current,
					members: mapMembers(current, (currentMember) => currentMember.id === slotId ? {
						...currentMember,
						permissionPresetId
					} : currentMember)
				}), "team.member_permission_changed", `Member ${member.displayName} permission changed to ${permissionPresetId}`);
			} catch (error) {
				this.ctx.permissionPresets.set(owned.handle.agent.session, previous);
				throw error;
			}
		});
	}
	setMemberReasoningEffort(teamId, slotId, reasoningEffort) {
		return this.exclusive(teamId, async () => {
			const team = this.service.getTeam(teamId);
			if (team.state !== "active" && team.state !== "error") throw new AgentTeamError("TEAM_NOT_ACTIVE", `Cannot change member reasoning while team is '${team.state}'`);
			const member = team.members[slotId];
			if (member === void 0) throw new AgentTeamError("MEMBER_NOT_FOUND", `Unknown member '${slotId}'`);
			const owned = this.requireOwned(member.sessionId);
			const previous = owned.modelSelection.current;
			owned.modelSelection.current = {
				provider: member.assistantSnapshot.provider,
				model: member.assistantSnapshot.model,
				...reasoningEffort === void 0 ? {} : { reasoningEffort: ReasoningEffortId(reasoningEffort) }
			};
			try {
				return await this.service.updateRuntimeTeam(teamId, (current) => ({
					...current,
					members: mapMembers(current, (currentMember) => currentMember.id === slotId ? withReasoningEffort(currentMember, reasoningEffort) : currentMember)
				}), "team.member_reasoning_changed", `Member ${member.displayName} reasoning changed to ${reasoningEffort ?? "model default"}`);
			} catch (error) {
				owned.modelSelection.current = previous;
				throw error;
			}
		});
	}
	projectMemberConversation(team, member, events) {
		const status = this.owned.get(member.sessionId)?.handle.agent.status ?? member.lastRuntimeState;
		const contextUsage = projectContextUsage(events);
		return {
			slotId: member.id,
			sessionId: member.sessionId,
			status,
			pendingInteractions: this.interactions.list(member.sessionId),
			...projectConversation(events, 240, {
				team,
				messages: this.service.listMessages(team.id).items
			}),
			...contextUsage === void 0 ? {} : { contextUsage }
		};
	}
	startTeam(teamId) {
		return this.exclusive(teamId, () => this.startTeamUnlocked(teamId));
	}
	activateMember(teamId, slotId) {
		return this.exclusive(teamId, async () => {
			const team = this.service.getTeam(teamId);
			const member = team.members[slotId];
			if (member === void 0) throw new AgentTeamError("MEMBER_NOT_FOUND", `Unknown member '${slotId}'`);
			const materialized = new Set((await this.ctx.sessionPersistence.list()).map((header) => String(header.id)));
			try {
				await this.ensureMemberOnline(team, member, materialized.has(member.sessionId));
				const current = this.service.getTeam(teamId);
				const readyMember = current.members[slotId];
				if (readyMember === void 0) throw new AgentTeamError("MEMBER_NOT_FOUND", `Member '${slotId}' disappeared during activation`);
				const notice = createSystemTeamMessage({
					team: current,
					recipientSlotId: current.leaderSlotId,
					content: [
						`新成员「${readyMember.displayName}」已加入团队。`,
						`成员 ID：${readyMember.id}`,
						`模型：${readyMember.assistantSnapshot.provider} / ${readyMember.assistantSnapshot.model}`,
						"状态：已就绪，可以分配任务。"
					].join("\n")
				});
				await this.service.updateRuntimeTeam(teamId, (latest) => ({
					...latest,
					outbox: {
						...latest.outbox,
						[notice.id]: notice
					}
				}), "team.member_ready", `Member ${readyMember.displayName} is ready`);
				await this.messages.deliver(teamId, notice.id);
				return this.service.getTeam(teamId);
			} catch (error) {
				await this.markTeamError(teamId, error);
				throw error;
			}
		});
	}
	removeMember(teamId, slotId) {
		return this.exclusive(teamId, async () => {
			const team = this.service.getTeam(teamId);
			if (team.state !== "active" && team.state !== "error") throw new AgentTeamError("TEAM_NOT_ACTIVE", `Cannot remove a runtime member while team is '${team.state}'`);
			const member = team.members[slotId];
			if (member === void 0) throw new AgentTeamError("MEMBER_NOT_FOUND", `Unknown member '${slotId}'`);
			if (slotId === team.leaderSlotId) throw new AgentTeamError("MEMBER_IS_LEADER", "Choose a successor before removing the current leader");
			const openTasks = Object.values(team.tasks).filter((task) => task.ownerSlotId === slotId && ![
				"completed",
				"failed",
				"cancelled"
			].includes(task.status));
			if (openTasks.length > 0) throw new AgentTeamError("MEMBER_BUSY", "Resolve this member’s open tasks before removal", { taskIds: openTasks.map((task) => task.id) });
			const owned = this.owned.get(member.sessionId);
			const sessionId = SessionId(member.sessionId);
			if (owned === void 0 && this.ctx.agents.get(sessionId) !== void 0) throw new AgentTeamError("AGENT_HANDLE_OWNERSHIP_CONFLICT", `Session '${member.sessionId}' is live without this plugin's AgentHandle`);
			if (owned !== void 0) {
				owned.handle.agent.cancel({ kind: "user" }, { keepInbox: false });
				await owned.handle.agent.whenIdle();
				await this.ctx.sessions.flush(owned.handle.agent.session);
				this.owned.delete(member.sessionId);
				this.interactions.forget(member.sessionId);
				await owned.handle.dispose();
			}
			const workspace = this.ctx.workspaceRegistry.get(WorkspaceId(team.workspaceId));
			if (workspace !== void 0) await workspace.detachSession(sessionId);
			const removedAt = (/* @__PURE__ */ new Date()).toISOString();
			const notice = createSystemTeamMessage({
				team,
				recipientSlotId: team.leaderSlotId,
				content: `团队成员「${member.displayName}」（成员 ID：${member.id}）已被移出团队，其 Session 已停止并归档。后续任务请重新分配给其他成员。`
			});
			await this.service.updateRuntimeTeam(teamId, (current) => {
				const members = { ...current.members };
				delete members[slotId];
				return {
					...current,
					members,
					retiredSessions: {
						...current.retiredSessions,
						[member.sessionId]: {
							formerSlotId: member.id,
							sessionId: member.sessionId,
							displayName: member.displayName,
							removedAt
						}
					},
					outbox: {
						...current.outbox,
						[notice.id]: notice
					}
				};
			}, "team.member_removed", `Member ${member.displayName} removed; Session history retained`);
			await this.messages.deliver(teamId, notice.id);
			return this.service.getTeam(teamId);
		});
	}
	resetTeam(teamId) {
		return this.exclusive(teamId, async () => {
			const team = this.service.getTeam(teamId);
			if (![
				"draft",
				"active",
				"error"
			].includes(team.state)) throw new AgentTeamError("TEAM_NOT_ACTIVE", `Cannot reset team in state '${team.state}'`);
			const workspace = this.ctx.workspaceRegistry.get(WorkspaceId(team.workspaceId));
			if (workspace === void 0 || await workspace.status() !== "ok" || workspace.path !== team.workspacePath) throw new AgentTeamError("WORKSPACE_UNAVAILABLE", `Workspace '${team.workspaceId}' is unavailable or changed`);
			const members = Object.values(team.members);
			for (const member of members) {
				const sessionId = SessionId(member.sessionId);
				if (this.owned.get(member.sessionId) === void 0 && this.ctx.agents.get(sessionId) !== void 0) throw new AgentTeamError("AGENT_HANDLE_OWNERSHIP_CONFLICT", `Session '${member.sessionId}' is live without this plugin's AgentHandle`);
			}
			const owned = members.map((member) => ({
				member,
				owned: this.owned.get(member.sessionId)
			})).filter((entry) => entry.owned !== void 0);
			for (const entry of owned) entry.owned.handle.agent.cancel({ kind: "user" }, { keepInbox: false });
			await Promise.all(owned.map((entry) => entry.owned.handle.agent.whenIdle()));
			for (const entry of owned) {
				try {
					await this.ctx.sessions.flush(entry.owned.handle.agent.session);
				} catch (error) {
					this.ctx.logger.warn(`agent-team: old session flush failed during reset for ${entry.member.sessionId}`, error);
				}
				this.owned.delete(entry.member.sessionId);
				this.interactions.forget(entry.member.sessionId);
				await entry.owned.handle.dispose();
			}
			for (const member of members) try {
				await workspace.detachSession(SessionId(member.sessionId));
			} catch (error) {
				this.ctx.logger.warn(`agent-team: old workspace session detach failed during reset for ${member.sessionId}`, error);
			}
			await this.service.retireQueuedMessages(teamId);
			const resetAt = (/* @__PURE__ */ new Date()).toISOString();
			const shouldRestart = team.state !== "draft";
			const next = await this.service.updateRuntimeTeam(teamId, (current) => ({
				...current,
				state: shouldRestart ? "starting" : "draft",
				tasks: {},
				leases: {},
				outbox: {},
				retiredSessions: current.state === "draft" ? current.retiredSessions : {
					...current.retiredSessions,
					...Object.fromEntries(Object.values(current.members).map((member) => [member.sessionId, {
						formerSlotId: member.id,
						sessionId: member.sessionId,
						displayName: member.displayName,
						removedAt: resetAt
					}]))
				},
				members: mapMembers(current, (member) => ({
					...member,
					sessionId: `agent-team:${randomUUID()}`,
					desiredState: current.state === "draft" ? "offline" : "online",
					lastRuntimeState: shouldRestart ? "starting" : "offline"
				}))
			}), "team.context_reset", `Team ${team.name} task board and member contexts reset`);
			if (!shouldRestart) return next;
			try {
				await this.ensureMembersOnline(next);
				return await this.service.updateRuntimeTeam(teamId, (current) => ({
					...current,
					state: "active"
				}), "team.context_reset_completed", `Team ${team.name} restarted with fresh member contexts`);
			} catch (error) {
				await this.markTeamError(teamId, error);
				throw error;
			}
		});
	}
	dissolveTeam(teamId) {
		return this.exclusive(teamId, async () => {
			let team = this.service.getTeam(teamId);
			const members = Object.values(team.members);
			for (const member of members) {
				const sessionId = SessionId(member.sessionId);
				if (this.owned.get(member.sessionId) === void 0 && this.ctx.agents.get(sessionId) !== void 0) throw new AgentTeamError("AGENT_HANDLE_OWNERSHIP_CONFLICT", `Session '${member.sessionId}' is live without this plugin's AgentHandle`);
			}
			if (team.state !== "deleting") team = await this.service.updateRuntimeTeam(teamId, (current) => ({
				...current,
				state: "deleting"
			}), "team.deleting", `Team ${team.name} dissolution started`);
			try {
				const owned = members.map((member) => ({
					member,
					owned: this.owned.get(member.sessionId)
				})).filter((entry) => entry.owned !== void 0);
				for (const entry of owned) entry.owned.handle.agent.cancel({ kind: "user" }, { keepInbox: false });
				await Promise.all(owned.map((entry) => entry.owned.handle.agent.whenIdle()));
				for (const entry of owned) {
					try {
						await this.ctx.sessions.flush(entry.owned.handle.agent.session);
					} catch (error) {
						this.ctx.logger.warn(`agent-team: final session flush failed during dissolution for ${entry.member.sessionId}`, error);
					}
					await entry.owned.handle.dispose();
					this.owned.delete(entry.member.sessionId);
					this.interactions.forget(entry.member.sessionId);
				}
				const workspace = this.ctx.workspaceRegistry.get(WorkspaceId(team.workspaceId));
				if (workspace !== void 0) {
					const sessionIds = /* @__PURE__ */ new Set([...members.map((member) => member.sessionId), ...Object.keys(team.retiredSessions)]);
					for (const sessionId of sessionIds) await workspace.detachSession(SessionId(sessionId));
				}
				await this.service.deleteTeamRecords(teamId);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				try {
					await this.service.updateRuntimeTeam(teamId, (current) => ({
						...current,
						state: "delete_blocked"
					}), "team.delete_blocked", message);
				} catch (updateError) {
					this.ctx.logger.warn(`agent-team: failed to persist blocked dissolution for ${teamId}`, updateError);
				}
				throw error instanceof AgentTeamError ? error : new AgentTeamError("TEAM_DELETE_FAILED", `团队“${team.name}”解散失败：${message}`, {
					teamId,
					cause: message
				}, { cause: error });
			}
		});
	}
	async sendUserMessage(teamId, rawContent, targetSlotId) {
		const team = this.service.getTeam(teamId);
		if (team.state !== "active") throw new AgentTeamError("TEAM_NOT_ACTIVE", `Team '${team.name}' is not active`);
		const slotId = targetSlotId ?? team.leaderSlotId;
		const target = team.members[slotId];
		if (target === void 0) throw new AgentTeamError("MEMBER_NOT_FOUND", `Unknown member '${slotId}'`);
		if (slotId !== team.leaderSlotId && !team.directMemberChat) throw new AgentTeamError("INVALID_REQUEST", "Direct member chat is disabled for this team");
		const content = requireMessageContent(rawContent);
		const owned = this.requireOwned(target.sessionId);
		const message = createUserMessage({
			content: [{
				type: "text",
				text: content
			}],
			source: { kind: "user" }
		});
		const record = createTeamMessage({
			id: String(message.id),
			teamId,
			sender: {
				kind: "user",
				id: "local-user"
			},
			recipient: slotId === team.leaderSlotId ? {
				kind: "leader",
				slotId
			} : {
				kind: "member",
				slotId
			},
			type: "instruction",
			content,
			idempotencyKey: String(message.id)
		});
		await this.service.putRuntimeMessage(record);
		try {
			owned.handle.agent.followup(message);
			const delivered = {
				...record,
				deliveryState: "delivered"
			};
			await this.service.putRuntimeMessage(delivered);
			return delivered;
		} catch (error) {
			await this.service.putRuntimeMessage({
				...record,
				deliveryState: "failed"
			});
			throw error;
		}
	}
	async recoverTeams() {
		await mapConcurrent(this.service.listTeams().items.filter((team) => team.state === "active" || team.state === "starting" || team.state === "error"), this.config.runtimeConcurrency, async (team) => {
			try {
				await this.exclusive(team.id, async () => {
					await this.ensureMembersOnline(team);
					await this.messages.recover(this.service.getTeam(team.id));
					await this.service.updateRuntimeTeam(team.id, (current) => ({
						...current,
						state: "active"
					}), "team.recovered", `Team ${team.name} recovered after plugin startup`);
				});
			} catch (error) {
				this.ctx.logger.warn(`agent-team: failed to recover team ${team.id}`, error);
				await this.markTeamError(team.id, error);
			}
		});
	}
	async dispose() {
		if (this.closing) return;
		this.closing = true;
		this.disposeStatusListener();
		this.disposeConversationListener();
		await this.interactions.dispose();
		for (const timer of this.conversationPublishes.values()) clearTimeout(timer);
		this.conversationPublishes.clear();
		await Promise.allSettled([...this.operations.values()]);
		const owned = [...this.owned.values()];
		for (const entry of owned) entry.handle.agent.cancel({ kind: "disposed" }, { keepInbox: true });
		await Promise.allSettled(owned.map((entry) => entry.handle.agent.whenIdle()));
		for (const entry of owned) try {
			await this.ctx.sessions.flush(entry.handle.agent.session);
		} catch (error) {
			this.ctx.logger.warn(`agent-team: session flush failed for ${entry.handle.agent.id}`, error);
		}
		await Promise.allSettled(owned.map((entry) => entry.handle.dispose()));
		this.owned.clear();
	}
	publishOwnedConversation(sessionId) {
		try {
			const owned = this.owned.get(sessionId);
			if (owned === void 0) return;
			const team = this.service.getTeam(owned.teamId);
			const member = team.members[owned.slotId];
			if (member === void 0) return;
			this.service.publishConversation(team.id, team.revision, this.projectMemberConversation(team, member, owned.handle.agent.session.events));
		} catch (error) {
			this.ctx.logger.warn("agent-team: failed to publish interaction update", error);
		}
	}
	async startTeamUnlocked(teamId) {
		const team = this.service.getTeam(teamId);
		if (team.state !== "draft" && team.state !== "error") throw new AgentTeamError("TEAM_NOT_ACTIVE", `Cannot start team in state '${team.state}'`);
		await this.service.updateRuntimeTeam(teamId, (current) => ({
			...current,
			state: "starting",
			members: mapMembers(current, (member) => ({
				...member,
				desiredState: "online",
				lastRuntimeState: this.owned.has(member.sessionId) ? member.lastRuntimeState : "starting"
			}))
		}), "team.starting", `Team ${team.name} is starting`);
		try {
			await this.ensureMembersOnline(this.service.getTeam(teamId));
			await this.messages.recover(this.service.getTeam(teamId));
			return await this.service.updateRuntimeTeam(teamId, (current) => ({
				...current,
				state: "active"
			}), "team.started", `Team ${team.name} started`);
		} catch (error) {
			await this.markTeamError(teamId, error);
			throw error;
		}
	}
	async ensureMembersOnline(team) {
		const workspace = this.ctx.workspaceRegistry.get(WorkspaceId(team.workspaceId));
		if (workspace === void 0 || await workspace.status() !== "ok" || workspace.path !== team.workspacePath) throw new AgentTeamError("WORKSPACE_UNAVAILABLE", `Workspace '${team.workspaceId}' is unavailable or changed`);
		const materialized = new Set((await this.ctx.sessionPersistence.list()).map((header) => String(header.id)));
		await mapConcurrent(Object.values(team.members), this.config.runtimeConcurrency, async (member) => {
			if (member.desiredState === "removing") return;
			await this.ensureMemberOnline(team, member, materialized.has(member.sessionId));
		});
	}
	async ensureMemberOnline(team, member, persisted) {
		if (this.owned.get(member.sessionId) !== void 0) return;
		const sessionId = SessionId(member.sessionId);
		if (this.ctx.agents.get(sessionId) !== void 0) {
			await this.service.updateRuntimeTeam(team.id, (current) => ({
				...current,
				state: "ownership_conflict"
			}), "team.ownership_conflict", `Session ${member.sessionId} is live but not owned by Agent Team`);
			throw new AgentTeamError("AGENT_HANDLE_OWNERSHIP_CONFLICT", `Session '${member.sessionId}' is live without this plugin's AgentHandle`);
		}
		try {
			this.activating.set(member.sessionId, {
				teamId: team.id,
				slotId: member.id
			});
			const modelSelection = {
				current: {
					provider: member.assistantSnapshot.provider,
					model: member.assistantSnapshot.model,
					...member.reasoningEffort === void 0 ? {} : { reasoningEffort: ReasoningEffortId(member.reasoningEffort) }
				},
				assembled: void 0
			};
			const setup = async (agentCtx) => {
				await this.ctx.agentPresets.mount(agentCtx, member.assistantSnapshot.agentPresetId);
				installModelSelection(agentCtx, modelSelection);
				const identitySection = `agent-team:identity:${member.id}`;
				const rosterSection = `agent-team:roster:${team.id}`;
				agentCtx.systemPrompt.section({
					name: identitySection,
					order: 10,
					text: () => {
						const latest = this.service.getTeam(team.id);
						const latestMember = latest.members[member.id];
						return latestMember === void 0 ? "This Agent Team membership is no longer active." : memberPrompt(latest, latestMember);
					}
				});
				agentCtx.systemPrompt.section({
					name: rosterSection,
					order: 11,
					text: () => rosterPrompt(this.service.getTeam(team.id))
				});
				registerTeamTools(agentCtx, {
					assertIdentity: (agent) => {
						this.assertToolIdentity(agent, team.id, member.id);
					},
					getTaskBoard: () => {
						const latest = this.service.getTeam(team.id);
						const tasks = JSON.parse(JSON.stringify(Object.values(latest.tasks)));
						return {
							teamId: latest.id,
							revision: latest.revision,
							tasks
						};
					},
					createTask: (input) => this.commands.createTask(team.id, member.id, input),
					updateTask: (input) => this.commands.updateTask(team.id, member.id, input),
					sendMessage: (recipientSlotId, content, type) => this.commands.sendMemberMessage(team.id, member.id, recipientSlotId, content, type)
				});
				const agent = agentCtx.agent;
				if (agent === void 0) throw new Error("Harness did not bind the unpublished agent context");
				const selectedMcpServers = new Set(member.assistantSnapshot.mcpServers);
				const mcpTools = agentCtx.tools.schemas(agent).flatMap((tool) => {
					const serverName = mcpServerFromToolName(tool.name);
					return serverName === void 0 ? [] : [{
						name: tool.name,
						serverName
					}];
				});
				const availableMcpServers = new Set(mcpTools.map((tool) => tool.serverName));
				const missingMcpServers = [...selectedMcpServers].filter((serverName) => !availableMcpServers.has(serverName));
				if (missingMcpServers.length > 0) throw new AgentTeamError("MCP_REFERENCE_INVALID", `Member '${member.displayName}' cannot access selected MCP Server(s): ${missingMcpServers.join(", ")}`, {
					memberId: member.id,
					missing: missingMcpServers
				});
				const deniedMcpTools = mcpTools.filter((tool) => !selectedMcpServers.has(tool.serverName)).map((tool) => tool.name);
				if (deniedMcpTools.length > 0) agentCtx.tools.restrict({ deny: deniedMcpTools });
				agentCtx.tools.guard((execution) => {
					const serverName = mcpServerFromToolName(execution.name);
					return serverName === void 0 || selectedMcpServers.has(serverName) ? void 0 : "This MCP Server is not selected for the assistant.";
				});
				const selectedSkills = new Set(member.assistantSnapshot.skillAllowlist);
				const skills = await this.ctx.skills.list({
					cwd: team.workspacePath,
					scope: agent
				});
				const available = new Set(skills.filter((skill) => isModelInvocable(skill) || isUserInvocable(skill)).map((skill) => skill.name));
				const missing = [...selectedSkills].filter((name) => !available.has(name));
				if (missing.length > 0) throw new AgentTeamError("SKILL_REFERENCE_INVALID", `Member '${member.displayName}' cannot access selected Skill(s): ${missing.join(", ")}`, {
					memberId: member.id,
					missing
				});
				if (selectedSkills.size > 0 && agentCtx.tools.get("skill", agent) === void 0) throw new AgentTeamError("SKILL_REFERENCE_INVALID", `Member '${member.displayName}' selected Skills, but its Agent Preset does not expose the skill loader`, { memberId: member.id });
				const presetScope = await this.ctx.agentPresets.standingKeyFor(member.assistantSnapshot.agentPresetId);
				const skillSelectionProvider = `agent-team-selection-${member.id}`;
				await registerScopedSkillProvider(agentCtx, () => ({
					name: skillSelectionProvider,
					list: async (options) => {
						return (await this.ctx.skills.list({
							cwd: options.cwd,
							signal: options.signal,
							scope: presetScope
						})).filter((skill) => !selectedSkills.has(skill.name)).map((skill) => ({
							name: skill.name,
							description: skill.description,
							invocation: {
								modelInvocable: false,
								userInvocable: false
							},
							source: "runtime",
							provider: skillSelectionProvider,
							rank: 0,
							locator: skill.name
						}));
					},
					get: async (candidate) => ({
						name: candidate.name,
						description: candidate.description,
						invocation: {
							modelInvocable: false,
							userInvocable: false
						},
						source: "runtime",
						provider: skillSelectionProvider,
						content: ""
					})
				}));
				agentCtx.tools.guard((execution) => {
					if (execution.name !== "skill") return void 0;
					const name = skillNameFromArguments(execution.arguments);
					return name !== void 0 && selectedSkills.has(name) ? void 0 : "This Skill is not selected for the assistant.";
				});
				this.ctx.permissionPresets.set(agent.session, member.permissionPresetId);
				const assembly = await agentCtx.systemPrompt.assemble(assembleContextFor(agent));
				const names = new Set(assembly.sections.map((section) => section.name));
				if (!names.has(identitySection) || !names.has(rosterSection)) throw new AgentTeamError("PRESET_PROMPT_INCOMPATIBLE", `Preset '${member.assistantSnapshot.agentPresetId}' replaced Agent Team prompt sections`);
			};
			const agentOptions = {
				provider: member.assistantSnapshot.provider,
				model: member.assistantSnapshot.model
			};
			const handle = persisted ? await this.ctx.agents.resume({
				resumeSessionId: sessionId,
				agentOptions,
				setup
			}) : await this.ctx.agents.create({
				sessionId,
				meta: {
					cwd: team.workspacePath,
					agentPreset: member.assistantSnapshot.agentPresetId
				},
				agentOptions,
				setup
			});
			const workspace = this.ctx.workspaceRegistry.get(WorkspaceId(team.workspaceId));
			if (workspace === void 0) {
				await handle.dispose();
				throw new AgentTeamError("WORKSPACE_UNAVAILABLE", "Workspace disappeared during start");
			}
			try {
				await workspace.attachSession(sessionId);
			} catch (error) {
				await handle.dispose();
				throw error;
			}
			this.owned.set(member.sessionId, {
				teamId: team.id,
				slotId: member.id,
				handle,
				modelSelection
			});
			this.activating.delete(member.sessionId);
			await this.setMemberRuntimeState(team.id, member.id, handle.agent.status);
		} catch (error) {
			this.activating.delete(member.sessionId);
			const causeMessage = error instanceof Error ? error.message : String(error);
			this.ctx.logger.warn(`agent-team: member '${member.displayName}' activation failed: ${causeMessage}`, error);
			throw error instanceof AgentTeamError ? error : new AgentTeamError("SESSION_CREATE_FAILED", `成员“${member.displayName}”启动失败：${causeMessage}`, {
				memberId: member.id,
				cause: causeMessage
			}, { cause: error });
		}
	}
	assertToolIdentity(agent, teamId, slotId) {
		if (agent === void 0) throw new AgentTeamError("INVALID_REQUEST", "Team tool requires an Agent caller");
		const identity = this.owned.get(String(agent.id)) ?? this.activating.get(String(agent.id));
		if (identity === void 0 || identity.teamId !== teamId || identity.slotId !== slotId) throw new AgentTeamError("INVALID_REQUEST", "Team tool caller identity does not match its scoped member");
	}
	requireOwned(sessionId) {
		const owned = this.owned.get(sessionId);
		if (owned === void 0) throw new AgentTeamError("TEAM_NOT_ACTIVE", `Team member session '${sessionId}' is not online`);
		return owned;
	}
	async setMemberRuntimeState(teamId, slotId, state) {
		if (this.service.getTeam(teamId).members[slotId]?.lastRuntimeState === state) return;
		await this.service.updateRuntimeTeam(teamId, (team) => ({
			...team,
			members: mapMembers(team, (member) => member.id === slotId ? {
				...member,
				desiredState: "online",
				lastRuntimeState: state
			} : member)
		}), "team.member_status", `Member ${slotId} entered ${state}`);
	}
	async markTeamError(teamId, error) {
		const message = error instanceof Error ? error.message : String(error);
		await this.service.updateRuntimeTeam(teamId, (team) => ({
			...team,
			state: team.state === "ownership_conflict" ? team.state : "error"
		}), "team.runtime_error", message);
	}
	exclusive(teamId, operation) {
		if (this.closing) return Promise.reject(/* @__PURE__ */ new Error("Agent Team runtime is closing"));
		const current = (this.operations.get(teamId) ?? Promise.resolve()).catch(() => void 0).then(operation);
		this.operations.set(teamId, current);
		current.finally(() => {
			if (this.operations.get(teamId) === current) this.operations.delete(teamId);
		}).catch(() => void 0);
		return current;
	}
};
function mapMembers(team, map) {
	return Object.fromEntries(Object.entries(team.members).map(([id, member]) => [id, map(member)]));
}
function withReasoningEffort(member, reasoningEffort) {
	const { reasoningEffort: _current, ...rest } = member;
	return reasoningEffort === void 0 ? rest : {
		...rest,
		reasoningEffort
	};
}
function skillNameFromArguments(value) {
	if (typeof value !== "object" || value === null || !("name" in value)) return void 0;
	return typeof value.name === "string" ? value.name : void 0;
}
async function mapConcurrent(values, concurrency, run) {
	let cursor = 0;
	const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
		while (cursor < values.length) await run(values[cursor++]);
	});
	await Promise.all(workers);
}
//#endregion
//#region src/storage/domain.ts
const agentTeamDomainSpec = defineDomain({
	name: "agent_team",
	version: 1,
	tables: {
		assistants: domainTable(assistantTemplateSchema),
		teams: domainTable(teamAggregateSchema),
		messages: domainTable(teamMessageSchema),
		activities: domainTable(teamActivitySchema),
		operations: domainTable(operationSchema)
	}
});
//#endregion
//#region src/storage/assistant-builder-preferences.ts
const modelReferenceSchema = z.object({
	provider: z.string().trim().min(1),
	model: z.string().trim().min(1)
}).strict();
const assistantBuilderPreferencesSchema = z.object({
	schemaVersion: z.literal(1),
	lastSelectedModel: modelReferenceSchema.optional(),
	conversationModels: z.record(z.string(), modelReferenceSchema),
	hiddenConversationIds: z.record(z.string(), z.iso.datetime({ offset: true })).optional(),
	updatedAt: z.iso.datetime({ offset: true }).optional()
}).strict();
const assistantBuilderPreferencesDomainSpec = defineDomain({
	name: "agent_team_assistant_builder",
	version: 1,
	global: {
		schema: assistantBuilderPreferencesSchema,
		initial: {
			schemaVersion: 1,
			conversationModels: {}
		}
	},
	tables: {}
});
var DomainAssistantBuilderModelPreferenceStore = class {
	domain;
	constructor(domain) {
		this.domain = domain;
	}
	getConversationModel(sessionId) {
		return this.domain.global.get().conversationModels[sessionId];
	}
	getLastSelectedModel() {
		return this.domain.global.get().lastSelectedModel;
	}
	async setConversationModel(sessionId, provider, model) {
		const current = this.domain.global.get();
		await this.domain.global.set({
			...current,
			conversationModels: {
				...current.conversationModels,
				[sessionId]: {
					provider,
					model
				}
			},
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
	}
	async setSelectedModel(sessionId, provider, model) {
		const current = this.domain.global.get();
		const selected = {
			provider,
			model
		};
		await this.domain.global.set({
			...current,
			lastSelectedModel: selected,
			conversationModels: {
				...current.conversationModels,
				[sessionId]: selected
			},
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
	}
	async setLastSelectedModel(provider, model) {
		const current = this.domain.global.get();
		await this.domain.global.set({
			...current,
			lastSelectedModel: {
				provider,
				model
			},
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
	}
};
//#endregion
//#region src/storage/store.ts
var DomainAgentTeamStore = class {
	domain;
	assistants;
	teams;
	messages;
	activities;
	operations;
	constructor(domain) {
		this.domain = domain;
		this.assistants = domain.table("assistants");
		this.teams = domain.table("teams");
		this.messages = domain.table("messages");
		this.activities = domain.table("activities");
		this.operations = domain.table("operations");
	}
	getAssistant(id) {
		return this.assistants.get(id);
	}
	listAssistants() {
		return values(this.assistants).sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
	}
	putAssistant(value) {
		return this.assistants.put(value.id, value);
	}
	updateAssistant(id, update) {
		return this.assistants.update(id, update);
	}
	deleteAssistant(id) {
		return this.assistants.delete(id);
	}
	getTeam(id) {
		return this.teams.get(id);
	}
	listTeams() {
		return values(this.teams).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id));
	}
	putTeam(value) {
		return this.teams.put(value.id, value);
	}
	updateTeam(id, update) {
		return this.teams.update(id, update);
	}
	deleteTeam(id) {
		return this.teams.delete(id);
	}
	listMessages(teamId) {
		return values(this.messages).filter((message) => message.teamId === teamId).sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
	}
	putMessage(value) {
		return this.messages.put(value.id, value);
	}
	deleteMessage(id) {
		return this.messages.delete(id);
	}
	listActivities(teamId) {
		return values(this.activities).filter((activity) => activity.teamId === teamId).sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
	}
	putActivity(value) {
		return this.activities.put(value.id, value);
	}
	deleteActivity(id) {
		return this.activities.delete(id);
	}
	getOperation(id) {
		return this.operations.get(id);
	}
	listOperations() {
		return values(this.operations).sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
	}
	putOperation(value) {
		return this.operations.put(value.id, value);
	}
	updateOperation(id, update) {
		return this.operations.update(id, update);
	}
	deleteOperation(id) {
		return this.operations.delete(id);
	}
};
function values(table) {
	return [...table.entries()].map(([, value]) => value);
}
//#endregion
//#region src/transport/contracts.ts
const AGENT_TEAM_API_PATH = "/agent-team/api";
const AGENT_TEAM_EVENTS_PATH = "/agent-team/events";
const AGENT_TEAM_UPLOAD_PATH = "/agent-team/upload";
const AGENT_TEAM_METHODS = [
	"catalog.get",
	"catalog.model.get",
	"skill.catalog",
	"mcp.catalog",
	"assistant.list",
	"assistant.get",
	"assistant.create",
	"assistant.update",
	"assistant.clone",
	"assistant.delete",
	"assistant.builder.list",
	"assistant.builder.draft.get",
	"assistant.builder.draft.configure",
	"assistant.builder.start",
	"assistant.builder.get",
	"assistant.builder.configure",
	"assistant.builder.send",
	"assistant.builder.interaction.respond",
	"assistant.builder.stop",
	"assistant.builder.archive",
	"team.list",
	"team.get",
	"team.createDraft",
	"team.clone",
	"team.start",
	"team.addMember",
	"team.removeMember",
	"team.changeLeader",
	"team.reset",
	"team.message.list",
	"team.message.send",
	"team.workbench.get",
	"team.member.stop",
	"team.interaction.respond",
	"team.member.setPermissionPreset",
	"team.member.setReasoningEffort",
	"team.workspace.list",
	"team.workspace.search",
	"team.workspace.changes",
	"team.workspace.diff",
	"team.dissolve"
];
//#endregion
//#region src/transport/web.ts
const MAX_UPLOAD_BYTES = 26214400;
const requestSchema = z.object({
	requestId: z.string().trim().min(1).max(200),
	method: z.enum(AGENT_TEAM_METHODS),
	expectedRevision: z.int().positive().optional(),
	payload: z.unknown()
}).strict();
const idPayload = z.object({ id: z.string().trim().min(1) }).strict();
const interactionResponseSchema = z.discriminatedUnion("kind", [z.object({
	kind: z.literal("question"),
	answers: z.array(z.object({
		id: z.string().trim().min(1).max(200),
		selected: z.array(z.string().min(1).max(500)).max(50),
		custom: z.string().max(32e3).optional()
	}).strict()).min(1).max(32)
}).strict(), z.object({
	kind: z.literal("approval"),
	outcome: z.enum(["allowed-once", "rejected"])
}).strict()]);
function registerWebTransport(ctx, config, service) {
	const clients = /* @__PURE__ */ new Set();
	const unsubscribe = service.subscribe((change) => broadcast(clients, change));
	const heartbeat = setInterval(() => {
		for (const response of clients) response.write(": heartbeat\n\n");
	}, config.sseHeartbeatMs);
	heartbeat.unref();
	const disposeApi = ctx.webServer.register({
		kind: "exact",
		path: AGENT_TEAM_API_PATH,
		handler: async (request, response) => {
			await handleApi(request, response, config, service, ctx);
		}
	});
	const disposeEvents = ctx.webServer.register({
		kind: "exact",
		path: AGENT_TEAM_EVENTS_PATH,
		handler: (request, response) => {
			handleEvents(request, response, clients);
		}
	});
	const disposeUpload = ctx.webServer.register({
		kind: "exact",
		path: AGENT_TEAM_UPLOAD_PATH,
		handler: async (request, response) => {
			await handleUpload(request, response, service, ctx);
		}
	});
	return { dispose() {
		disposeUpload();
		disposeEvents();
		disposeApi();
		unsubscribe();
		clearInterval(heartbeat);
		for (const response of clients) response.end();
		clients.clear();
	} };
}
async function handleUpload(request, response, service, ctx) {
	const requestId = headerValue(request.headers["x-agent-team-request-id"]) ?? "unknown";
	if (request.method !== "POST") {
		writeJson(response, 405, failure(requestId, "METHOD_NOT_ALLOWED", "Only POST is supported"));
		return;
	}
	if (!sameOrigin(request)) {
		writeJson(response, 403, failure(requestId, "ORIGIN_REJECTED", "Cross-origin requests are not allowed"));
		return;
	}
	try {
		const teamId = new URL(request.url ?? "/agent-team/upload", `http://${request.headers.host ?? "localhost"}`).searchParams.get("teamId")?.trim();
		const encodedName = headerValue(request.headers["x-agent-team-file-name"]);
		if (!teamId || !encodedName) throw new AgentTeamError("INVALID_REQUEST", "Team id and file name are required");
		let fileName;
		try {
			fileName = decodeURIComponent(encodedName);
		} catch {
			throw new AgentTeamError("INVALID_REQUEST", "File name encoding is invalid");
		}
		const data = await readBytes(request, MAX_UPLOAD_BYTES);
		writeJson(response, 200, {
			requestId,
			ok: true,
			value: await service.uploadWorkspaceFile(teamId, fileName, data)
		});
	} catch (error) {
		if (!isAgentTeamError(error)) ctx.logger.error("agent-team: unhandled upload error", error);
		const normalized = normalizeError(requestId, error);
		writeJson(response, normalized.error.code.endsWith("_NOT_FOUND") ? 404 : 400, normalized);
	}
}
async function handleApi(request, response, config, service, ctx) {
	if (request.method !== "POST") {
		writeJson(response, 405, failure("unknown", "METHOD_NOT_ALLOWED", "Only POST is supported"));
		return;
	}
	if (!sameOrigin(request)) {
		writeJson(response, 403, failure("unknown", "ORIGIN_REJECTED", "Cross-origin requests are not allowed"));
		return;
	}
	if (!(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
		writeJson(response, 415, failure("unknown", "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json"));
		return;
	}
	let parsed;
	try {
		const body = await readJson(request, config.maxRequestBytes);
		parsed = requestSchema.parse(body);
	} catch (error) {
		writeJson(response, 400, failure("unknown", "INVALID_REQUEST", error instanceof Error ? error.message : "Invalid request"));
		return;
	}
	try {
		const value = await dispatch(service, parsed);
		writeJson(response, 200, {
			requestId: parsed.requestId,
			ok: true,
			value
		});
	} catch (error) {
		if (!isAgentTeamError(error) && !(error instanceof z.ZodError)) ctx.logger.error("agent-team: unhandled API error", error);
		const normalized = normalizeError(parsed.requestId, error);
		writeJson(response, normalized.error.code.endsWith("_NOT_FOUND") ? 404 : normalized.error.code.includes("REVISION_CONFLICT") ? 409 : 400, normalized);
	}
}
function handleEvents(request, response, clients) {
	if (request.method !== "GET") {
		writeJson(response, 405, failure("unknown", "METHOD_NOT_ALLOWED", "Only GET is supported"));
		return;
	}
	if (!sameOrigin(request)) {
		writeJson(response, 403, failure("unknown", "ORIGIN_REJECTED", "Cross-origin requests are not allowed"));
		return;
	}
	response.writeHead(200, {
		"Content-Type": "text/event-stream; charset=utf-8",
		"Cache-Control": "no-cache, no-transform",
		Connection: "keep-alive",
		"X-Content-Type-Options": "nosniff"
	});
	response.write("retry: 2000\n\n");
	clients.add(response);
	const close = () => {
		clients.delete(response);
	};
	request.once("close", close);
	response.once("close", close);
}
async function dispatch(service, request) {
	const options = request.expectedRevision === void 0 ? {} : { expectedRevision: request.expectedRevision };
	switch (request.method) {
		case "catalog.get": return service.catalog();
		case "catalog.model.get": {
			const payload = z.object({
				provider: z.string().trim().min(1).max(200),
				model: z.string().trim().min(1).max(500)
			}).strict().parse(request.payload);
			return service.modelCapabilities(payload.provider, payload.model);
		}
		case "skill.catalog": {
			const payload = z.object({ agentPresetId: z.string().trim().min(1).max(200) }).strict().parse(request.payload);
			return service.skillCatalog(payload.agentPresetId);
		}
		case "mcp.catalog": {
			const payload = z.object({ agentPresetId: z.string().trim().min(1).max(200) }).strict().parse(request.payload);
			return service.mcpCatalog(payload.agentPresetId);
		}
		case "assistant.list": return service.listAssistants();
		case "assistant.get": return service.getAssistant(idPayload.parse(request.payload).id);
		case "assistant.create": return service.createAssistant(request.payload);
		case "assistant.update": {
			const payload = z.object({
				id: z.string().min(1),
				value: z.unknown()
			}).strict().parse(request.payload);
			return service.updateAssistant(payload.id, payload.value, options);
		}
		case "assistant.clone": {
			const payload = z.object({
				id: z.string().min(1),
				name: z.string().optional()
			}).strict().parse(request.payload);
			return service.cloneAssistant(payload.id, payload.name);
		}
		case "assistant.delete":
			await service.deleteAssistant(idPayload.parse(request.payload).id);
			return null;
		case "assistant.builder.list": return service.listAssistantBuilderConversations();
		case "assistant.builder.draft.get": return service.getAssistantBuilderDraft();
		case "assistant.builder.draft.configure": {
			const payload = z.object({
				provider: z.string().trim().min(1).max(200),
				model: z.string().trim().min(1).max(500)
			}).strict().parse(request.payload);
			return service.configureAssistantBuilderDraft(payload.provider, payload.model);
		}
		case "assistant.builder.start": {
			const payload = z.object({
				provider: z.string().trim().min(1).max(200),
				model: z.string().trim().min(1).max(500),
				content: z.string().trim().min(1).max(32e3)
			}).strict().parse(request.payload);
			return service.startAssistantBuilderConversation(payload.provider, payload.model, payload.content);
		}
		case "assistant.builder.get": {
			const payload = z.object({ sessionId: z.string().trim().min(1).max(200) }).strict().parse(request.payload);
			return service.getAssistantBuilderConversation(payload.sessionId);
		}
		case "assistant.builder.configure": {
			const payload = z.object({
				sessionId: z.string().trim().min(1).max(200),
				provider: z.string().trim().min(1).max(200),
				model: z.string().trim().min(1).max(500)
			}).strict().parse(request.payload);
			return service.configureAssistantBuilder(payload.sessionId, payload.provider, payload.model);
		}
		case "assistant.builder.send": {
			const payload = z.object({
				sessionId: z.string().trim().min(1).max(200),
				content: z.string().trim().min(1).max(32e3)
			}).strict().parse(request.payload);
			return service.sendAssistantBuilderMessage(payload.sessionId, payload.content);
		}
		case "assistant.builder.interaction.respond": {
			const payload = z.object({
				sessionId: z.string().trim().min(1).max(200),
				interactionId: z.string().trim().min(1).max(500),
				response: interactionResponseSchema
			}).strict().parse(request.payload);
			await service.respondToAssistantBuilderInteraction(payload.sessionId, payload.interactionId, payload.response.kind === "approval" ? payload.response : {
				kind: "question",
				answers: payload.response.answers.map((answer) => ({
					id: answer.id,
					selected: answer.selected,
					...answer.custom === void 0 ? {} : { custom: answer.custom }
				}))
			});
			return { accepted: true };
		}
		case "assistant.builder.stop": {
			const payload = z.object({ sessionId: z.string().trim().min(1).max(200) }).strict().parse(request.payload);
			await service.stopAssistantBuilder(payload.sessionId);
			return { accepted: true };
		}
		case "assistant.builder.archive": {
			const payload = z.object({ sessionId: z.string().trim().min(1).max(200) }).strict().parse(request.payload);
			await service.archiveAssistantBuilderConversation(payload.sessionId);
			return { archived: true };
		}
		case "team.list": return service.listTeams();
		case "team.get": return service.getTeam(idPayload.parse(request.payload).id);
		case "team.createDraft": return service.createTeamDraft(request.payload);
		case "team.clone": {
			const payload = z.object({
				teamId: z.string().trim().min(1).max(200),
				name: z.string().trim().min(1).max(500),
				workspaceId: z.string().trim().min(1).max(500)
			}).strict().parse(request.payload);
			return service.cloneTeam(payload.teamId, {
				name: payload.name,
				workspaceId: payload.workspaceId
			});
		}
		case "team.start": return service.startTeam(idPayload.parse(request.payload).id, options);
		case "team.addMember": {
			const payload = z.object({
				teamId: z.string().min(1),
				value: z.unknown()
			}).strict().parse(request.payload);
			return service.addMember(payload.teamId, payload.value, options);
		}
		case "team.removeMember": {
			const payload = z.object({
				teamId: z.string().min(1),
				slotId: z.string().min(1)
			}).strict().parse(request.payload);
			return service.removeMember(payload.teamId, payload.slotId, options);
		}
		case "team.changeLeader": {
			const payload = z.object({
				teamId: z.string().min(1),
				successorSlotId: z.string().min(1)
			}).strict().parse(request.payload);
			return service.changeLeader(payload.teamId, payload.successorSlotId, options);
		}
		case "team.reset": {
			const payload = z.object({
				teamId: z.string().min(1),
				confirmation: z.string()
			}).strict().parse(request.payload);
			return service.resetTeam(payload.teamId, payload.confirmation, options);
		}
		case "team.message.list": return service.listMessages(idPayload.parse(request.payload).id);
		case "team.message.send": {
			const payload = z.object({
				teamId: z.string().min(1),
				content: z.string(),
				targetSlotId: z.string().min(1).optional()
			}).strict().parse(request.payload);
			return service.sendUserMessage(payload.teamId, payload.content, payload.targetSlotId);
		}
		case "team.workbench.get": return service.getWorkbench(idPayload.parse(request.payload).id);
		case "team.member.stop": {
			const payload = z.object({
				teamId: z.string().min(1),
				slotId: z.string().min(1)
			}).strict().parse(request.payload);
			await service.stopMember(payload.teamId, payload.slotId);
			return { accepted: true };
		}
		case "team.interaction.respond": {
			const payload = z.object({
				teamId: z.string().trim().min(1).max(200),
				slotId: z.string().trim().min(1).max(200),
				interactionId: z.string().trim().min(1).max(300),
				response: interactionResponseSchema
			}).strict().parse(request.payload);
			await service.respondToInteraction(payload.teamId, payload.slotId, payload.interactionId, payload.response.kind === "approval" ? payload.response : {
				kind: "question",
				answers: payload.response.answers.map((answer) => ({
					id: answer.id,
					selected: answer.selected,
					...answer.custom === void 0 ? {} : { custom: answer.custom }
				}))
			});
			return { accepted: true };
		}
		case "team.member.setPermissionPreset": {
			const payload = z.object({
				teamId: z.string().min(1),
				slotId: z.string().min(1),
				permissionPresetId: z.string().min(1)
			}).strict().parse(request.payload);
			return service.setMemberPermissionPreset(payload.teamId, payload.slotId, payload.permissionPresetId, options);
		}
		case "team.member.setReasoningEffort": {
			const payload = z.object({
				teamId: z.string().min(1),
				slotId: z.string().min(1),
				reasoningEffort: z.string().trim().min(1).max(200).optional()
			}).strict().parse(request.payload);
			return service.setMemberReasoningEffort(payload.teamId, payload.slotId, payload.reasoningEffort, options);
		}
		case "team.workspace.list": {
			const payload = z.object({
				teamId: z.string().min(1),
				path: z.string().max(4096).optional()
			}).strict().parse(request.payload);
			return service.listWorkspace(payload.teamId, payload.path);
		}
		case "team.workspace.search": {
			const payload = z.object({
				teamId: z.string().min(1),
				query: z.string().max(4096).optional(),
				limit: z.int().min(1).max(100).optional()
			}).strict().parse(request.payload);
			return service.searchWorkspace(payload.teamId, payload.query, payload.limit);
		}
		case "team.workspace.changes": {
			const payload = z.object({ teamId: z.string().min(1) }).strict().parse(request.payload);
			return service.getWorkspaceChanges(payload.teamId);
		}
		case "team.workspace.diff": {
			const payload = z.object({
				teamId: z.string().min(1),
				path: z.string().min(1).max(4096),
				scope: z.enum(["staged", "unstaged"]),
				layout: z.enum(["unified", "split"]),
				theme: z.enum(["light", "dark"])
			}).strict().parse(request.payload);
			return service.getWorkspaceDiff(payload.teamId, payload.path, payload.scope, payload.layout, payload.theme);
		}
		case "team.dissolve": {
			const payload = z.object({
				teamId: z.string().min(1),
				confirmation: z.string()
			}).strict().parse(request.payload);
			await service.dissolveTeam(payload.teamId, payload.confirmation, options);
			return null;
		}
	}
}
async function readJson(request, limit) {
	const chunks = [];
	let size = 0;
	for await (const chunk of request) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += buffer.byteLength;
		if (size > limit) throw new AgentTeamError("INVALID_REQUEST", `Request body exceeds ${limit} bytes`);
		chunks.push(buffer);
	}
	if (chunks.length === 0) throw new AgentTeamError("INVALID_REQUEST", "Request body is empty");
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function readBytes(request, limit) {
	const declared = Number(request.headers["content-length"] ?? 0);
	if (Number.isFinite(declared) && declared > limit) throw new AgentTeamError("INVALID_REQUEST", `File exceeds the ${Math.floor(limit / 1024 / 1024)} MB upload limit`);
	const chunks = [];
	let size = 0;
	for await (const chunk of request) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += buffer.byteLength;
		if (size > limit) throw new AgentTeamError("INVALID_REQUEST", `File exceeds the ${Math.floor(limit / 1024 / 1024)} MB upload limit`);
		chunks.push(buffer);
	}
	return Buffer.concat(chunks);
}
function headerValue(value) {
	return Array.isArray(value) ? value[0] : value;
}
function sameOrigin(request) {
	const origin = request.headers.origin;
	if (origin === void 0) return true;
	const host = request.headers.host;
	if (host === void 0) return false;
	try {
		return new URL(origin).host === host;
	} catch {
		return false;
	}
}
function broadcast(clients, change) {
	const event = change.entityType === "conversation" ? "conversation" : change.entityType === "assistant-builder" ? "assistant-builder-conversation" : change.entityType === "workspace" ? "workspace" : "change";
	const frame = `id: ${change.cursor}\nevent: ${event}\ndata: ${JSON.stringify(change)}\n\n`;
	for (const response of clients) response.write(frame);
}
function normalizeError(requestId, error) {
	if (isAgentTeamError(error)) return failure(requestId, error.code, error.message, error.details);
	if (error instanceof z.ZodError) return failure(requestId, "INVALID_REQUEST", "Request validation failed", { issues: error.issues });
	return failure(requestId, "INTERNAL_ERROR", "Agent Team encountered an internal error");
}
function failure(requestId, code, message, details) {
	return {
		requestId,
		ok: false,
		error: {
			code,
			message,
			...details === void 0 ? {} : { details }
		}
	};
}
function writeJson(response, status, body) {
	const json = JSON.stringify(body);
	response.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": Buffer.byteLength(json),
		"Cache-Control": "no-store",
		"X-Content-Type-Options": "nosniff"
	});
	response.end(json);
}
//#endregion
//#region src/index.ts
const name = "agent-team";
const inject = [
	"agents",
	"agentPresets",
	"apiProxy",
	"llm",
	"permissionPresets",
	"sessionPersistence",
	"sessions",
	"skills",
	"storageDomain",
	"systemPrompt",
	"tools",
	"webServer",
	"workspaceRegistry"
];
async function apply(ctx, config) {
	const domain = await ctx.storageDomain.open(agentTeamDomainSpec);
	const assistantBuilderPreferencesDomain = await ctx.storageDomain.open(assistantBuilderPreferencesDomainSpec).catch(async (error) => {
		await domain.close();
		throw error;
	});
	let runtime;
	let assistantBuilderRuntime;
	let transport;
	let service;
	try {
		const store = new DomainAgentTeamStore(domain);
		const assistantBuilderModelPreferences = new DomainAssistantBuilderModelPreferenceStore(assistantBuilderPreferencesDomain);
		service = new AgentTeamService(ctx, config, store);
		runtime = new TeamRuntime(ctx, config, service);
		assistantBuilderRuntime = new AssistantBuilderRuntime(ctx, config, service, assistantBuilderModelPreferences, runtime.interactionBridge());
		service.attachRuntime(runtime);
		service.attachAssistantBuilderRuntime(assistantBuilderRuntime);
		transport = registerWebTransport(ctx, config, service);
		ctx.effect(() => async () => {
			transport?.dispose();
			await service?.disposeWorkspaceTracking();
			await assistantBuilderRuntime?.dispose();
			await runtime?.dispose();
			await assistantBuilderPreferencesDomain.close();
			await domain.close();
		}, "agent-team: ordered shutdown");
		await runtime.recoverTeams();
		runtime.startInteractionBridge();
		service.startWorkspaceTracking();
	} catch (error) {
		transport?.dispose();
		await service?.disposeWorkspaceTracking();
		await assistantBuilderRuntime?.dispose();
		await runtime?.dispose();
		await assistantBuilderPreferencesDomain.close();
		await domain.close();
		throw error;
	}
}
//#endregion
export { AgentTeamError, Config, apply, inject, name };

//# sourceMappingURL=index.js.map