import Schema from "@deepseek-ai/schemastery";
import { Context, Service } from "@deepseek-ai/cordis";
import { z } from "zod";
import "@deepseek-ai/dsh-session";
import "@deepseek-ai/dsh-storage-domain";
//#region src/config.d.ts
interface Config {
  maxRequestBytes: number;
  sseHeartbeatMs: number;
  runtimeConcurrency: number;
  directMemberChatDefault: boolean;
  assistantBuilderProvider: string;
  assistantBuilderModel: string;
  assistantBuilderAgentPresetId: string;
  assistantBuilderPermissionPresetId: string;
}
declare const Config: Schema<Config>;
//#endregion
//#region src/domain/errors.d.ts
type AgentTeamErrorCode = 'ASSISTANT_NOT_FOUND' | 'ASSISTANT_IN_USE' | 'ASSISTANT_REVISION_CONFLICT' | 'TEAM_NOT_FOUND' | 'TEAM_INVALID_LEADER' | 'TEAM_REVISION_CONFLICT' | 'TEAM_NOT_ACTIVE' | 'TEAM_DELETING' | 'MEMBER_NOT_FOUND' | 'MEMBER_IS_LEADER' | 'MEMBER_BUSY' | 'WORKSPACE_UNAVAILABLE' | 'WORKSPACE_GIT_UNAVAILABLE' | 'MODEL_REFERENCE_INVALID' | 'PRESET_REFERENCE_INVALID' | 'PERMISSION_PRESET_INVALID' | 'SKILL_REFERENCE_INVALID' | 'MCP_REFERENCE_INVALID' | 'PRESET_PROMPT_INCOMPATIBLE' | 'AGENT_HANDLE_OWNERSHIP_CONFLICT' | 'INTERACTION_INVALID' | 'INTERACTION_NOT_FOUND' | 'INTERACTION_NOT_PENDING' | 'SESSION_CREATE_FAILED' | 'TEAM_DELETE_FAILED' | 'INVALID_REQUEST';
declare class AgentTeamError extends Error {
  readonly code: AgentTeamErrorCode;
  readonly details?: Readonly<Record<string, unknown>> | undefined;
  constructor(code: AgentTeamErrorCode, message: string, details?: Readonly<Record<string, unknown>> | undefined, options?: ErrorOptions);
}
//#endregion
//#region src/domain/schemas.d.ts
declare const assistantSnapshotSchema: z.ZodObject<{
  assistantId: z.ZodString;
  revision: z.ZodInt;
  name: z.ZodString;
  instructions: z.ZodString;
  provider: z.ZodString;
  model: z.ZodString;
  reasoningEffort: z.ZodOptional<z.ZodString>;
  agentPresetId: z.ZodString;
  permissionPresetId: z.ZodString;
  skillAllowlist: z.ZodArray<z.ZodString>;
  mcpServers: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
declare const assistantTemplateSchema: z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  id: z.ZodString;
  name: z.ZodString;
  description: z.ZodOptional<z.ZodString>;
  icon: z.ZodOptional<z.ZodString>;
  instructions: z.ZodString;
  provider: z.ZodString;
  model: z.ZodString;
  reasoningEffort: z.ZodOptional<z.ZodString>;
  agentPresetId: z.ZodString;
  permissionPresetId: z.ZodString;
  skillAllowlist: z.ZodArray<z.ZodString>;
  mcpServers: z.ZodArray<z.ZodString>;
  revision: z.ZodInt;
  createdAt: z.ZodISODateTime;
  updatedAt: z.ZodISODateTime;
}, z.core.$strict>;
declare const memberRuntimeStateSchema: z.ZodEnum<{
  error: "error";
  offline: "offline";
  starting: "starting";
  idle: "idle";
  running: "running";
  waiting_approval: "waiting_approval";
}>;
declare const teamMemberSlotSchema: z.ZodObject<{
  id: z.ZodString;
  assistantId: z.ZodString;
  displayName: z.ZodString;
  role: z.ZodEnum<{
    leader: "leader";
    member: "member";
  }>;
  assistantSnapshot: z.ZodObject<{
    assistantId: z.ZodString;
    revision: z.ZodInt;
    name: z.ZodString;
    instructions: z.ZodString;
    provider: z.ZodString;
    model: z.ZodString;
    reasoningEffort: z.ZodOptional<z.ZodString>;
    agentPresetId: z.ZodString;
    permissionPresetId: z.ZodString;
    skillAllowlist: z.ZodArray<z.ZodString>;
    mcpServers: z.ZodArray<z.ZodString>;
  }, z.core.$strict>;
  permissionPresetId: z.ZodString;
  reasoningEffort: z.ZodOptional<z.ZodString>;
  sessionId: z.ZodString;
  desiredState: z.ZodEnum<{
    offline: "offline";
    online: "online";
    removing: "removing";
  }>;
  lastRuntimeState: z.ZodEnum<{
    error: "error";
    offline: "offline";
    starting: "starting";
    idle: "idle";
    running: "running";
    waiting_approval: "waiting_approval";
  }>;
  joinedAt: z.ZodISODateTime;
}, z.core.$strict>;
declare const retiredMemberSessionSchema: z.ZodObject<{
  formerSlotId: z.ZodString;
  sessionId: z.ZodString;
  displayName: z.ZodString;
  removedAt: z.ZodISODateTime;
}, z.core.$strict>;
declare const teamTaskSchema: z.ZodObject<{
  id: z.ZodString;
  title: z.ZodString;
  description: z.ZodString;
  status: z.ZodEnum<{
    running: "running";
    pending: "pending";
    assigned: "assigned";
    blocked: "blocked";
    completed: "completed";
    failed: "failed";
    cancelled: "cancelled";
  }>;
  ownerSlotId: z.ZodOptional<z.ZodString>;
  createdBySlotId: z.ZodOptional<z.ZodString>;
  dependencyIds: z.ZodArray<z.ZodString>;
  fileScopes: z.ZodArray<z.ZodString>;
  result: z.ZodOptional<z.ZodString>;
  error: z.ZodOptional<z.ZodString>;
  revision: z.ZodInt;
  createdAt: z.ZodISODateTime;
  updatedAt: z.ZodISODateTime;
}, z.core.$strict>;
declare const fileScopeLeaseSchema: z.ZodObject<{
  id: z.ZodString;
  slotId: z.ZodString;
  taskId: z.ZodString;
  path: z.ZodString;
  acquiredAt: z.ZodISODateTime;
  expiresAt: z.ZodOptional<z.ZodISODateTime>;
}, z.core.$strict>;
declare const teamMessageSchema: z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  id: z.ZodString;
  teamId: z.ZodString;
  sender: z.ZodObject<{
    kind: z.ZodEnum<{
      member: "member";
      user: "user";
      system: "system";
    }>;
    id: z.ZodString;
  }, z.core.$strict>;
  recipient: z.ZodObject<{
    kind: z.ZodEnum<{
      leader: "leader";
      member: "member";
      broadcast: "broadcast";
    }>;
    slotId: z.ZodOptional<z.ZodString>;
  }, z.core.$strict>;
  type: z.ZodEnum<{
    result: "result";
    system: "system";
    instruction: "instruction";
    progress: "progress";
    question: "question";
    warning: "warning";
  }>;
  content: z.ZodString;
  relatedTaskId: z.ZodOptional<z.ZodString>;
  attachments: z.ZodArray<z.ZodObject<{
    kind: z.ZodEnum<{
      workspace_path: "workspace_path";
      url: "url";
    }>;
    value: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
  }, z.core.$strict>>;
  deliveryState: z.ZodEnum<{
    failed: "failed";
    queued: "queued";
    delivered: "delivered";
    read: "read";
  }>;
  idempotencyKey: z.ZodString;
  createdAt: z.ZodISODateTime;
}, z.core.$strict>;
declare const teamAggregateSchema: z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  id: z.ZodString;
  name: z.ZodString;
  workspaceId: z.ZodString;
  workspacePath: z.ZodString;
  leaderSlotId: z.ZodString;
  state: z.ZodEnum<{
    error: "error";
    starting: "starting";
    draft: "draft";
    active: "active";
    ownership_conflict: "ownership_conflict";
    deleting: "deleting";
    delete_blocked: "delete_blocked";
  }>;
  directMemberChat: z.ZodBoolean;
  members: z.ZodRecord<z.ZodString, z.ZodObject<{
    id: z.ZodString;
    assistantId: z.ZodString;
    displayName: z.ZodString;
    role: z.ZodEnum<{
      leader: "leader";
      member: "member";
    }>;
    assistantSnapshot: z.ZodObject<{
      assistantId: z.ZodString;
      revision: z.ZodInt;
      name: z.ZodString;
      instructions: z.ZodString;
      provider: z.ZodString;
      model: z.ZodString;
      reasoningEffort: z.ZodOptional<z.ZodString>;
      agentPresetId: z.ZodString;
      permissionPresetId: z.ZodString;
      skillAllowlist: z.ZodArray<z.ZodString>;
      mcpServers: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
    permissionPresetId: z.ZodString;
    reasoningEffort: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodString;
    desiredState: z.ZodEnum<{
      offline: "offline";
      online: "online";
      removing: "removing";
    }>;
    lastRuntimeState: z.ZodEnum<{
      error: "error";
      offline: "offline";
      starting: "starting";
      idle: "idle";
      running: "running";
      waiting_approval: "waiting_approval";
    }>;
    joinedAt: z.ZodISODateTime;
  }, z.core.$strict>>;
  retiredSessions: z.ZodRecord<z.ZodString, z.ZodObject<{
    formerSlotId: z.ZodString;
    sessionId: z.ZodString;
    displayName: z.ZodString;
    removedAt: z.ZodISODateTime;
  }, z.core.$strict>>;
  tasks: z.ZodRecord<z.ZodString, z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    status: z.ZodEnum<{
      running: "running";
      pending: "pending";
      assigned: "assigned";
      blocked: "blocked";
      completed: "completed";
      failed: "failed";
      cancelled: "cancelled";
    }>;
    ownerSlotId: z.ZodOptional<z.ZodString>;
    createdBySlotId: z.ZodOptional<z.ZodString>;
    dependencyIds: z.ZodArray<z.ZodString>;
    fileScopes: z.ZodArray<z.ZodString>;
    result: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
    revision: z.ZodInt;
    createdAt: z.ZodISODateTime;
    updatedAt: z.ZodISODateTime;
  }, z.core.$strict>>;
  leases: z.ZodRecord<z.ZodString, z.ZodObject<{
    id: z.ZodString;
    slotId: z.ZodString;
    taskId: z.ZodString;
    path: z.ZodString;
    acquiredAt: z.ZodISODateTime;
    expiresAt: z.ZodOptional<z.ZodISODateTime>;
  }, z.core.$strict>>;
  outbox: z.ZodRecord<z.ZodString, z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    id: z.ZodString;
    teamId: z.ZodString;
    sender: z.ZodObject<{
      kind: z.ZodEnum<{
        member: "member";
        user: "user";
        system: "system";
      }>;
      id: z.ZodString;
    }, z.core.$strict>;
    recipient: z.ZodObject<{
      kind: z.ZodEnum<{
        leader: "leader";
        member: "member";
        broadcast: "broadcast";
      }>;
      slotId: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    type: z.ZodEnum<{
      result: "result";
      system: "system";
      instruction: "instruction";
      progress: "progress";
      question: "question";
      warning: "warning";
    }>;
    content: z.ZodString;
    relatedTaskId: z.ZodOptional<z.ZodString>;
    attachments: z.ZodArray<z.ZodObject<{
      kind: z.ZodEnum<{
        workspace_path: "workspace_path";
        url: "url";
      }>;
      value: z.ZodString;
      label: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    deliveryState: z.ZodEnum<{
      failed: "failed";
      queued: "queued";
      delivered: "delivered";
      read: "read";
    }>;
    idempotencyKey: z.ZodString;
    createdAt: z.ZodISODateTime;
  }, z.core.$strict>>;
  revision: z.ZodInt;
  createdAt: z.ZodISODateTime;
  updatedAt: z.ZodISODateTime;
}, z.core.$strict>;
declare const teamActivitySchema: z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  id: z.ZodString;
  teamId: z.ZodString;
  kind: z.ZodString;
  entityId: z.ZodOptional<z.ZodString>;
  summary: z.ZodString;
  revision: z.ZodInt;
  createdAt: z.ZodISODateTime;
}, z.core.$strict>;
declare const operationSchema: z.ZodObject<{
  schemaVersion: z.ZodLiteral<1>;
  id: z.ZodString;
  teamId: z.ZodOptional<z.ZodString>;
  kind: z.ZodEnum<{
    dissolve_team: "dissolve_team";
    remove_member: "remove_member";
    sync_member: "sync_member";
    migrate_records: "migrate_records";
  }>;
  state: z.ZodEnum<{
    running: "running";
    pending: "pending";
    blocked: "blocked";
    completed: "completed";
    failed: "failed";
  }>;
  stage: z.ZodString;
  cursor: z.ZodOptional<z.ZodString>;
  errorCode: z.ZodOptional<z.ZodString>;
  errorMessage: z.ZodOptional<z.ZodString>;
  createdAt: z.ZodISODateTime;
  updatedAt: z.ZodISODateTime;
}, z.core.$strict>;
declare const createAssistantInputSchema: z.ZodObject<{
  name: z.ZodString;
  provider: z.ZodString;
  model: z.ZodString;
  agentPresetId: z.ZodString;
  permissionPresetId: z.ZodString;
  instructions: z.ZodString;
  reasoningEffort: z.ZodOptional<z.ZodString>;
  skillAllowlist: z.ZodArray<z.ZodString>;
  mcpServers: z.ZodArray<z.ZodString>;
  description: z.ZodOptional<z.ZodString>;
  icon: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
declare const updateAssistantInputSchema: z.ZodObject<{
  name: z.ZodOptional<z.ZodString>;
  provider: z.ZodOptional<z.ZodString>;
  model: z.ZodOptional<z.ZodString>;
  agentPresetId: z.ZodOptional<z.ZodString>;
  permissionPresetId: z.ZodOptional<z.ZodString>;
  instructions: z.ZodOptional<z.ZodString>;
  reasoningEffort: z.ZodOptional<z.ZodOptional<z.ZodString>>;
  skillAllowlist: z.ZodOptional<z.ZodArray<z.ZodString>>;
  mcpServers: z.ZodOptional<z.ZodArray<z.ZodString>>;
  description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
  icon: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, z.core.$strict>;
declare const createTeamMemberInputSchema: z.ZodObject<{
  assistantId: z.ZodString;
  role: z.ZodEnum<{
    leader: "leader";
    member: "member";
  }>;
}, z.core.$strict>;
declare const addTeamMemberInputSchema: z.ZodObject<{
  assistantId: z.ZodString;
}, z.core.$strict>;
declare const createTeamDraftInputSchema: z.ZodObject<{
  name: z.ZodString;
  workspaceId: z.ZodString;
  directMemberChat: z.ZodOptional<z.ZodBoolean>;
  members: z.ZodArray<z.ZodObject<{
    assistantId: z.ZodString;
    role: z.ZodEnum<{
      leader: "leader";
      member: "member";
    }>;
  }, z.core.$strict>>;
}, z.core.$strict>;
declare const cloneTeamInputSchema: z.ZodObject<{
  name: z.ZodString;
  workspaceId: z.ZodString;
}, z.core.$strict>;
//#endregion
//#region src/domain/types.d.ts
type AssistantSnapshot = z.infer<typeof assistantSnapshotSchema>;
type AssistantTemplate = z.infer<typeof assistantTemplateSchema>;
type CreateAssistantInput = z.infer<typeof createAssistantInputSchema>;
type UpdateAssistantInput = z.infer<typeof updateAssistantInputSchema>;
type MemberRuntimeState = z.infer<typeof memberRuntimeStateSchema>;
type TeamMemberSlot = z.infer<typeof teamMemberSlotSchema>;
type RetiredMemberSession = z.infer<typeof retiredMemberSessionSchema>;
type TeamTask = z.infer<typeof teamTaskSchema>;
type FileScopeLease = z.infer<typeof fileScopeLeaseSchema>;
type TeamAggregate = z.infer<typeof teamAggregateSchema>;
type TeamMessage = z.infer<typeof teamMessageSchema>;
type TeamActivity = z.infer<typeof teamActivitySchema>;
type Operation = z.infer<typeof operationSchema>;
type CreateTeamMemberInput = z.infer<typeof createTeamMemberInputSchema>;
type AddTeamMemberInput = z.infer<typeof addTeamMemberInputSchema>;
type CreateTeamDraftInput = z.infer<typeof createTeamDraftInputSchema>;
type CloneTeamInput = z.infer<typeof cloneTeamInputSchema>;
interface Page<T> {
  items: T[];
  total: number;
}
declare function snapshotAssistant(assistant: AssistantTemplate): AssistantSnapshot;
//#endregion
//#region src/storage/store.d.ts
interface AgentTeamStore {
  getAssistant(id: string): AssistantTemplate | undefined;
  listAssistants(): AssistantTemplate[];
  putAssistant(value: AssistantTemplate): Promise<void>;
  updateAssistant(id: string, update: (current: AssistantTemplate) => AssistantTemplate): Promise<AssistantTemplate>;
  deleteAssistant(id: string): Promise<boolean>;
  getTeam(id: string): TeamAggregate | undefined;
  listTeams(): TeamAggregate[];
  putTeam(value: TeamAggregate): Promise<void>;
  updateTeam(id: string, update: (current: TeamAggregate) => TeamAggregate): Promise<TeamAggregate>;
  deleteTeam(id: string): Promise<boolean>;
  listMessages(teamId: string): TeamMessage[];
  putMessage(value: TeamMessage): Promise<void>;
  deleteMessage(id: string): Promise<boolean>;
  listActivities(teamId: string): TeamActivity[];
  putActivity(value: TeamActivity): Promise<void>;
  deleteActivity(id: string): Promise<boolean>;
  getOperation(id: string): Operation | undefined;
  listOperations(): Operation[];
  putOperation(value: Operation): Promise<void>;
  updateOperation(id: string, update: (current: Operation) => Operation): Promise<Operation>;
  deleteOperation(id: string): Promise<boolean>;
}
//#endregion
//#region src/storage/assistant-builder-preferences.d.ts
interface AssistantBuilderModelReference {
  provider: string;
  model: string;
}
interface AssistantBuilderModelPreferenceStore {
  getConversationModel(sessionId: string): AssistantBuilderModelReference | undefined;
  getLastSelectedModel(): AssistantBuilderModelReference | undefined;
  setConversationModel(sessionId: string, provider: string, model: string): Promise<void>;
  setSelectedModel(sessionId: string, provider: string, model: string): Promise<void>;
  setLastSelectedModel(provider: string, model: string): Promise<void>;
}
//#endregion
//#region src/transport/contracts.d.ts
type ConversationNode = {
  id: string;
  kind: 'user' | 'assistant';
  seq: number;
  time: number;
  text: string;
  reasoning?: string;
  reasoningStartedAt?: number;
  reasoningCompletedAt?: number;
  streaming?: boolean;
} | {
  id: string;
  kind: 'team-message';
  seq: number;
  time: number;
  text: string;
  senderName: string;
  senderId: string;
  senderRole: 'leader' | 'member' | 'system';
  messageType: 'instruction' | 'progress' | 'result' | 'question' | 'warning' | 'system';
  relatedTaskId?: string;
} | {
  id: string;
  kind: 'tool';
  seq: number;
  time: number;
  callId: string;
  name: string;
  arguments: string;
  status: 'running' | 'success' | 'error';
  result?: string;
  error?: string;
} | {
  id: string;
  kind: 'notice';
  seq: number;
  time: number;
  tone: 'neutral' | 'error' | 'warning';
  text: string;
};
interface QuestionOptionView {
  label: string;
  description?: string;
}
interface QuestionItemView {
  id: string;
  question: string;
  detail?: string;
  header?: string;
  options?: QuestionOptionView[];
  multiSelect?: boolean;
  intent?: {
    kind: 'plan-review';
    approve: string;
  };
}
type PendingInteractionView = {
  id: string;
  kind: 'question';
  questions: QuestionItemView[];
} | {
  id: string;
  kind: 'approval';
  approvalId: string;
  toolName: string;
  callId?: string;
  reason?: string;
};
interface QuestionAnswerView {
  id: string;
  selected: string[];
  custom?: string;
}
type InteractionResponseInput = {
  kind: 'question';
  answers: QuestionAnswerView[];
} | {
  kind: 'approval';
  outcome: 'allowed-once' | 'rejected';
};
interface MemberConversationView {
  slotId: string;
  sessionId: string;
  throughSeq: number;
  status: 'offline' | 'starting' | 'idle' | 'running' | 'waiting_approval' | 'error';
  nodes: ConversationNode[];
  pendingInteractions: PendingInteractionView[];
  contextUsage?: {
    usedTokens: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
    contextWindow?: number;
  };
}
interface TeamWorkbenchView {
  schemaVersion: 1;
  teamId: string;
  revision: number;
  conversations: MemberConversationView[];
}
interface AssistantBuilderConversationView {
  schemaVersion: 1;
  sessionId: string;
  status: 'starting' | 'idle' | 'running' | 'error';
  throughSeq: number;
  nodes: ConversationNode[];
  pendingInteractions: PendingInteractionView[];
  configuration: {
    provider: string;
    model: string;
    agentPresetId: string;
    permissionPresetId: string;
  };
}
interface AssistantBuilderConversationSummary {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  state: 'new' | 'in_progress' | 'completed';
}
interface AssistantBuilderConversationListView {
  items: AssistantBuilderConversationSummary[];
  total: number;
}
interface AssistantBuilderDraftView {
  schemaVersion: 1;
  configuration: AssistantBuilderConversationView['configuration'];
}
interface WorkspaceEntryView {
  name: string;
  path: string;
  kind: 'file' | 'directory' | 'symlink';
}
interface WorkspaceGitChangeView {
  path: string;
  originalPath?: string;
  kind: 'added' | 'copied' | 'deleted' | 'modified' | 'renamed' | 'type-changed' | 'unmerged' | 'untracked';
  staged: boolean;
  unstaged: boolean;
  indexCode: string;
  workTreeCode: string;
}
interface WorkspaceGitStatusView {
  state: 'repository' | 'not-repository';
  changes: WorkspaceGitChangeView[];
  truncated: boolean;
}
interface WorkspaceGitDiffView {
  path: string;
  scope: 'staged' | 'unstaged';
  layout: 'unified' | 'split';
  theme: 'light' | 'dark';
  html: string;
  binary: boolean;
}
interface WorkspaceUploadView {
  name: string;
  path: string;
  bytes: number;
}
//#endregion
//#region src/runtime/team-interaction-bridge.d.ts
interface TeamInteractionScope {
  acceptsSession: (sessionId: string) => boolean;
  onChange: (sessionId: string) => void;
}
declare class TeamInteractionBridge {
  private readonly ctx;
  private readonly records;
  private readonly scopes;
  private abortController;
  private consumeTask;
  constructor(ctx: Context, scope?: TeamInteractionScope);
  registerScope(scope: TeamInteractionScope): () => void;
  start(): void;
  list(sessionId: string): PendingInteractionView[];
  forget(sessionId: string): void;
  respond(sessionId: string, interactionId: string, response: InteractionResponseInput): Promise<void>;
  dispose(): Promise<void>;
  private consume;
  private accept;
  private remove;
  private acceptsSession;
  private notifyChange;
}
//#endregion
//#region src/runtime/assistant-builder-runtime.d.ts
declare class AssistantBuilderRuntime {
  private readonly ctx;
  private readonly config;
  private readonly service;
  private readonly modelPreferences;
  private readonly interactions;
  private handle;
  private starting;
  private reconfiguring;
  private switching;
  private activeSessionId;
  private configuration;
  private readonly configurations;
  private readonly pendingDrafts;
  private publishTimer;
  private readonly disposeStatusListener;
  private readonly disposeConversationListener;
  private readonly disposeInteractionScope;
  private closing;
  constructor(ctx: Context, config: Config, service: AgentTeamService, modelPreferences: AssistantBuilderModelPreferenceStore, interactions: TeamInteractionBridge);
  listConversations(): Promise<AssistantBuilderConversationListView>;
  getDraft(): Promise<AssistantBuilderDraftView>;
  configureDraft(rawProvider: string, rawModel: string): Promise<AssistantBuilderDraftView>;
  startConversation(rawProvider: string, rawModel: string, rawContent: string): Promise<AssistantBuilderConversationView>;
  getConversation(rawSessionId: string): Promise<AssistantBuilderConversationView>;
  sendMessage(sessionId: string, rawContent: string): Promise<{
    messageId: string;
  }>;
  configure(sessionId: string, rawProvider: string, rawModel: string): Promise<AssistantBuilderConversationView>;
  stop(sessionId: string): Promise<void>;
  respondToInteraction(rawSessionId: string, interactionId: string, response: InteractionResponseInput): Promise<void>;
  archiveConversation(rawSessionId: string): Promise<void>;
  dispose(): Promise<void>;
  private ensureOnline;
  private activate;
  private switchSession;
  private reconfigure;
  private start;
  private resolveConfiguration;
  private resolvePersistedModel;
  private validateModelReference;
  private requireExistingSessionId;
  private isConversationArchived;
  private registerTools;
  private assertToolIdentity;
  private project;
  private publishCurrent;
}
//#endregion
//#region src/runtime/team-runtime.d.ts
declare class TeamRuntime {
  private readonly ctx;
  private readonly config;
  private readonly service;
  private readonly owned;
  private readonly activating;
  private readonly operations;
  private readonly disposeStatusListener;
  private readonly disposeConversationListener;
  private readonly conversationPublishes;
  private readonly messages;
  private readonly commands;
  private readonly interactions;
  private closing;
  constructor(ctx: Context, config: Config, service: AgentTeamService);
  startInteractionBridge(): void;
  interactionBridge(): TeamInteractionBridge;
  getWorkbench(teamId: string): Promise<TeamWorkbenchView>;
  stopMember(teamId: string, slotId: string): Promise<void>;
  respondToInteraction(teamId: string, slotId: string, interactionId: string, response: InteractionResponseInput): Promise<void>;
  setMemberPermissionPreset(teamId: string, slotId: string, permissionPresetId: string): Promise<TeamAggregate>;
  setMemberReasoningEffort(teamId: string, slotId: string, reasoningEffort: string | undefined): Promise<TeamAggregate>;
  private projectMemberConversation;
  startTeam(teamId: string): Promise<TeamAggregate>;
  activateMember(teamId: string, slotId: string): Promise<TeamAggregate>;
  removeMember(teamId: string, slotId: string): Promise<TeamAggregate>;
  resetTeam(teamId: string): Promise<TeamAggregate>;
  dissolveTeam(teamId: string): Promise<void>;
  sendUserMessage(teamId: string, rawContent: string, targetSlotId?: string): Promise<TeamMessage>;
  recoverTeams(): Promise<void>;
  dispose(): Promise<void>;
  private publishOwnedConversation;
  private startTeamUnlocked;
  private ensureMembersOnline;
  private ensureMemberOnline;
  private assertToolIdentity;
  private requireOwned;
  private setMemberRuntimeState;
  private markTeamError;
  private exclusive;
}
//#endregion
//#region src/service/agent-team-service.d.ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    agentTeam: AgentTeamService;
  }
}
interface MutationOptions {
  expectedRevision?: number;
}
interface AgentTeamChange {
  cursor: number;
  entityType: 'assistant' | 'assistant-builder' | 'team' | 'operation' | 'conversation' | 'workspace' | 'catalog';
  entityId: string;
  revision: number;
  kind: string;
  conversation?: MemberConversationView;
  assistantBuilderConversation?: AssistantBuilderConversationView;
}
interface CatalogSnapshot {
  providers: ReturnType<Context['llm']['listProviders']>;
  models: Record<string, Array<{
    id: string;
    name: string;
    description?: string;
  }>>;
  agentPresets: Array<{
    id: string;
    name: string;
    description?: string;
    broken?: string;
  }>;
  permissionPresets: Array<ReturnType<Context['permissionPresets']['optionOf']>>;
  workspaces: Array<{
    id: string;
    path: string;
    title: string;
    status: 'ok' | 'missing-dir';
  }>;
}
interface SkillCatalogSnapshot {
  agentPresetId: string;
  skills: Array<{
    name: string;
    description: string;
    source: string;
    modelInvocable: boolean;
    userInvocable: boolean;
  }>;
}
interface ModelCapabilitiesSnapshot {
  provider: string;
  model: string;
  reasoning?: {
    efforts: Array<{
      id: string;
      name: string;
      description?: string;
    }>;
    defaultEffort?: string;
  };
}
interface McpCatalogSnapshot {
  agentPresetId: string;
  servers: Array<{
    name: string;
    tools: Array<{
      name: string;
      description: string;
    }>;
  }>;
}
declare class AgentTeamService extends Service {
  readonly config: Config;
  private readonly store;
  private readonly listeners;
  private cursor;
  private runtime?;
  private assistantBuilderRuntime?;
  private readonly workspace;
  constructor(ctx: Context, config: Config, store: AgentTeamStore);
  subscribe(listener: (change: AgentTeamChange) => void): () => void;
  attachRuntime(runtime: TeamRuntime): void;
  attachAssistantBuilderRuntime(runtime: AssistantBuilderRuntime): void;
  startWorkspaceTracking(): void;
  disposeWorkspaceTracking(): Promise<void>;
  catalog(): Promise<CatalogSnapshot>;
  modelCapabilities(providerValue: string, modelValue: string): Promise<ModelCapabilitiesSnapshot>;
  skillCatalog(agentPresetId: string): Promise<SkillCatalogSnapshot>;
  mcpCatalog(agentPresetId: string): Promise<McpCatalogSnapshot>;
  getAssistant(id: string): AssistantTemplate;
  listAssistants(): Page<AssistantTemplate>;
  createAssistant(raw: CreateAssistantInput): Promise<AssistantTemplate>;
  validateAssistantDraft(raw: CreateAssistantInput): Promise<CreateAssistantInput>;
  updateAssistant(id: string, raw: UpdateAssistantInput, options?: MutationOptions): Promise<AssistantTemplate>;
  cloneAssistant(id: string, name?: string): Promise<AssistantTemplate>;
  deleteAssistant(id: string): Promise<void>;
  listAssistantBuilderConversations(): Promise<AssistantBuilderConversationListView>;
  getAssistantBuilderDraft(): Promise<AssistantBuilderDraftView>;
  configureAssistantBuilderDraft(provider: string, model: string): Promise<AssistantBuilderDraftView>;
  startAssistantBuilderConversation(provider: string, model: string, content: string): Promise<AssistantBuilderConversationView>;
  getAssistantBuilderConversation(sessionId: string): Promise<AssistantBuilderConversationView>;
  configureAssistantBuilder(sessionId: string, provider: string, model: string): Promise<AssistantBuilderConversationView>;
  sendAssistantBuilderMessage(sessionId: string, content: string): Promise<{
    messageId: string;
  }>;
  respondToAssistantBuilderInteraction(sessionId: string, interactionId: string, response: InteractionResponseInput): Promise<void>;
  stopAssistantBuilder(sessionId: string): Promise<void>;
  archiveAssistantBuilderConversation(sessionId: string): Promise<void>;
  getTeam(id: string): TeamAggregate;
  listTeams(): Page<TeamAggregate>;
  createTeamDraft(raw: CreateTeamDraftInput): Promise<TeamAggregate>;
  cloneTeam(sourceTeamId: string, raw: CloneTeamInput): Promise<TeamAggregate>;
  changeLeader(teamId: string, successorSlotId: string, options?: MutationOptions): Promise<TeamAggregate>;
  addMember(teamId: string, raw: AddTeamMemberInput, options?: MutationOptions): Promise<TeamAggregate>;
  removeMember(teamId: string, slotId: string, options?: MutationOptions): Promise<TeamAggregate>;
  startTeam(teamId: string, options?: MutationOptions): Promise<TeamAggregate>;
  resetTeam(teamId: string, confirmation: string, options?: MutationOptions): Promise<TeamAggregate>;
  sendUserMessage(teamId: string, content: string, targetSlotId?: string): Promise<TeamMessage>;
  getWorkbench(teamId: string): Promise<TeamWorkbenchView>;
  stopMember(teamId: string, slotId: string): Promise<void>;
  respondToInteraction(teamId: string, slotId: string, interactionId: string, response: InteractionResponseInput): Promise<void>;
  setMemberPermissionPreset(teamId: string, slotId: string, rawPermissionPresetId: string, options?: MutationOptions): Promise<TeamAggregate>;
  setMemberReasoningEffort(teamId: string, slotId: string, rawReasoningEffort: string | undefined, options?: MutationOptions): Promise<TeamAggregate>;
  publishConversation(teamId: string, revision: number, conversation?: MemberConversationView): void;
  publishAssistantBuilderConversation(conversation: AssistantBuilderConversationView): void;
  listWorkspace(teamId: string, rawPath?: string): Promise<WorkspaceEntryView[]>;
  searchWorkspace(teamId: string, query?: string, limit?: number): Promise<WorkspaceEntryView[]>;
  getWorkspaceChanges(teamId: string): Promise<WorkspaceGitStatusView>;
  getWorkspaceDiff(teamId: string, path: string, scope: 'staged' | 'unstaged', layout: 'unified' | 'split', theme: 'light' | 'dark'): Promise<WorkspaceGitDiffView>;
  uploadWorkspaceFile(teamId: string, rawName: string, data: Uint8Array): Promise<WorkspaceUploadView>;
  listMessages(teamId: string): Page<TeamMessage>;
  updateRuntimeTeam(teamId: string, update: (team: TeamAggregate) => TeamAggregate, kind: string, summary: string): Promise<TeamAggregate>;
  putRuntimeMessage(message: TeamMessage): Promise<void>;
  retireQueuedMessages(teamId: string): Promise<void>;
  dissolveTeam(teamId: string, confirmation: string, options?: MutationOptions): Promise<void>;
  deleteTeamRecords(teamId: string): Promise<void>;
  getOperation(id: string): Operation;
  private validateAssistantReferences;
  private validateReasoningEffort;
  private activity;
  private publish;
  private requireRuntime;
  private requireAssistantBuilderRuntime;
}
//#endregion
//#region src/index.d.ts
declare const name = "agent-team";
declare const inject: string[];
declare function apply(ctx: Context, config: Config): Promise<void>;
//#endregion
export { type AddTeamMemberInput, type AgentTeamChange, AgentTeamError, type AssistantSnapshot, type AssistantTemplate, type CatalogSnapshot, type CloneTeamInput, Config, type CreateAssistantInput, type CreateTeamDraftInput, type CreateTeamMemberInput, type FileScopeLease, type MemberRuntimeState, type Operation, type Page, type RetiredMemberSession, type TeamActivity, type TeamAggregate, type TeamMemberSlot, type TeamMessage, type TeamTask, type UpdateAssistantInput, apply, inject, name, type snapshotAssistant };
//# sourceMappingURL=index.d.ts.map