window.__ModuleLoader__.load({
	id: "@limuyang2/dsh-agent-team",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/transport/contracts.ts
		const AGENT_TEAM_API_PATH = "/agent-team/api";
		const AGENT_TEAM_EVENTS_PATH = "/agent-team/events";
		const AGENT_TEAM_UPLOAD_PATH = "/agent-team/upload";
		//#endregion
		//#region src/client/api.ts
		async function callAgentTeam(method, ...args) {
			const [payload, expectedRevision] = args;
			const controller = new AbortController();
			const timeout = setTimeout(() => {
				controller.abort();
			}, method === "team.reset" || method === "team.dissolve" ? 6e4 : 1e4);
			try {
				const body = await (await fetch(AGENT_TEAM_API_PATH, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					signal: controller.signal,
					body: JSON.stringify({
						requestId: crypto.randomUUID(),
						method,
						payload: payload ?? {},
						...expectedRevision === void 0 ? {} : { expectedRevision }
					})
				})).json();
				if (!body.ok) {
					const error = new Error(body.error.message);
					Object.assign(error, {
						code: body.error.code,
						details: body.error.details
					});
					throw error;
				}
				return body.value;
			} catch (error) {
				if (controller.signal.aborted) throw new Error(`请求超时：${method}`);
				throw error;
			} finally {
				clearTimeout(timeout);
			}
		}
		async function uploadAgentTeamFile(teamId, file) {
			const controller = new AbortController();
			const timeout = setTimeout(() => {
				controller.abort();
			}, 12e4);
			const requestId = crypto.randomUUID();
			try {
				const body = await (await fetch(`${AGENT_TEAM_UPLOAD_PATH}?teamId=${encodeURIComponent(teamId)}`, {
					method: "POST",
					headers: {
						"Content-Type": "application/octet-stream",
						"X-Agent-Team-File-Name": encodeURIComponent(file.name),
						"X-Agent-Team-Request-Id": requestId
					},
					signal: controller.signal,
					body: file
				})).json();
				if (!body.ok) {
					const error = new Error(body.error.message);
					Object.assign(error, {
						code: body.error.code,
						details: body.error.details
					});
					throw error;
				}
				return body.value;
			} catch (error) {
				if (controller.signal.aborted) throw new Error(`文件上传超时：${file.name}`);
				throw error;
			} finally {
				clearTimeout(timeout);
			}
		}
		const changeSubscriptions = /* @__PURE__ */ new Set();
		const conversationSubscriptions = /* @__PURE__ */ new Set();
		const assistantBuilderSubscriptions = /* @__PURE__ */ new Set();
		const workspaceSubscriptions = /* @__PURE__ */ new Set();
		let sharedEventSource;
		function eventSource() {
			if (sharedEventSource !== void 0) return sharedEventSource;
			const source = new EventSource(AGENT_TEAM_EVENTS_PATH);
			source.addEventListener("change", () => {
				for (const subscription of changeSubscriptions) subscription.onChange();
			});
			source.addEventListener("conversation", ((event) => {
				try {
					const change = JSON.parse(event.data);
					for (const subscription of conversationSubscriptions) if (subscription.teamId === change.entityId) subscription.onChange(change.conversation);
				} catch {
					for (const subscription of conversationSubscriptions) subscription.onChange();
				}
			}));
			source.addEventListener("assistant-builder-conversation", ((event) => {
				try {
					const change = JSON.parse(event.data);
					for (const subscription of assistantBuilderSubscriptions) subscription.onChange(change.assistantBuilderConversation);
				} catch {
					for (const subscription of assistantBuilderSubscriptions) subscription.onChange();
				}
			}));
			source.addEventListener("workspace", ((event) => {
				try {
					const change = JSON.parse(event.data);
					for (const subscription of workspaceSubscriptions) if (subscription.teamId === change.entityId) subscription.onChange();
				} catch {
					for (const subscription of workspaceSubscriptions) subscription.onChange();
				}
			}));
			source.onerror = () => {
				for (const subscription of changeSubscriptions) subscription.onError();
				for (const subscription of conversationSubscriptions) subscription.onError();
				for (const subscription of assistantBuilderSubscriptions) subscription.onError();
				for (const subscription of workspaceSubscriptions) subscription.onError();
			};
			source.onopen = () => {
				for (const subscription of conversationSubscriptions) subscription.onOpen?.();
				for (const subscription of assistantBuilderSubscriptions) subscription.onOpen?.();
			};
			sharedEventSource = source;
			return source;
		}
		function releaseEventSourceIfUnused() {
			if (changeSubscriptions.size > 0 || conversationSubscriptions.size > 0 || assistantBuilderSubscriptions.size > 0 || workspaceSubscriptions.size > 0) return;
			sharedEventSource?.close();
			sharedEventSource = void 0;
		}
		function subscribeAgentTeamWorkspace(teamId, onChange, onError) {
			const subscription = {
				teamId,
				onChange,
				onError
			};
			workspaceSubscriptions.add(subscription);
			eventSource();
			return () => {
				workspaceSubscriptions.delete(subscription);
				releaseEventSourceIfUnused();
			};
		}
		function subscribeAgentTeam(onChange, onError) {
			const subscription = {
				onChange,
				onError
			};
			changeSubscriptions.add(subscription);
			eventSource();
			return () => {
				changeSubscriptions.delete(subscription);
				releaseEventSourceIfUnused();
			};
		}
		function subscribeAgentTeamConversation(teamId, onChange, onError, onOpen) {
			const subscription = {
				teamId,
				onChange,
				onError,
				...onOpen === void 0 ? {} : { onOpen }
			};
			conversationSubscriptions.add(subscription);
			if (eventSource().readyState === EventSource.OPEN) queueMicrotask(() => {
				onOpen?.();
			});
			return () => {
				conversationSubscriptions.delete(subscription);
				releaseEventSourceIfUnused();
			};
		}
		function subscribeAssistantBuilderConversation(onChange, onError, onOpen) {
			const subscription = {
				onChange,
				onError,
				...onOpen === void 0 ? {} : { onOpen }
			};
			assistantBuilderSubscriptions.add(subscription);
			if (eventSource().readyState === EventSource.OPEN) queueMicrotask(() => {
				onOpen?.();
			});
			return () => {
				assistantBuilderSubscriptions.delete(subscription);
				releaseEventSourceIfUnused();
			};
		}
		//#endregion
		//#region \0agent-team-css:/Users/xiong/Doubao/chats/2026-10-15/new-chat/dsh-agent-team/src/client/AgentTeam.module.css.mjs
		const css$2 = "._8e7YW_floatingTeamLauncher:focus-visible,._8e7YW_iconButton:focus-visible,._8e7YW_linkDanger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}._8e7YW_floatingTeamLauncher{z-index:30;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:42px;height:42px;box-shadow:var(--dsw-alias-shadow-l1);color:var(--dsw-alias-label-primary);font:inherit;white-space:nowrap;cursor:grab;pointer-events:auto;touch-action:none;user-select:none;transition:width .18s var(--ds-ease-in-out), background-color .15s var(--ds-ease-in-out), box-shadow .15s var(--ds-ease-in-out);border-radius:21px;align-items:center;gap:8px;padding:0 11px;font-size:13px;display:inline-flex;position:fixed;top:62%;left:16px;overflow:hidden}._8e7YW_floatingTeamLauncher:hover:not(._8e7YW_floatingTeamLauncherSettled),._8e7YW_floatingTeamLauncher:focus-visible:not(._8e7YW_floatingTeamLauncherSettled),._8e7YW_floatingTeamLauncherDragging{background:var(--dsw-alias-interactive-bg-hover);width:90px}._8e7YW_floatingTeamLauncher._8e7YW_floatingTeamLauncherDragging{cursor:grabbing}._8e7YW_floatingTeamLauncher._8e7YW_floatingTeamLauncherSettled{width:42px}._8e7YW_floatingTeamLauncherIcon{flex:none;justify-content:center;align-items:center;width:18px;height:18px;display:inline-flex;position:relative}._8e7YW_floatingTeamLauncherState{border:2px solid var(--dsw-alias-bg-layer-1);background:var(--dsw-alias-state-success-primary);box-sizing:content-box;border-radius:50%;width:7px;height:7px;position:absolute;top:-2px;right:-3px}._8e7YW_floatingTeamLauncher:hover ._8e7YW_floatingTeamLauncherState,._8e7YW_floatingTeamLauncher:focus-visible ._8e7YW_floatingTeamLauncherState,._8e7YW_floatingTeamLauncherDragging ._8e7YW_floatingTeamLauncherState{border-color:var(--dsw-alias-interactive-bg-hover)}._8e7YW_floatingTeamLauncher._8e7YW_floatingTeamLauncherSettled ._8e7YW_floatingTeamLauncherState{border-color:var(--dsw-alias-bg-layer-1)}._8e7YW_floatingTeamLauncherLabel{opacity:0;transition:opacity .12s var(--ds-ease-in-out), transform .18s var(--ds-ease-in-out);flex:none;transform:translate(-3px)}._8e7YW_floatingTeamLauncher:hover:not(._8e7YW_floatingTeamLauncherSettled) ._8e7YW_floatingTeamLauncherLabel,._8e7YW_floatingTeamLauncher:focus-visible:not(._8e7YW_floatingTeamLauncherSettled) ._8e7YW_floatingTeamLauncherLabel,._8e7YW_floatingTeamLauncherDragging ._8e7YW_floatingTeamLauncherLabel{opacity:1;transform:translate(0)}._8e7YW_floatingTeamLauncher._8e7YW_floatingTeamLauncherSettled ._8e7YW_floatingTeamLauncherLabel{opacity:0;transform:translate(-3px)}._8e7YW_floatingTeamLauncher._8e7YW_floatingTeamLauncherDragging{width:90px}._8e7YW_floatingTeamLauncher._8e7YW_floatingTeamLauncherDragging ._8e7YW_floatingTeamLauncherState{border-color:var(--dsw-alias-interactive-bg-hover)}._8e7YW_floatingTeamLauncher._8e7YW_floatingTeamLauncherDragging ._8e7YW_floatingTeamLauncherLabel{opacity:1;transform:translate(0)}@media (prefers-reduced-motion:reduce){._8e7YW_floatingTeamLauncher,._8e7YW_floatingTeamLauncherLabel{transition:none}}._8e7YW_settingsSection{flex-direction:column;gap:20px;min-height:100%;display:flex}._8e7YW_settingsHeading{border-bottom:1px solid var(--dsw-alias-border-l2);justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:16px;display:flex}._8e7YW_settingsTitle{color:var(--dsw-alias-label-primary);margin:0;font-size:18px;font-weight:500;line-height:26px}._8e7YW_settingsDescription{color:var(--dsw-alias-label-tertiary);margin:4px 0 0;font-size:12px;line-height:18px}._8e7YW_settingsSection>._8e7YW_error{margin:0}._8e7YW_fullscreenWorkbench{background:var(--dsw-alias-bg-layer-1);width:100%;height:100%;color:var(--dsw-alias-label-primary);pointer-events:auto;grid-template-columns:248px minmax(0,1fr);display:grid;position:absolute;inset:0;overflow:hidden}._8e7YW_fullscreenWorkbenchMain{background:var(--dsw-alias-bg-layer-1);flex-direction:column;min-width:0;min-height:0;display:flex;overflow:hidden}._8e7YW_teamNavigator{border-right:1px solid var(--dsw-alias-border-l2);background:var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-layer-2));flex-direction:column;min-width:0;min-height:0;display:flex}._8e7YW_teamNavigatorHeader{border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;justify-content:space-between;align-items:center;gap:8px;min-height:70px;padding:15px 14px 13px 16px;display:flex}._8e7YW_teamNavigatorTitle,._8e7YW_teamNavigatorAdd{color:var(--dsw-alias-label-primary);font:inherit;background:0 0;border:0;align-items:center;display:inline-flex}._8e7YW_teamNavigatorTitle{cursor:pointer;border-radius:8px;gap:9px;min-width:0;padding:7px 8px;font-size:16px;font-weight:600}._8e7YW_teamNavigatorTitle:hover{background:var(--dsw-alias-interactive-bg-hover)}._8e7YW_teamNavigatorAdd{width:30px;height:30px;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:8px;flex:none;justify-content:center;padding:0}._8e7YW_teamNavigatorAdd:hover{background:var(--dsw-alias-interactive-bg-hover)}._8e7YW_teamNavigatorList{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l1);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l1);flex-direction:column;flex:1;gap:8px;min-height:0;padding:12px;display:flex;overflow-y:auto}._8e7YW_teamNavigatorEmpty{color:var(--dsw-alias-label-tertiary);text-align:center;padding:20px 12px;font-size:12px}._8e7YW_teamNavigatorItem{width:100%;min-width:0;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;cursor:pointer;background:0 0;border:1px solid #0000;border-radius:12px;flex-direction:column;padding:12px;display:flex}._8e7YW_teamNavigatorItem:hover{background:var(--dsw-alias-interactive-bg-hover)}._8e7YW_teamNavigatorItemActive{border-color:var(--dsw-alias-state-business-tertiary,var(--dsw-alias-border-l2));background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-alias-shadow-l1)}._8e7YW_teamNavigatorItemTop{justify-content:space-between;align-items:center;gap:8px;min-width:0;display:flex}._8e7YW_teamNavigatorItemTop strong{white-space:nowrap;text-overflow:ellipsis;min-width:0;font-size:14px;font-weight:600;line-height:20px;overflow:hidden}._8e7YW_teamNavigatorFooter{border-top:1px solid var(--dsw-alias-border-l2);min-height:44px;color:var(--dsw-alias-label-tertiary);flex:none;align-items:center;padding:10px 20px;font-size:11px;display:flex}._8e7YW_shellHeader{box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;justify-content:space-between;align-items:center;gap:20px;min-height:70px;padding:14px 20px 13px 22px;display:flex}._8e7YW_headerCopy{flex:1;align-items:center;gap:10px;min-width:0;display:flex}._8e7YW_shellTitleRow{flex:none;align-items:center;gap:10px;min-width:0;max-width:50%;display:flex}._8e7YW_title{min-width:0;color:var(--dsw-alias-label-primary);white-space:nowrap;text-overflow:ellipsis;margin:0;font-size:19px;font-weight:600;line-height:27px;overflow:hidden}._8e7YW_subtitle{min-width:0;color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;flex:1;margin:0;font-size:12px;line-height:18px;overflow:hidden}._8e7YW_iconButton{width:32px;height:32px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;border-radius:8px;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}._8e7YW_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover)}._8e7YW_content{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);flex:1;min-height:0;padding:20px 24px 24px;overflow:auto}._8e7YW_section{min-height:100%}._8e7YW_sectionHeader{justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;display:flex}._8e7YW_sectionHeading{color:var(--dsw-alias-label-primary);align-items:center;gap:8px;margin:0;font-size:15px;font-weight:500;line-height:22px;display:flex}._8e7YW_sectionDescription{color:var(--dsw-alias-label-tertiary);margin:3px 0 0;font-size:12px;line-height:18px}._8e7YW_count{background:var(--dsw-alias-bg-module-platform);min-width:20px;height:20px;color:var(--dsw-alias-label-secondary);border-radius:10px;justify-content:center;align-items:center;padding:0 6px;font-size:11px;line-height:16px;display:inline-flex}._8e7YW_cardGrid{grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;display:grid}._8e7YW_cardList{grid-template-columns:repeat(auto-fill,minmax(min(560px,100%),1fr));align-items:start;gap:12px;display:grid}._8e7YW_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);min-width:0;color:var(--dsw-alias-label-primary);border-radius:12px;flex-direction:column;gap:6px;padding:16px;display:flex}._8e7YW_card:hover{border-color:var(--dsw-alias-border-l3)}._8e7YW_assistantCardContent{cursor:pointer;border-radius:8px;flex-direction:column;gap:6px;min-width:0;margin:-8px -8px 2px;padding:8px;display:flex}._8e7YW_assistantCardContent:hover{background:var(--dsw-alias-interactive-bg-hover)}._8e7YW_assistantCardContent:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}._8e7YW_assistantBuilderCard{border:1px solid var(--dsw-alias-state-business-tertiary,var(--dsw-alias-border-l2));background:var(--dsw-alias-bg-layer-2);min-width:0;box-shadow:var(--dsw-alias-shadow-l1);border-radius:14px;align-items:center;gap:14px;margin-bottom:16px;padding:16px;display:flex}._8e7YW_assistantBuilderAvatar{background:var(--dsw-alias-bg-module-platform);width:42px;height:42px;color:var(--dsw-alias-brand-primary);border-radius:12px;flex:none;place-items:center;font-size:13px;font-weight:700;display:grid}._8e7YW_assistantBuilderCopy{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}._8e7YW_assistantBuilderCopy strong{color:var(--dsw-alias-label-primary);font-size:14px;line-height:21px}._8e7YW_assistantBuilderCopy p{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px;line-height:18px}._8e7YW_assistantBuilderEyebrow{color:var(--dsw-alias-brand-primary);font-size:10px;line-height:16px}._8e7YW_managementCard{background:0 0;border:0;gap:18px;padding:6px}._8e7YW_managementCard:hover{border-color:#0000}._8e7YW_teamCardHeader{justify-content:space-between;align-items:flex-start;gap:14px;min-width:0;display:flex}._8e7YW_teamCardIdentity{flex-direction:column;gap:3px;min-width:0;display:flex}._8e7YW_teamCardName{color:var(--dsw-alias-label-primary);white-space:nowrap;text-overflow:ellipsis;font-size:18px;font-weight:600;line-height:26px;overflow:hidden}._8e7YW_teamCardWorkspace{color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;font-size:12px;line-height:18px;overflow:hidden}._8e7YW_row{justify-content:space-between;align-items:center;gap:12px;display:flex}._8e7YW_actions{flex-wrap:wrap;gap:8px;margin-top:8px;display:flex}._8e7YW_sectionHeaderActions{flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:8px;display:inline-flex}._8e7YW_primaryButton,._8e7YW_secondaryButton,._8e7YW_dangerButton{min-height:32px;font:inherit;cursor:pointer;border-radius:16px;padding:0 12px;font-size:13px}._8e7YW_primaryButton{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border:1px solid #0000}._8e7YW_primaryButton:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}._8e7YW_secondaryButton{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:0 0}._8e7YW_secondaryButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}._8e7YW_dangerButton{border:1px solid var(--dsw-alias-state-error-secondary);color:var(--dsw-alias-state-error-primary);background:0 0}._8e7YW_dangerButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}._8e7YW_primaryButton:disabled,._8e7YW_secondaryButton:disabled,._8e7YW_dangerButton:disabled{cursor:not-allowed;opacity:.4}._8e7YW_muted{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;font-size:12px;line-height:18px;overflow:hidden}._8e7YW_description{color:var(--dsw-alias-label-secondary);margin:2px 0 0;font-size:13px;line-height:20px}._8e7YW_animatedDialog{transform-origin:50%;animation:.18s cubic-bezier(.2,.8,.2,1) both _8e7YW_agentTeamDialogEnter}._8e7YW_animatedDialogClosing{pointer-events:none;animation:.14s ease-in both _8e7YW_agentTeamDialogExit}@keyframes _8e7YW_agentTeamDialogEnter{0%{opacity:0;transform:translateY(10px)scale(.985)}to{opacity:1;transform:translateY(0)scale(1)}}@keyframes _8e7YW_agentTeamDialogExit{0%{opacity:1;transform:translateY(0)scale(1)}to{opacity:0;transform:translateY(6px)scale(.99)}}._8e7YW_assistantDialog{width:min(880px,100vw - 48px);max-height:min(840px,100vh - 32px)}._8e7YW_assistantBuilderDialog{gap:0;width:min(1360px,100vw - 16px);height:min(920px,100vh - 16px);padding-bottom:0}._8e7YW_assistantBuilderDialogContent{flex:1;min-height:0}._8e7YW_assistantBuilderDialogContent>div:last-child{height:100%;min-height:0;margin-top:16px;padding:0}._8e7YW_assistantManagementDialog{gap:0;width:min(1240px,100vw - 32px);height:min(880px,100vh - 32px);padding-bottom:0}._8e7YW_assistantManagementDialogContent{flex:1;min-height:0}._8e7YW_assistantManagementDialogContent>div:last-child{flex:1;min-height:0;margin-top:16px;padding:0}._8e7YW_assistantManagementBody{box-sizing:border-box;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);height:100%;min-height:0;padding:0 24px 24px;overflow-y:auto}._8e7YW_assistantBuilderArchiveDialog,._8e7YW_assistantDeleteDialog{width:min(440px,100vw - 32px)}._8e7YW_teamDissolveDialog{width:min(460px,100vw - 32px)}._8e7YW_teamResetDialog{width:min(480px,100vw - 32px)}._8e7YW_teamResetConfirm{grid-template-columns:40px minmax(0,1fr);align-items:start;gap:12px;padding:4px 0;display:grid}._8e7YW_teamResetIcon{background:var(--dsw-alias-interactive-bg-hover-danger);width:40px;height:40px;color:var(--dsw-alias-state-error-primary);border-radius:10px;place-items:center;font-size:20px;font-weight:600;display:grid}._8e7YW_teamResetConfirm strong{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:21px;display:block;overflow:hidden}._8e7YW_teamResetConfirm p{color:var(--dsw-alias-label-secondary);margin:4px 0 0;font-size:12px;line-height:18px}._8e7YW_teamResetConfirm>._8e7YW_inlineError{grid-column:1/-1}._8e7YW_memberRemoveDialog{width:min(460px,100vw - 32px)}._8e7YW_memberRemoveConfirm{grid-template-columns:40px minmax(0,1fr);align-items:start;gap:12px;padding:4px 0;display:grid}._8e7YW_memberRemoveIcon{background:var(--dsw-alias-interactive-bg-hover-danger);width:40px;height:40px;color:var(--dsw-alias-state-error-primary);border-radius:10px;place-items:center;font-size:20px;font-weight:600;display:grid}._8e7YW_memberRemoveConfirm strong{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:21px;display:block;overflow:hidden}._8e7YW_memberRemoveConfirm p{color:var(--dsw-alias-label-secondary);margin:4px 0 0;font-size:12px;line-height:18px}._8e7YW_memberRemoveConfirm>._8e7YW_inlineError{grid-column:1/-1}._8e7YW_teamDissolveConfirm{grid-template-columns:40px minmax(0,1fr);align-items:start;gap:12px;padding:4px 0;display:grid}._8e7YW_teamDissolveIcon{background:var(--dsw-alias-interactive-bg-hover-danger);width:40px;height:40px;color:var(--dsw-alias-state-error-primary);border-radius:10px;place-items:center;font-size:18px;font-weight:700;display:grid}._8e7YW_teamDissolveConfirm strong{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:21px;display:block;overflow:hidden}._8e7YW_teamDissolveConfirm p{color:var(--dsw-alias-label-secondary);margin:4px 0 0;font-size:12px;line-height:18px}._8e7YW_teamDissolveConfirm>._8e7YW_inlineError{grid-column:1/-1}._8e7YW_assistantDeleteConfirm{grid-template-columns:40px minmax(0,1fr);align-items:start;gap:12px;padding:4px 0;display:grid}._8e7YW_assistantDeleteIcon{background:var(--dsw-alias-interactive-bg-hover-danger);width:40px;height:40px;color:var(--dsw-alias-state-error-primary);border-radius:10px;place-items:center;font-size:14px;font-weight:600;display:grid}._8e7YW_assistantDeleteConfirm strong{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:21px;display:block;overflow:hidden}._8e7YW_assistantDeleteConfirm p{color:var(--dsw-alias-label-secondary);margin:4px 0 0;font-size:12px;line-height:18px}._8e7YW_assistantDeleteConfirm>._8e7YW_inlineError{grid-column:1/-1}._8e7YW_confirmDangerButton{min-width:88px}._8e7YW_assistantBuilderArchiveConfirm{grid-template-columns:40px minmax(0,1fr);align-items:start;gap:12px;padding:4px 0;display:grid}._8e7YW_assistantBuilderArchiveIcon{background:var(--dsw-alias-bg-module-platform);width:40px;height:40px;color:var(--dsw-alias-label-secondary);border-radius:10px;place-items:center;display:grid}._8e7YW_assistantBuilderArchiveConfirm strong{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:21px;display:block;overflow:hidden}._8e7YW_assistantBuilderArchiveConfirm p{color:var(--dsw-alias-label-secondary);margin:4px 0 0;font-size:12px;line-height:18px}._8e7YW_assistantBuilderArchiveConfirm>._8e7YW_inlineError{grid-column:1/-1}._8e7YW_assistantBuilderConversation{border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);flex-direction:row;height:100%;min-height:0;display:flex;overflow:hidden}._8e7YW_assistantBuilderHistory{border-right:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);flex-direction:column;gap:10px;width:210px;min-width:0;padding:12px;display:flex}._8e7YW_assistantBuilderNewConversation{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);min-height:34px;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;border-radius:8px;justify-content:center;align-items:center;gap:6px;font-size:12px;display:flex}._8e7YW_assistantBuilderNewConversation:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}._8e7YW_assistantBuilderNewConversation:disabled,._8e7YW_assistantBuilderHistoryItem:disabled,._8e7YW_assistantBuilderHistoryArchive:disabled{cursor:not-allowed;opacity:.55}._8e7YW_assistantBuilderHistoryList{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);flex-direction:column;flex:1;gap:4px;min-height:0;display:flex;overflow-y:auto}._8e7YW_assistantBuilderHistoryRow{align-items:center;gap:2px;min-width:0;display:flex}._8e7YW_assistantBuilderHistoryItem{width:auto;min-width:0;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:8px;flex-direction:column;flex:1;gap:4px;padding:9px 10px;display:flex}._8e7YW_assistantBuilderHistoryArchive{width:24px;height:24px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:0;border-radius:6px;flex:none;place-items:center;padding:0;display:grid}._8e7YW_assistantBuilderHistoryArchive:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-state-error-primary)}._8e7YW_assistantBuilderHistoryArchive:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}._8e7YW_assistantBuilderHistoryItem:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}._8e7YW_assistantBuilderHistoryItemActive{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-label-primary)}._8e7YW_assistantBuilderHistoryItem strong{text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:500;line-height:18px;overflow:hidden}._8e7YW_assistantBuilderHistoryItem>span{color:var(--dsw-alias-label-tertiary);justify-content:space-between;align-items:center;gap:6px;font-size:10px;line-height:16px;display:flex}._8e7YW_assistantBuilderHistoryItem em{flex:none;font-style:normal}._8e7YW_assistantBuilderHistoryEmpty{color:var(--dsw-alias-label-tertiary);text-align:center;padding:16px 8px;font-size:11px}._8e7YW_assistantBuilderMain{flex-direction:column;flex:1;min-width:0;display:flex}._8e7YW_assistantBuilderRuntime{border-bottom:1px solid var(--dsw-alias-border-l2);min-height:48px;color:var(--dsw-alias-label-secondary);flex:none;justify-content:space-between;align-items:center;gap:12px;padding:7px 16px;font-size:11px;display:flex}._8e7YW_assistantBuilderRuntimeState,._8e7YW_assistantBuilderModelControls{align-items:center;display:flex}._8e7YW_assistantBuilderRuntimeState{white-space:nowrap;flex:none;gap:7px}._8e7YW_assistantBuilderModelControls{flex:1;justify-content:flex-end;gap:6px;min-width:0}._8e7YW_assistantBuilderModelSelect{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);min-width:0;max-width:320px;height:34px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;outline:0;flex:0 320px;padding:0 10px;font-size:13px;font-weight:500;line-height:20px}._8e7YW_assistantBuilderModelSelect:focus-visible{border-color:var(--dsw-alias-state-business-primary)}._8e7YW_assistantBuilderModelSelect:disabled{opacity:.6}._8e7YW_assistantBuilderTimeline{padding:20px 20px 16px}._8e7YW_assistantBuilderComposer{margin:0 16px 16px}._8e7YW_teamCreateDialog{gap:0;width:min(1120px,100vw - 48px);height:min(780px,100vh - 48px);padding-bottom:0}._8e7YW_teamCreateContent{flex:1;min-height:0}._8e7YW_teamCreateContent>div:last-child{flex:1;min-height:0;margin-top:16px;padding:0}._8e7YW_teamBuilderForm{flex-direction:column;flex:1;min-height:0;display:flex}._8e7YW_teamBuilderGrid{border-top:1px solid var(--dsw-alias-border-l2);border-bottom:1px solid var(--dsw-alias-border-l2);flex:1;grid-template-columns:minmax(320px,.95fr) minmax(380px,1.05fr);min-height:0;display:grid}._8e7YW_assistantPicker,._8e7YW_selectedMembers{flex-direction:column;min-width:0;min-height:0;padding:20px 24px;display:flex}._8e7YW_assistantPicker{border-right:1px solid var(--dsw-alias-border-l2)}._8e7YW_builderSectionHeading{min-height:42px;color:var(--dsw-alias-label-primary);flex:none;justify-content:space-between;align-items:flex-start;gap:16px;font-size:15px;line-height:22px;display:flex}._8e7YW_builderSectionHeading p{color:var(--dsw-alias-label-tertiary);margin:3px 0 0;font-size:12px;font-weight:400;line-height:18px}._8e7YW_builderSearch{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;height:38px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:12px;outline:none;flex:none;margin:10px 0 14px;padding:8px 12px;font-size:13px}._8e7YW_builderSearch:focus{border-color:var(--dsw-alias-brand-primary)}._8e7YW_builderSearch::placeholder{color:var(--dsw-alias-label-caption)}._8e7YW_assistantPickList,._8e7YW_selectedMemberList{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);flex:1;min-height:0;overflow-y:auto}._8e7YW_assistantPickList{flex-direction:column;gap:4px;display:flex}._8e7YW_assistantPickList ._8e7YW_empty{min-height:160px}._8e7YW_assistantPickRow{border-radius:12px;flex:none;align-items:center;gap:12px;min-height:58px;padding:8px 10px;display:flex}._8e7YW_assistantPickRow:hover{background:var(--dsw-alias-interactive-bg-hover)}._8e7YW_assistantPickAvatar{background:var(--dsw-alias-bg-module-platform);width:36px;height:36px;color:var(--dsw-alias-label-secondary);border-radius:10px;flex:none;place-items:center;font-size:13px;font-weight:500;display:grid}._8e7YW_assistantPickCopy,._8e7YW_selectedMemberCopy{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}._8e7YW_assistantPickCopy strong,._8e7YW_assistantPickCopy span,._8e7YW_selectedMemberCopy strong,._8e7YW_selectedMemberCopy span{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}._8e7YW_assistantPickCopy strong,._8e7YW_selectedMemberCopy strong{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:20px}._8e7YW_assistantPickCopy span,._8e7YW_selectedMemberCopy span{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px}._8e7YW_assistantAddButton,._8e7YW_removeDraftMember{color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}._8e7YW_assistantAddButton{width:30px;height:30px}._8e7YW_removeDraftMember{width:26px;height:26px}._8e7YW_assistantAddButton:hover,._8e7YW_removeDraftMember:hover{background:var(--dsw-alias-interactive-bg-hover)}._8e7YW_leaderLegend,._8e7YW_leaderBadge{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-label);border-radius:10px;flex:none;font-size:11px;line-height:18px}._8e7YW_leaderLegend{padding:1px 8px}._8e7YW_leaderBadge{padding:2px 8px}._8e7YW_selectedMemberList{background:var(--dsw-alias-bg-module-platform);border-radius:12px;flex-direction:column;gap:6px;margin-top:10px;padding:10px;display:flex}._8e7YW_selectedMemberRow{background:var(--dsw-alias-bg-layer-2);border:1px solid #0000;border-radius:10px;flex:none;align-items:center;gap:10px;min-height:58px;padding:8px 10px;display:flex}._8e7YW_selectedLeader{border-color:var(--dsw-alias-state-warn-secondary)}._8e7YW_setLeaderButton{color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border:0;border-radius:8px;flex:none;padding:4px 8px;font-size:11px}._8e7YW_setLeaderButton:hover{background:var(--dsw-alias-interactive-bg-hover)}._8e7YW_memberEmpty{min-height:180px;color:var(--dsw-alias-label-secondary);text-align:center;flex-direction:column;flex:1;justify-content:center;align-items:center;gap:6px;padding:24px;display:flex}._8e7YW_memberEmpty strong{font-size:13px;line-height:20px}._8e7YW_memberEmpty span{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}._8e7YW_teamFields{flex:none;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px 14px;padding-top:16px;display:grid}._8e7YW_teamFields ._8e7YW_checkboxRow{grid-column:1/-1}._8e7YW_workspacePickerRow{align-items:center;gap:8px;min-width:0;display:flex}._8e7YW_workspacePickerRow ._8e7YW_input{flex:1;min-width:0}._8e7YW_workspacePickButton{white-space:nowrap;flex:none}._8e7YW_teamBuilderActions{flex:none;justify-content:flex-end;gap:8px;padding:16px 24px;display:flex}._8e7YW_cloneTeamDialog{width:min(760px,100vw - 48px);max-height:min(760px,100vh - 48px)}._8e7YW_cloneTeamDialogContent{min-height:0}._8e7YW_cloneTeamForm{flex-direction:column;gap:18px;display:flex}._8e7YW_cloneTeamFields{grid-template-columns:minmax(180px,.7fr) minmax(320px,1.3fr);gap:14px;display:grid}._8e7YW_cloneTeamMembers{flex-direction:column;gap:10px;min-height:0;display:flex}._8e7YW_cloneTeamSectionHeader{color:var(--dsw-alias-label-primary);justify-content:space-between;align-items:center;font-size:13px;line-height:20px;display:flex}._8e7YW_cloneTeamSectionHeader span{color:var(--dsw-alias-label-tertiary);font-size:11px}._8e7YW_cloneTeamMemberGrid{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:250px;display:grid;overflow-y:auto}._8e7YW_cloneTeamMember{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:12px;align-items:center;gap:10px;min-width:0;padding:10px;display:flex}._8e7YW_cloneTeamLeader{border-color:var(--dsw-alias-state-warn-secondary)}._8e7YW_cloneTeamAvatar{background:var(--dsw-alias-bg-module-platform);width:34px;height:34px;color:var(--dsw-alias-label-secondary);border-radius:10px;flex:none;place-items:center;font-size:12px;font-weight:600;display:grid}._8e7YW_cloneTeamMemberCopy{flex-direction:column;flex:1;gap:1px;min-width:0;display:flex}._8e7YW_cloneTeamMemberCopy strong,._8e7YW_cloneTeamMemberCopy span{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}._8e7YW_cloneTeamMemberCopy strong{color:var(--dsw-alias-label-primary);font-size:12px;line-height:19px}._8e7YW_cloneTeamMemberCopy span{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px}._8e7YW_cloneTeamRole{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:8px;flex:none;padding:2px 7px;font-size:10px;line-height:16px}._8e7YW_cloneTeamLeader ._8e7YW_cloneTeamRole{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-label)}._8e7YW_cloneTeamNotice{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:10px;margin:0;padding:10px 12px;font-size:11px;line-height:18px}._8e7YW_cloneTeamActions{justify-content:flex-end;gap:8px;display:flex}._8e7YW_modalScrollContent{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);min-height:0;overflow:auto}._8e7YW_form{flex-direction:column;gap:14px;display:flex}._8e7YW_assistantForm ._8e7YW_input{font-size:13px;line-height:19px}._8e7YW_assistantForm select._8e7YW_input option{font-size:13px}._8e7YW_formGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 16px;display:grid}._8e7YW_fullWidth{grid-column:1/-1}._8e7YW_field{flex-direction:column;gap:6px;min-width:0;display:flex}._8e7YW_label{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}._8e7YW_hint{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px}._8e7YW_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;min-width:0;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;outline:none;min-height:36px;padding:7px 10px}textarea._8e7YW_input{resize:vertical}._8e7YW_input:focus{border-color:var(--dsw-alias-brand-primary)}._8e7YW_input::placeholder{color:var(--dsw-alias-label-caption)}._8e7YW_checkboxRow{color:var(--dsw-alias-label-secondary);align-items:center;gap:8px;font-size:12px;line-height:18px;display:flex}._8e7YW_skillPicker{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:8px;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:248px;padding:10px;display:grid;overflow:auto}._8e7YW_skillOption{background:var(--dsw-alias-bg-layer-2);cursor:pointer;border-radius:7px;align-items:flex-start;gap:8px;min-width:0;padding:8px;display:flex}._8e7YW_skillOption input{flex:none;margin-top:3px}._8e7YW_skillOptionText{flex-direction:column;gap:2px;min-width:0;display:flex}._8e7YW_skillOptionText strong{overflow-wrap:anywhere;color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px}._8e7YW_skillOptionText small{color:var(--dsw-alias-label-tertiary);-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:11px;line-height:16px;display:-webkit-box;overflow:hidden}._8e7YW_empty{border:1px dashed var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);min-height:300px;color:var(--dsw-alias-label-tertiary);text-align:center;border-radius:12px;place-items:center;padding:32px;display:grid}._8e7YW_emptyCopy{flex-direction:column;align-items:center;gap:4px;display:flex}._8e7YW_emptyTitle{color:var(--dsw-alias-label-secondary);font-size:14px;line-height:22px}._8e7YW_emptyHint{max-width:360px;font-size:12px;line-height:18px}._8e7YW_error,._8e7YW_inlineError{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);border-radius:8px;font-size:12px;line-height:18px}._8e7YW_error{margin:12px 24px 0;padding:9px 12px}._8e7YW_inlineError{padding:7px 9px}._8e7YW_badge{border-radius:10px;flex:none;padding:2px 7px;font-size:11px;line-height:16px}._8e7YW_badgeSuccess{background:var(--dsw-alias-state-success-tertiary);color:var(--dsw-alias-state-success-primary)}._8e7YW_badgeError{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}._8e7YW_badgeNeutral{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}._8e7YW_taskList{background:var(--dsw-alias-bg-module-platform);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;flex-direction:column;gap:5px;margin-top:7px;padding:10px;display:flex}._8e7YW_taskTitle{color:var(--dsw-alias-label-secondary);font-size:12px}._8e7YW_teamMemberSection{flex-direction:column;gap:10px;min-width:0;display:flex}._8e7YW_teamSectionHeader{justify-content:space-between;align-items:center;gap:12px;display:flex}._8e7YW_teamSectionHeader strong{color:var(--dsw-alias-label-secondary);font-size:13px;font-weight:600;line-height:20px}._8e7YW_teamSectionActions{align-items:center;gap:10px;display:inline-flex}._8e7YW_teamSectionActions>span{color:var(--dsw-alias-label-tertiary);font-size:11px}._8e7YW_addMemberButton{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);height:30px;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;border-radius:9px;align-items:center;gap:5px;padding:0 10px;font-size:11px;display:inline-flex}._8e7YW_addMemberButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}._8e7YW_addMemberButton:disabled{cursor:not-allowed;opacity:.5}._8e7YW_memberGrid{grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;display:grid}._8e7YW_memberTile{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:12px;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:10px;min-width:0;min-height:72px;padding:10px 11px;display:grid}._8e7YW_memberTileLeader{border-color:var(--dsw-alias-state-business-tertiary,var(--dsw-alias-border-l2));background:var(--dsw-alias-bg-layer-1)}._8e7YW_memberTileAvatar{background:var(--dsw-alias-bg-module-platform);width:38px;height:38px;color:var(--dsw-alias-label-secondary);border-radius:11px;place-items:center;font-size:13px;font-weight:500;display:grid}._8e7YW_memberTileCopy,._8e7YW_memberTileActions{flex-direction:column;min-width:0;display:flex}._8e7YW_memberTileCopy{gap:3px}._8e7YW_memberTileName{color:var(--dsw-alias-label-primary);white-space:nowrap;text-overflow:ellipsis;font-size:13px;font-weight:600;line-height:20px;overflow:hidden}._8e7YW_memberRuntime{color:var(--dsw-alias-label-tertiary);align-items:center;gap:5px;font-size:11px;line-height:16px;display:inline-flex}._8e7YW_memberTileActions{align-items:flex-end;gap:5px}._8e7YW_memberRole{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-tertiary);border-radius:8px;padding:2px 7px;font-size:10px;line-height:15px}._8e7YW_memberRoleLeader{background:var(--dsw-alias-state-warn-tertiary,var(--dsw-alias-bg-module-platform));color:var(--dsw-alias-state-warn-label)}._8e7YW_memberRoleAction{cursor:pointer;border:0;font-family:inherit}._8e7YW_memberRoleAction:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}._8e7YW_memberRoleAction:disabled{cursor:not-allowed;opacity:.5}._8e7YW_memberRemoveButton{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;border-radius:5px;padding:1px 4px;font-size:10px;line-height:15px}._8e7YW_memberRemoveButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}._8e7YW_addMemberDialogHeader{border-bottom:1px solid var(--dsw-alias-border-l2);justify-content:space-between;align-items:center;gap:12px;padding:2px 2px 10px;display:flex}._8e7YW_addMemberDialogHeader strong{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:20px}._8e7YW_addMemberDialogHeaderActions{align-items:center;gap:8px;display:flex}._8e7YW_addMemberDialogHeaderActions>span{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}._8e7YW_addMemberMenuList{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);flex-direction:column;gap:6px;min-height:0;max-height:70vh;padding-top:6px;padding-right:2px;display:flex;overflow-y:auto}._8e7YW_addMemberEmpty{color:var(--dsw-alias-label-tertiary);padding:10px;font-size:11px;display:block}._8e7YW_addMemberOption{background:var(--dsw-alias-bg-layer-2);min-width:0;min-height:54px;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;cursor:pointer;border:1px solid #0000;border-radius:10px;grid-template-columns:34px minmax(0,1fr) 18px;align-items:center;gap:9px;padding:7px 9px;display:grid}._8e7YW_addMemberOption:hover:not(:disabled){border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover)}._8e7YW_addMemberOption:disabled{cursor:not-allowed;opacity:.5}._8e7YW_addMemberAvatar{background:var(--dsw-alias-bg-module-platform);width:34px;height:34px;color:var(--dsw-alias-label-secondary);border-radius:9px;place-items:center;font-size:12px;font-weight:600;display:grid}._8e7YW_addMemberCopy{flex-direction:column;gap:1px;min-width:0;display:flex}._8e7YW_addMemberCopy strong,._8e7YW_addMemberCopy span{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}._8e7YW_addMemberCopy strong{color:var(--dsw-alias-label-primary);font-size:12px;font-weight:600;line-height:18px}._8e7YW_addMemberCopy span{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:15px}._8e7YW_addMemberOptionAction{color:var(--dsw-alias-label-secondary);white-space:nowrap;justify-content:flex-end;align-items:center;font-size:10px;display:inline-flex}._8e7YW_memberRow{justify-content:space-between;align-items:center;gap:12px;font-size:12px;display:flex}._8e7YW_linkDanger{color:var(--dsw-alias-state-error-primary);cursor:pointer;background:0 0;border:0;border-radius:6px;padding:2px 5px}._8e7YW_linkDanger:hover{background:var(--dsw-alias-interactive-bg-hover-danger)}._8e7YW_contextResetPanel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:12px;justify-content:space-between;align-items:center;gap:16px;min-width:0;padding:13px 14px;display:flex}._8e7YW_contextResetCopy{flex-direction:column;gap:2px;min-width:0;display:flex}._8e7YW_contextResetCopy strong{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:20px}._8e7YW_contextResetCopy span{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:17px}._8e7YW_contextResetPanel ._8e7YW_dangerButton{flex:none}._8e7YW_dissolvePanel{border-color:var(--dsw-alias-state-error-secondary);background:var(--dsw-alias-interactive-bg-hover-danger)}._8e7YW_warning{color:var(--dsw-alias-state-warn-label);margin-top:5px;font-size:11px;line-height:17px}._8e7YW_workbenchContent{padding:0;overflow:hidden}._8e7YW_workbenchContent>._8e7YW_section{height:100%}._8e7YW_workbench{background:var(--dsw-alias-bg-layer-2);flex-direction:row;height:100%;min-height:0;display:flex;position:relative}._8e7YW_workbenchMainPane{flex-direction:column;flex:1;min-width:0;min-height:0;display:flex}._8e7YW_memberTabs{border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l1);flex:none;align-items:center;gap:9px;min-height:58px;padding:10px 14px;display:flex;overflow-x:auto}._8e7YW_memberTab{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);height:38px;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;border-radius:12px;flex:none;align-items:center;gap:8px;padding:5px 12px 5px 6px;font-size:13px;font-weight:500;display:inline-flex}._8e7YW_memberTabWrap{flex:none;display:inline-flex;position:relative}._8e7YW_memberTabWithActions{padding-right:12px;transition:padding-right .14s}._8e7YW_memberTabWrap:hover ._8e7YW_memberTabWithActions,._8e7YW_memberTabWrap:focus-within ._8e7YW_memberTabWithActions{padding-right:38px}._8e7YW_memberTabName{text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:150px;overflow:hidden}._8e7YW_memberTabActions{opacity:0;pointer-events:none;align-items:center;gap:2px;padding-left:8px;transition:opacity .12s;display:inline-flex;position:absolute;top:50%;right:7px;transform:translateY(-50%)}._8e7YW_memberTabWrap:hover ._8e7YW_memberTabActions,._8e7YW_memberTabWrap:focus-within ._8e7YW_memberTabActions{opacity:1;pointer-events:auto}._8e7YW_memberTabRemoveAction{background:var(--dsw-alias-bg-layer-2);width:24px;height:24px;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;border:0;border-radius:6px;justify-content:center;align-items:center;padding:0;display:inline-flex}._8e7YW_memberTabRemoveAction:hover{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}._8e7YW_memberTab:hover{background:var(--dsw-alias-interactive-bg-hover)}._8e7YW_memberTabActive{border-color:var(--dsw-alias-state-business-secondary,var(--dsw-alias-brand-primary));color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-alias-shadow-l1)}._8e7YW_memberAvatar,._8e7YW_emptyAvatar{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:9px;place-items:center;font-weight:600;display:inline-grid}._8e7YW_memberAvatar{width:28px;height:28px;font-size:12px}._8e7YW_emptyAvatar{width:54px;height:54px;margin-bottom:4px;font-size:19px}._8e7YW_leaderCrown{vertical-align:-2px;flex:none;display:inline-block}._8e7YW_statusDot{border-radius:50%;width:6px;height:6px}._8e7YW_statusIdle{background:var(--dsw-alias-label-caption)}._8e7YW_statusRunning{background:var(--dsw-alias-state-success-primary)}._8e7YW_manageButtonWrap{flex:none;align-items:center;gap:7px;margin-left:auto;display:inline-flex}._8e7YW_manageButton{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:10px}._8e7YW_workbenchError{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);flex:none;padding:7px 14px;font-size:12px}._8e7YW_workbenchBody{background:var(--dsw-alias-bg-layer-2);flex:1;gap:10px;min-height:0;padding:10px;display:flex}._8e7YW_conversationGrid{grid-template-columns:repeat(var(--member-columns), minmax(300px, 1fr));background:0 0;flex:1;gap:10px;min-width:0;min-height:0;display:grid;overflow-x:auto}._8e7YW_conversationFocusBackdrop{z-index:90;background:var(--dsw-alias-bg-layer-1);cursor:zoom-out;opacity:.82;border:0;padding:0;animation:.16s ease-out both _8e7YW_conversationBackdropEnter;position:fixed;inset:0}@keyframes _8e7YW_conversationBackdropEnter{0%{opacity:0}to{opacity:.82}}._8e7YW_managementDialog{width:min(900px,100vw - 48px);max-height:min(820px,100vh - 48px)}._8e7YW_addMemberDialog{width:min(520px,100vw - 48px);max-height:min(680px,100vh - 48px)}._8e7YW_addMemberDialogContent{flex-direction:column;gap:10px;min-height:0;display:flex;overflow:hidden}._8e7YW_managementDialogContent{min-height:0}._8e7YW_managementDialogBody{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);min-height:0;max-height:calc(100vh - 190px);padding:4px;overflow-y:auto}@media (width<=1440px){._8e7YW_fullscreenWorkbench{grid-template-columns:216px minmax(0,1fr)}._8e7YW_teamNavigatorList{padding-inline:9px}._8e7YW_workbenchBody,._8e7YW_conversationGrid{gap:7px}._8e7YW_workbenchBody{padding:7px}._8e7YW_conversationGrid{grid-template-columns:repeat(var(--member-columns), minmax(270px, 1fr))}._8e7YW_conversationColumn{min-width:270px}}@media (width<=760px){._8e7YW_fullscreenWorkbench{grid-template-columns:176px minmax(0,1fr)}._8e7YW_teamNavigatorHeader{padding-inline:8px}._8e7YW_teamNavigatorList{padding-inline:7px}._8e7YW_teamNavigatorItem{padding-inline:9px}._8e7YW_conversationGrid{grid-template-columns:repeat(var(--member-columns), minmax(calc(100vw - 206px), 1fr));scroll-snap-type:x mandatory}._8e7YW_conversationColumn{scroll-snap-align:start}._8e7YW_shellHeader,._8e7YW_content{padding:16px}._8e7YW_formGrid,._8e7YW_teamBuilderGrid,._8e7YW_skillPicker{grid-template-columns:1fr}._8e7YW_teamCreateDialog{border-radius:16px;width:calc(100vw - 20px);height:calc(100vh - 20px)}._8e7YW_assistantDialog{border-radius:16px;width:calc(100vw - 20px);max-height:calc(100vh - 20px)}._8e7YW_assistantBuilderDialog,._8e7YW_assistantManagementDialog{border-radius:16px;width:calc(100vw - 20px);height:calc(100vh - 20px)}._8e7YW_assistantManagementBody{padding-inline:16px}._8e7YW_assistantBuilderHistory{width:132px;padding:8px}._8e7YW_assistantBuilderHistoryItem{padding-inline:8px}._8e7YW_assistantBuilderHistoryItem time{display:none}._8e7YW_assistantBuilderCard{flex-wrap:wrap;align-items:flex-start}._8e7YW_assistantBuilderCopy{flex-basis:calc(100% - 56px)}._8e7YW_assistantBuilderCard>button{margin-left:56px}._8e7YW_assistantBuilderRuntime{flex-direction:column;align-items:stretch}._8e7YW_assistantBuilderModelControls{flex-wrap:wrap;justify-content:flex-start}._8e7YW_assistantBuilderModelSelect{flex:1;max-width:none}._8e7YW_managementDialog,._8e7YW_cloneTeamDialog{width:calc(100vw - 20px);max-height:calc(100vh - 20px)}._8e7YW_memberGrid{grid-template-columns:1fr}._8e7YW_teamCreateContent{overflow-y:auto}._8e7YW_teamCreateContent>div:last-child,._8e7YW_teamBuilderForm{flex:none}._8e7YW_assistantPicker{border-right:0;border-bottom:1px solid var(--dsw-alias-border-l2)}._8e7YW_assistantPickList,._8e7YW_selectedMemberList{max-height:280px}._8e7YW_teamFields,._8e7YW_cloneTeamFields,._8e7YW_cloneTeamMemberGrid{grid-template-columns:1fr}._8e7YW_teamFields ._8e7YW_checkboxRow{grid-column:auto}._8e7YW_workspacePickerRow{flex-direction:column;align-items:stretch}._8e7YW_fullWidth{grid-column:auto}}@media (prefers-reduced-motion:reduce){._8e7YW_animatedDialog,._8e7YW_animatedDialogClosing,._8e7YW_conversationFocusBackdrop{animation:none}}";
		const tagId$2 = "@limuyang2/dsh-agent-team/AgentTeam.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@limuyang2/dsh-agent-team";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var AgentTeam_module_css_default = {
			"assistantBuilderArchiveDialog": "_8e7YW_assistantBuilderArchiveDialog",
			"teamFields": "_8e7YW_teamFields",
			"cloneTeamForm": "_8e7YW_cloneTeamForm",
			"teamCardName": "_8e7YW_teamCardName",
			"modalScrollContent": "_8e7YW_modalScrollContent",
			"badgeError": "_8e7YW_badgeError",
			"addMemberButton": "_8e7YW_addMemberButton",
			"setLeaderButton": "_8e7YW_setLeaderButton",
			"workbenchMainPane": "_8e7YW_workbenchMainPane",
			"assistantBuilderHistoryEmpty": "_8e7YW_assistantBuilderHistoryEmpty",
			"content": "_8e7YW_content",
			"memberAvatar": "_8e7YW_memberAvatar",
			"addMemberDialogContent": "_8e7YW_addMemberDialogContent",
			"teamDissolveIcon": "_8e7YW_teamDissolveIcon",
			"assistantAddButton": "_8e7YW_assistantAddButton",
			"conversationColumn": "_8e7YW_conversationColumn",
			"statusIdle": "_8e7YW_statusIdle",
			"assistantBuilderRuntimeState": "_8e7YW_assistantBuilderRuntimeState",
			"memberTabRemoveAction": "_8e7YW_memberTabRemoveAction",
			"floatingTeamLauncherState": "_8e7YW_floatingTeamLauncherState",
			"teamNavigator": "_8e7YW_teamNavigator",
			"manageButton": "_8e7YW_manageButton",
			"animatedDialog": "_8e7YW_animatedDialog",
			"title": "_8e7YW_title",
			"assistantBuilderAvatar": "_8e7YW_assistantBuilderAvatar",
			"primaryButton": "_8e7YW_primaryButton",
			"assistantBuilderDialog": "_8e7YW_assistantBuilderDialog",
			"teamCreateDialog": "_8e7YW_teamCreateDialog",
			"addMemberOption": "_8e7YW_addMemberOption",
			"hint": "_8e7YW_hint",
			"warning": "_8e7YW_warning",
			"assistantBuilderHistoryList": "_8e7YW_assistantBuilderHistoryList",
			"teamBuilderGrid": "_8e7YW_teamBuilderGrid",
			"memberTileLeader": "_8e7YW_memberTileLeader",
			"teamDissolveConfirm": "_8e7YW_teamDissolveConfirm",
			"fullscreenWorkbenchMain": "_8e7YW_fullscreenWorkbenchMain",
			"cloneTeamRole": "_8e7YW_cloneTeamRole",
			"assistantBuilderTimeline": "_8e7YW_assistantBuilderTimeline",
			"cloneTeamDialog": "_8e7YW_cloneTeamDialog",
			"builderSearch": "_8e7YW_builderSearch",
			"memberRow": "_8e7YW_memberRow",
			"agentTeamDialogExit": "_8e7YW_agentTeamDialogExit",
			"assistantBuilderConversation": "_8e7YW_assistantBuilderConversation",
			"assistantBuilderCopy": "_8e7YW_assistantBuilderCopy",
			"managementDialogContent": "_8e7YW_managementDialogContent",
			"conversationGrid": "_8e7YW_conversationGrid",
			"selectedMemberCopy": "_8e7YW_selectedMemberCopy",
			"cardList": "_8e7YW_cardList",
			"actions": "_8e7YW_actions",
			"workspacePickButton": "_8e7YW_workspacePickButton",
			"floatingTeamLauncherLabel": "_8e7YW_floatingTeamLauncherLabel",
			"teamNavigatorTitle": "_8e7YW_teamNavigatorTitle",
			"teamDissolveDialog": "_8e7YW_teamDissolveDialog",
			"floatingTeamLauncherSettled": "_8e7YW_floatingTeamLauncherSettled",
			"assistantBuilderRuntime": "_8e7YW_assistantBuilderRuntime",
			"empty": "_8e7YW_empty",
			"label": "_8e7YW_label",
			"sectionHeading": "_8e7YW_sectionHeading",
			"teamCardWorkspace": "_8e7YW_teamCardWorkspace",
			"skillOption": "_8e7YW_skillOption",
			"memberTile": "_8e7YW_memberTile",
			"memberRoleAction": "_8e7YW_memberRoleAction",
			"formGrid": "_8e7YW_formGrid",
			"memberRemoveButton": "_8e7YW_memberRemoveButton",
			"teamCardIdentity": "_8e7YW_teamCardIdentity",
			"assistantManagementDialogContent": "_8e7YW_assistantManagementDialogContent",
			"assistantPickRow": "_8e7YW_assistantPickRow",
			"floatingTeamLauncherIcon": "_8e7YW_floatingTeamLauncherIcon",
			"secondaryButton": "_8e7YW_secondaryButton",
			"leaderBadge": "_8e7YW_leaderBadge",
			"description": "_8e7YW_description",
			"taskTitle": "_8e7YW_taskTitle",
			"settingsTitle": "_8e7YW_settingsTitle",
			"assistantDeleteConfirm": "_8e7YW_assistantDeleteConfirm",
			"addMemberDialogHeaderActions": "_8e7YW_addMemberDialogHeaderActions",
			"teamNavigatorHeader": "_8e7YW_teamNavigatorHeader",
			"floatingTeamLauncherDragging": "_8e7YW_floatingTeamLauncherDragging",
			"assistantCardContent": "_8e7YW_assistantCardContent",
			"assistantDeleteIcon": "_8e7YW_assistantDeleteIcon",
			"dangerButton": "_8e7YW_dangerButton",
			"memberTileName": "_8e7YW_memberTileName",
			"assistantBuilderArchiveConfirm": "_8e7YW_assistantBuilderArchiveConfirm",
			"builderSectionHeading": "_8e7YW_builderSectionHeading",
			"removeDraftMember": "_8e7YW_removeDraftMember",
			"assistantBuilderHistoryArchive": "_8e7YW_assistantBuilderHistoryArchive",
			"floatingTeamLauncher": "_8e7YW_floatingTeamLauncher",
			"assistantBuilderHistoryRow": "_8e7YW_assistantBuilderHistoryRow",
			"cardGrid": "_8e7YW_cardGrid",
			"linkDanger": "_8e7YW_linkDanger",
			"managementCard": "_8e7YW_managementCard",
			"assistantBuilderNewConversation": "_8e7YW_assistantBuilderNewConversation",
			"assistantBuilderModelControls": "_8e7YW_assistantBuilderModelControls",
			"assistantBuilderCard": "_8e7YW_assistantBuilderCard",
			"leaderLegend": "_8e7YW_leaderLegend",
			"cloneTeamMembers": "_8e7YW_cloneTeamMembers",
			"teamResetConfirm": "_8e7YW_teamResetConfirm",
			"teamNavigatorList": "_8e7YW_teamNavigatorList",
			"teamNavigatorItem": "_8e7YW_teamNavigatorItem",
			"cloneTeamMemberGrid": "_8e7YW_cloneTeamMemberGrid",
			"assistantForm": "_8e7YW_assistantForm",
			"inlineError": "_8e7YW_inlineError",
			"memberTileAvatar": "_8e7YW_memberTileAvatar",
			"memberTileCopy": "_8e7YW_memberTileCopy",
			"teamCreateContent": "_8e7YW_teamCreateContent",
			"addMemberAvatar": "_8e7YW_addMemberAvatar",
			"workbench": "_8e7YW_workbench",
			"skillOptionText": "_8e7YW_skillOptionText",
			"addMemberMenuList": "_8e7YW_addMemberMenuList",
			"badgeNeutral": "_8e7YW_badgeNeutral",
			"memberTabWithActions": "_8e7YW_memberTabWithActions",
			"memberTabName": "_8e7YW_memberTabName",
			"memberTabActive": "_8e7YW_memberTabActive",
			"cloneTeamAvatar": "_8e7YW_cloneTeamAvatar",
			"settingsSection": "_8e7YW_settingsSection",
			"shellTitleRow": "_8e7YW_shellTitleRow",
			"teamSectionHeader": "_8e7YW_teamSectionHeader",
			"memberGrid": "_8e7YW_memberGrid",
			"memberRemoveDialog": "_8e7YW_memberRemoveDialog",
			"animatedDialogClosing": "_8e7YW_animatedDialogClosing",
			"memberRuntime": "_8e7YW_memberRuntime",
			"fullscreenWorkbench": "_8e7YW_fullscreenWorkbench",
			"contextResetCopy": "_8e7YW_contextResetCopy",
			"memberTabWrap": "_8e7YW_memberTabWrap",
			"assistantPicker": "_8e7YW_assistantPicker",
			"emptyAvatar": "_8e7YW_emptyAvatar",
			"assistantBuilderHistoryItemActive": "_8e7YW_assistantBuilderHistoryItemActive",
			"iconButton": "_8e7YW_iconButton",
			"assistantDialog": "_8e7YW_assistantDialog",
			"teamNavigatorItemActive": "_8e7YW_teamNavigatorItemActive",
			"confirmDangerButton": "_8e7YW_confirmDangerButton",
			"assistantPickList": "_8e7YW_assistantPickList",
			"muted": "_8e7YW_muted",
			"assistantManagementDialog": "_8e7YW_assistantManagementDialog",
			"selectedMemberList": "_8e7YW_selectedMemberList",
			"teamMemberSection": "_8e7YW_teamMemberSection",
			"teamSectionActions": "_8e7YW_teamSectionActions",
			"addMemberDialogHeader": "_8e7YW_addMemberDialogHeader",
			"contextResetPanel": "_8e7YW_contextResetPanel",
			"assistantBuilderDialogContent": "_8e7YW_assistantBuilderDialogContent",
			"emptyHint": "_8e7YW_emptyHint",
			"cloneTeamNotice": "_8e7YW_cloneTeamNotice",
			"teamNavigatorAdd": "_8e7YW_teamNavigatorAdd",
			"cloneTeamSectionHeader": "_8e7YW_cloneTeamSectionHeader",
			"badgeSuccess": "_8e7YW_badgeSuccess",
			"addMemberEmpty": "_8e7YW_addMemberEmpty",
			"statusDot": "_8e7YW_statusDot",
			"card": "_8e7YW_card",
			"statusRunning": "_8e7YW_statusRunning",
			"manageButtonWrap": "_8e7YW_manageButtonWrap",
			"conversationFocusBackdrop": "_8e7YW_conversationFocusBackdrop",
			"assistantDeleteDialog": "_8e7YW_assistantDeleteDialog",
			"teamResetIcon": "_8e7YW_teamResetIcon",
			"assistantBuilderEyebrow": "_8e7YW_assistantBuilderEyebrow",
			"error": "_8e7YW_error",
			"teamCardHeader": "_8e7YW_teamCardHeader",
			"selectedLeader": "_8e7YW_selectedLeader",
			"memberRoleLeader": "_8e7YW_memberRoleLeader",
			"addMemberOptionAction": "_8e7YW_addMemberOptionAction",
			"memberEmpty": "_8e7YW_memberEmpty",
			"dissolvePanel": "_8e7YW_dissolvePanel",
			"workbenchContent": "_8e7YW_workbenchContent",
			"settingsDescription": "_8e7YW_settingsDescription",
			"input": "_8e7YW_input",
			"workbenchBody": "_8e7YW_workbenchBody",
			"sectionHeader": "_8e7YW_sectionHeader",
			"memberRemoveIcon": "_8e7YW_memberRemoveIcon",
			"skillPicker": "_8e7YW_skillPicker",
			"section": "_8e7YW_section",
			"memberTabs": "_8e7YW_memberTabs",
			"assistantBuilderHistoryItem": "_8e7YW_assistantBuilderHistoryItem",
			"leaderCrown": "_8e7YW_leaderCrown",
			"cloneTeamMember": "_8e7YW_cloneTeamMember",
			"addMemberDialog": "_8e7YW_addMemberDialog",
			"fullWidth": "_8e7YW_fullWidth",
			"memberTabActions": "_8e7YW_memberTabActions",
			"assistantBuilderArchiveIcon": "_8e7YW_assistantBuilderArchiveIcon",
			"teamBuilderForm": "_8e7YW_teamBuilderForm",
			"selectedMemberRow": "_8e7YW_selectedMemberRow",
			"assistantBuilderModelSelect": "_8e7YW_assistantBuilderModelSelect",
			"emptyTitle": "_8e7YW_emptyTitle",
			"managementDialog": "_8e7YW_managementDialog",
			"agentTeamDialogEnter": "_8e7YW_agentTeamDialogEnter",
			"addMemberCopy": "_8e7YW_addMemberCopy",
			"checkboxRow": "_8e7YW_checkboxRow",
			"sectionDescription": "_8e7YW_sectionDescription",
			"shellHeader": "_8e7YW_shellHeader",
			"cloneTeamMemberCopy": "_8e7YW_cloneTeamMemberCopy",
			"assistantBuilderHistory": "_8e7YW_assistantBuilderHistory",
			"teamResetDialog": "_8e7YW_teamResetDialog",
			"memberRemoveConfirm": "_8e7YW_memberRemoveConfirm",
			"cloneTeamActions": "_8e7YW_cloneTeamActions",
			"memberTileActions": "_8e7YW_memberTileActions",
			"memberRole": "_8e7YW_memberRole",
			"workbenchError": "_8e7YW_workbenchError",
			"conversationBackdropEnter": "_8e7YW_conversationBackdropEnter",
			"assistantBuilderComposer": "_8e7YW_assistantBuilderComposer",
			"teamNavigatorEmpty": "_8e7YW_teamNavigatorEmpty",
			"teamNavigatorItemTop": "_8e7YW_teamNavigatorItemTop",
			"badge": "_8e7YW_badge",
			"assistantPickCopy": "_8e7YW_assistantPickCopy",
			"workspacePickerRow": "_8e7YW_workspacePickerRow",
			"cloneTeamDialogContent": "_8e7YW_cloneTeamDialogContent",
			"memberTab": "_8e7YW_memberTab",
			"field": "_8e7YW_field",
			"settingsHeading": "_8e7YW_settingsHeading",
			"taskList": "_8e7YW_taskList",
			"assistantPickAvatar": "_8e7YW_assistantPickAvatar",
			"subtitle": "_8e7YW_subtitle",
			"managementDialogBody": "_8e7YW_managementDialogBody",
			"teamBuilderActions": "_8e7YW_teamBuilderActions",
			"assistantBuilderMain": "_8e7YW_assistantBuilderMain",
			"assistantManagementBody": "_8e7YW_assistantManagementBody",
			"selectedMembers": "_8e7YW_selectedMembers",
			"row": "_8e7YW_row",
			"sectionHeaderActions": "_8e7YW_sectionHeaderActions",
			"teamNavigatorFooter": "_8e7YW_teamNavigatorFooter",
			"cloneTeamLeader": "_8e7YW_cloneTeamLeader",
			"cloneTeamFields": "_8e7YW_cloneTeamFields",
			"form": "_8e7YW_form",
			"headerCopy": "_8e7YW_headerCopy",
			"emptyCopy": "_8e7YW_emptyCopy",
			"count": "_8e7YW_count"
		};
		//#endregion
		//#region src/client/keyboard.ts
		function shouldSubmitComposer(event, compositionActive) {
			return event.key === "Enter" && !event.shiftKey && !compositionActive && !event.isComposing && event.keyCode !== 229;
		}
		//#endregion
		//#region src/client/labels.ts
		const TASK_STATE_LABELS = {
			pending: "待处理",
			assigned: "已分配",
			in_progress: "进行中",
			completed: "已完成",
			failed: "失败",
			cancelled: "已取消"
		};
		const PERMISSION_LABELS = {
			"read-only": "只读",
			"workspace-write": "工作区可写",
			"danger-full-access": "完全访问"
		};
		function memberStatusLabel(status) {
			return {
				offline: "离线",
				starting: "启动中",
				idle: "空闲",
				running: "运行中",
				waiting_approval: "等待审批",
				error: "异常"
			}[status] ?? status;
		}
		//#endregion
		//#region src/client/model-reasoning.ts
		function useModelCapabilities(provider, model) {
			const [state, setState] = (0, react.useState)({ loading: false });
			(0, react.useEffect)(() => {
				let active = true;
				if (!provider || !model) {
					setState({ loading: false });
					return () => {
						active = false;
					};
				}
				setState({ loading: true });
				callAgentTeam("catalog.model.get", {
					provider,
					model
				}).then((value) => {
					if (active) setState({
						value,
						loading: false
					});
				}).catch((cause) => {
					if (!active) return;
					setState({
						loading: false,
						error: cause instanceof Error ? cause.message : String(cause)
					});
				});
				return () => {
					active = false;
				};
			}, [model, provider]);
			if (state.value !== void 0 && (state.value.provider !== provider || state.value.model !== model)) return { loading: true };
			return state;
		}
		function reasoningEffortLabel(capabilities, effortId) {
			return (capabilities?.reasoning?.efforts.find((candidate) => candidate.id === effortId))?.name ?? effortId;
		}
		function defaultReasoningLabel(capabilities) {
			const defaultEffort = capabilities?.reasoning?.defaultEffort;
			return defaultEffort === void 0 ? "模型默认" : `模型默认（${reasoningEffortLabel(capabilities, defaultEffort)}）`;
		}
		//#endregion
		//#region src/client/shared.tsx
		const DIALOG_EXIT_MS = 140;
		function AnimatedModal(props) {
			const [rendered, setRendered] = (0, react.useState)(props.open);
			const [closing, setClosing] = (0, react.useState)(false);
			const latestOpenProps = (0, react.useRef)(props);
			if (props.open) latestOpenProps.current = props;
			(0, react.useEffect)(() => {
				if (props.open) {
					setRendered(true);
					setClosing(false);
					return;
				}
				if (!rendered) return;
				setClosing(true);
				const exitDelay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : DIALOG_EXIT_MS;
				const timer = window.setTimeout(() => {
					setRendered(false);
					setClosing(false);
				}, exitDelay);
				return () => {
					window.clearTimeout(timer);
				};
			}, [props.open, rendered]);
			if (!props.open && !rendered) return null;
			const activeProps = props.open ? props : latestOpenProps.current;
			const className = [
				AgentTeam_module_css_default.animatedDialog,
				closing ? AgentTeam_module_css_default.animatedDialogClosing : "",
				activeProps.className ?? ""
			].filter(Boolean).join(" ");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				...activeProps,
				open: true,
				onClose: () => {
					if (!closing) activeProps.onClose();
				},
				className
			});
		}
		function Field({ label, children, className = "" }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: `${AgentTeam_module_css_default.field} ${className}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: AgentTeam_module_css_default.label,
					children: label
				}), children]
			});
		}
		function Empty({ text, hint }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: AgentTeam_module_css_default.empty,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AgentTeam_module_css_default.emptyCopy,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: AgentTeam_module_css_default.emptyTitle,
						children: text
					}), hint && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: AgentTeam_module_css_default.emptyHint,
						children: hint
					})]
				})
			});
		}
		//#endregion
		//#region src/client/composer-triggers.ts
		function composerTriggerAt(value, rawCursor) {
			const cursor = Math.max(0, Math.min(rawCursor, value.length));
			let start = cursor;
			while (start > 0 && !/\s/.test(value[start - 1] ?? "")) start -= 1;
			const token = value.slice(start, cursor);
			if (token.length === 0) return void 0;
			const marker = token[0];
			if (marker !== "/" && marker !== "@") return void 0;
			if (marker === "@" && token.startsWith("@\"")) return void 0;
			const query = token.slice(1);
			if (marker === "/" && !/^[a-zA-Z0-9._-]*$/.test(query)) return void 0;
			let end = cursor;
			while (end < value.length && !/\s/.test(value[end] ?? "")) end += 1;
			return {
				kind: marker === "/" ? "skill" : "file",
				start,
				end,
				query
			};
		}
		function replaceComposerTrigger(value, trigger, replacement) {
			const suffix = trigger.end >= value.length || !/\s/.test(value[trigger.end] ?? "") ? " " : "";
			return {
				value: `${value.slice(0, trigger.start)}${replacement}${suffix}${value.slice(trigger.end)}`,
				cursor: trigger.start + replacement.length + suffix.length
			};
		}
		function matchingUserSkills(skills, selectedNames, rawQuery) {
			const query = rawQuery.toLocaleLowerCase();
			return skills.filter((skill) => selectedNames.has(skill.name) && skill.userInvocable && skill.name.toLocaleLowerCase().includes(query)).sort((left, right) => Number(!left.name.toLocaleLowerCase().startsWith(query)) - Number(!right.name.toLocaleLowerCase().startsWith(query)) || left.name.localeCompare(right.name));
		}
		function scrollTopForActiveOption(geometry) {
			if (geometry.optionTop < geometry.viewportTop) return Math.max(0, geometry.scrollTop - (geometry.viewportTop - geometry.optionTop));
			if (geometry.optionBottom > geometry.viewportBottom) return geometry.scrollTop + geometry.optionBottom - geometry.viewportBottom;
			return geometry.scrollTop;
		}
		//#endregion
		//#region \0agent-team-css:/Users/xiong/Doubao/chats/2026-10-15/new-chat/dsh-agent-team/src/client/workbench/ConversationColumn.module.css.mjs
		const css$1 = ".VI70sW_memberAvatar,.VI70sW_emptyAvatar{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:9px;place-items:center;font-weight:600;display:inline-grid}.VI70sW_memberAvatar{width:28px;height:28px;font-size:12px}.VI70sW_emptyAvatar{width:54px;height:54px;margin-bottom:4px;font-size:19px}.VI70sW_leaderCrown{vertical-align:-2px;flex:none;display:inline-block}.VI70sW_conversationColumn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);min-width:300px;min-height:0;box-shadow:var(--dsw-alias-shadow-l1);border-radius:14px;flex-direction:column;display:flex;overflow:hidden}.VI70sW_conversationColumnExpanded{z-index:91;min-width:0;box-shadow:var(--dsw-alias-shadow-l2,var(--dsw-alias-shadow-l1));transform-origin:50%;border-radius:16px;animation:.18s cubic-bezier(.2,.8,.2,1) both VI70sW_conversationDialogEnter;position:fixed;inset:clamp(22px,5vh,56px) clamp(22px,6vw,96px)}@keyframes VI70sW_conversationDialogEnter{0%{opacity:0;transform:translateY(10px)scale(.985)}to{opacity:1;transform:translateY(0)scale(1)}}.VI70sW_conversationColumnExpanded .VI70sW_columnHeader{cursor:default;min-height:64px;padding-inline:18px}.VI70sW_conversationColumnExpanded .VI70sW_timeline{padding:24px 28px 20px}.VI70sW_conversationColumnExpanded .VI70sW_messageNode,.VI70sW_conversationColumnExpanded .VI70sW_teamMessageCard{max-width:min(76%,820px)}.VI70sW_conversationColumnExpanded .VI70sW_teamMessageCard{width:min(76%,820px)}.VI70sW_conversationColumnExpanded .VI70sW_toolCard{align-self:flex-start;width:min(76%,820px)}.VI70sW_columnHeader{border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);cursor:zoom-in;flex:none;justify-content:space-between;align-items:center;gap:10px;min-height:56px;padding:9px 13px;display:flex}.VI70sW_columnHeaderActions{flex:none;align-items:center;gap:8px;display:flex}.VI70sW_columnExpandClose{width:30px;height:30px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;border-radius:8px;justify-content:center;align-items:center;padding:0;display:inline-flex}.VI70sW_columnExpandClose:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.VI70sW_columnIdentity{align-items:center;gap:9px;min-width:0;display:flex}.VI70sW_columnIdentity>div{flex-direction:column;min-width:0;display:flex}.VI70sW_columnIdentity strong,.VI70sW_columnIdentity span{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.VI70sW_columnIdentity strong{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:19px}.VI70sW_columnIdentity div>span{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}.VI70sW_columnIdentity .VI70sW_columnModelMeta{flex-direction:row;align-items:center;gap:6px;min-width:0;display:flex}.VI70sW_columnModelName{white-space:nowrap;text-overflow:ellipsis;min-width:0;overflow:hidden}.VI70sW_columnIdentity .VI70sW_reasoningModeBadge{background:var(--dsw-alias-bg-module-platform);max-width:128px;color:var(--dsw-alias-label-secondary);white-space:nowrap;text-overflow:ellipsis;border-radius:6px;flex:none;padding:0 5px;overflow:hidden}.VI70sW_columnStatus{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-tertiary);border-radius:10px;flex:none;padding:3px 8px;font-size:11px;line-height:16px}.VI70sW_timeline{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);flex-direction:column;flex:1;gap:14px;min-height:0;padding:20px 16px 16px;display:flex;overflow-y:auto}.VI70sW_columnEmpty{color:var(--dsw-alias-label-secondary);text-align:center;flex-direction:column;flex:1;justify-content:center;align-items:center;gap:7px;padding:28px 18px;display:flex}.VI70sW_columnEmpty strong{font-size:15px}.VI70sW_columnEmpty>span:last-child{max-width:260px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:19px}.VI70sW_messageNode{max-width:90%;color:var(--dsw-alias-label-primary);font:var(--dsw-font-markdown-base);border-radius:14px;padding:10px 12px}.VI70sW_userMessage{background:var(--dsw-alias-bg-module-platform);font:var(--dsw-font-s-14);border-bottom-right-radius:5px;align-self:flex-end}.VI70sW_assistantMessage{background:0 0;align-self:flex-start;padding-left:0}.VI70sW_teamMessageCard{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);width:min(88%,560px);color:var(--dsw-alias-label-secondary);border-radius:10px;flex:none;align-self:flex-start;padding:9px 11px 10px 13px;position:relative;overflow:hidden}.VI70sW_teamMessageCard:before{background:var(--team-message-accent,var(--dsw-alias-state-business-primary));content:\"\";width:3px;position:absolute;inset:0 auto 0 0}.VI70sW_teamMessageHeader,.VI70sW_teamMessageIdentity{align-items:center;display:flex}.VI70sW_teamMessageHeader{justify-content:space-between;gap:10px;margin-bottom:5px}.VI70sW_teamMessageIdentity{min-width:0;font:var(--dsw-font-xxxs-11);gap:6px}.VI70sW_teamMessageIdentity strong{color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxxs-strong-11);flex:none}.VI70sW_teamMessageIdentity span{color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.VI70sW_teamMessageMemberId{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-markdown-code-block-small);border-radius:5px;flex:none;padding:1px 5px}.VI70sW_teamMessageType{background:var(--team-message-tag-bg,var(--dsw-alias-bg-module-platform));color:var(--team-message-accent,var(--dsw-alias-label-secondary));font:var(--dsw-font-xxxs-11);border-radius:8px;flex:none;padding:1px 6px}.VI70sW_teamMessageText{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13)}.VI70sW_teamMessageInstruction{--team-message-accent:var(--dsw-alias-brand-primary);--team-message-tag-bg:var(--dsw-alias-interactive-bg-active)}.VI70sW_teamMessageProgress{--team-message-accent:var(--dsw-alias-state-business-primary);--team-message-tag-bg:var(--dsw-alias-state-business-tertiary,var(--dsw-alias-bg-module-platform))}.VI70sW_teamMessageResult{--team-message-accent:var(--dsw-alias-state-success-primary);--team-message-tag-bg:var(--dsw-alias-state-success-tertiary)}.VI70sW_teamMessageQuestion{--team-message-accent:var(--dsw-alias-state-warn-label);--team-message-tag-bg:var(--dsw-alias-state-warn-tertiary)}.VI70sW_teamMessageWarning{--team-message-accent:var(--dsw-alias-state-error-primary);--team-message-tag-bg:var(--dsw-alias-state-error-secondary)}.VI70sW_teamMessageSystem{--team-message-accent:var(--dsw-alias-label-tertiary);--team-message-tag-bg:var(--dsw-alias-bg-module-platform)}.VI70sW_messageText{overflow-wrap:anywhere;min-width:0}.VI70sW_reasoningBlock{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12);margin-bottom:7px}.VI70sW_reasoningBlock summary,.VI70sW_toolCard summary{cursor:pointer}.VI70sW_reasoningBlock summary{align-items:center;gap:5px;width:fit-content;list-style:none;display:flex}.VI70sW_reasoningBlock summary::-webkit-details-marker{display:none}.VI70sW_reasoningIcon{color:inherit;flex:none}.VI70sW_reasoningTime{color:var(--dsw-alias-label-quaternary,var(--dsw-alias-label-tertiary));font-variant-numeric:tabular-nums}.VI70sW_reasoningSeparator{color:var(--dsw-alias-label-quaternary,var(--dsw-alias-label-tertiary))}.VI70sW_reasoningBlock pre,.VI70sW_toolSection pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;font:var(--dsw-font-markdown-code-block-small);margin:6px 0 0;overflow:auto}.VI70sW_streamingMark{color:var(--dsw-alias-brand-primary);font:var(--dsw-font-xxxs-11);margin-top:5px;display:inline-block}.VI70sW_toolCard{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);width:94%;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);border-radius:12px;align-self:center}.VI70sW_toolCard>summary{align-items:center;gap:7px;min-height:38px;padding:6px 10px;list-style:none;display:flex}.VI70sW_toolCard>summary strong{min-width:0;color:var(--dsw-alias-label-primary);white-space:nowrap;text-overflow:ellipsis;flex:1;overflow:hidden}.VI70sW_toolIcon{background:var(--dsw-alias-bg-module-platform);border-radius:6px;place-items:center;width:22px;height:22px;display:inline-grid}.VI70sW_toolCardError{border-color:var(--dsw-alias-state-error-secondary)}.VI70sW_toolSection{border-top:1px solid var(--dsw-alias-border-l2);padding:8px 10px}.VI70sW_toolSection>span{color:var(--dsw-alias-label-tertiary)}.VI70sW_toolError,.VI70sW_noticeError{color:var(--dsw-alias-state-error-primary)}.VI70sW_toolError{border-top:1px solid var(--dsw-alias-state-error-secondary);padding:8px 10px}.VI70sW_noticeNode{background:var(--dsw-alias-bg-module-platform);width:calc(100% - 20px);color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);border-radius:8px;align-self:center;padding:7px 9px}.VI70sW_interactionCard{box-sizing:border-box;border:1px solid var(--dsw-alias-state-warn-label);background:var(--dsw-alias-bg-layer-2);width:min(94%,680px);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-alias-shadow-l1);border-radius:12px;align-self:center;padding:13px}.VI70sW_approvalCard{border-color:var(--dsw-alias-state-warn-label)}.VI70sW_questionCard{border-color:var(--dsw-alias-state-business-primary)}.VI70sW_interactionHeader,.VI70sW_interactionActions{align-items:center;display:flex}.VI70sW_interactionHeader{justify-content:space-between;gap:12px;margin-bottom:10px}.VI70sW_interactionHeader strong{font:var(--dsw-font-xs-strong-13)}.VI70sW_interactionHeader span{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11)}.VI70sW_approvalToolName{background:var(--dsw-alias-bg-module-platform);font:var(--dsw-font-markdown-code-block-small);border-radius:6px;padding:3px 7px;display:inline-block}.VI70sW_interactionDescription{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);overflow-wrap:anywhere;margin:9px 0 0}.VI70sW_questionList{flex-direction:column;gap:14px;display:flex}.VI70sW_questionFieldset{border:0;min-width:0;margin:0;padding:0}.VI70sW_questionFieldset legend{flex-direction:column;gap:2px;width:100%;padding:0;display:flex}.VI70sW_questionFieldset legend>span{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11)}.VI70sW_questionFieldset legend>strong{color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-strong-12)}.VI70sW_questionDetail{background:var(--dsw-alias-bg-module-platform);max-height:260px;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);border-radius:8px;margin-top:8px;padding:9px 10px;overflow:auto}.VI70sW_questionOptions{flex-direction:column;gap:6px;margin-top:8px;display:flex}.VI70sW_questionOption{border:1px solid var(--dsw-alias-border-l2);cursor:pointer;border-radius:8px;align-items:flex-start;gap:8px;padding:8px 9px;display:flex}.VI70sW_questionOption:hover{background:var(--dsw-alias-interactive-bg-hover)}.VI70sW_questionOption input{accent-color:var(--dsw-alias-state-business-primary);flex:none;margin:2px 0 0}.VI70sW_questionOption>span{flex-direction:column;gap:2px;min-width:0;display:flex}.VI70sW_questionOption strong{font:var(--dsw-font-xxs-strong-12)}.VI70sW_questionOption small{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11)}.VI70sW_questionCustomInput{box-sizing:border-box;resize:vertical;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;min-height:52px;max-height:120px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-14);border-radius:8px;outline:0;margin-top:8px;padding:8px 9px}.VI70sW_questionCustomInput:focus{border-color:var(--dsw-alias-state-business-primary)}.VI70sW_interactionActions{justify-content:flex-end;gap:8px;margin-top:12px}.VI70sW_interactionPrimaryButton,.VI70sW_interactionSecondaryButton{min-height:30px;font:var(--dsw-font-xxs-strong-12);cursor:pointer;border-radius:8px;padding:5px 12px}.VI70sW_interactionPrimaryButton{background:var(--dsw-alias-button-info-fill);color:var(--dsw-alias-label-primary-foreground);border:0}.VI70sW_interactionPrimaryButton:hover:not(:disabled){background:var(--dsw-alias-button-info-hover)}.VI70sW_interactionSecondaryButton{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.VI70sW_interactionSecondaryButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.VI70sW_interactionPrimaryButton:disabled,.VI70sW_interactionSecondaryButton:disabled{cursor:default;opacity:.45}.VI70sW_interactionError{color:var(--dsw-alias-state-error-primary);font:var(--dsw-font-xxxs-11);margin-top:8px;display:block}.VI70sW_composer{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-alias-shadow-l1);border-radius:16px;flex:none;margin:0 12px 12px;padding:9px 10px;position:relative}.VI70sW_composerTriggerMenu{z-index:12;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-alias-shadow-l2,var(--dsw-alias-shadow-l1));border-radius:12px;position:absolute;bottom:calc(100% + 8px);left:0;right:0;overflow:hidden}.VI70sW_composerTriggerHeading{border-bottom:1px solid var(--dsw-alias-border-l2);min-height:34px;color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11);justify-content:space-between;align-items:center;gap:10px;padding:0 11px;display:flex}.VI70sW_composerTriggerHeading strong{color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-strong-12)}.VI70sW_composerTriggerOptions{max-height:240px;padding:5px;overflow-y:auto}.VI70sW_composerTriggerOption{width:100%;min-width:0;color:var(--dsw-alias-label-secondary);cursor:pointer;text-align:left;background:0 0;border:0;border-radius:8px;flex-direction:column;align-items:flex-start;gap:2px;padding:7px 8px;display:flex}.VI70sW_composerTriggerOption:hover,.VI70sW_composerTriggerOptionActive{background:var(--dsw-alias-interactive-bg-hover)}.VI70sW_composerTriggerOption strong,.VI70sW_composerTriggerOption span{white-space:nowrap;text-overflow:ellipsis;max-width:100%;overflow:hidden}.VI70sW_composerTriggerOption strong{color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-strong-12)}.VI70sW_composerTriggerOption span,.VI70sW_composerTriggerEmpty{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11)}.VI70sW_composerTriggerEmpty{text-align:center;padding:12px 9px;display:block}.VI70sW_composer:focus-within{border-color:var(--dsw-alias-brand-primary)}.VI70sW_composer textarea{box-sizing:border-box;resize:none;width:100%;min-height:46px;max-height:120px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-14);background:0 0;border:0;outline:0}.VI70sW_composer textarea::placeholder{color:var(--dsw-alias-label-caption)}.VI70sW_contextUsage{flex:none;position:relative}.VI70sW_contextUsageButton{width:36px;height:36px;color:var(--dsw-alias-state-business-primary);cursor:help;background:0 0;border:0;border-radius:999px;outline:0;place-items:center;padding:0;display:grid}.VI70sW_contextUsageButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.VI70sW_contextUsageButton:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}.VI70sW_contextUsageRing{width:30px;height:30px;transform:rotate(-90deg)}.VI70sW_contextUsageRingTrack,.VI70sW_contextUsageRingValue{fill:none;stroke-width:3px}.VI70sW_contextUsageRingTrack{stroke:var(--dsw-alias-border-l2)}.VI70sW_contextUsageRingValue{stroke:currentColor;stroke-linecap:round;transition:stroke-dasharray .18s}.VI70sW_contextUsageWarning{color:var(--dsw-alias-state-warning-primary)}.VI70sW_contextUsageCritical{color:var(--dsw-alias-state-error-primary)}.VI70sW_contextUsagePopover{z-index:6;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:250px;box-shadow:var(--dsw-alias-shadow-l2,var(--dsw-alias-shadow-l1));color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);opacity:0;pointer-events:none;border-radius:9px;flex-direction:column;gap:7px;padding:14px 16px;transition:opacity .1s,transform .1s;display:flex;position:absolute;bottom:calc(100% + 10px);right:0;transform:translateY(4px)}.VI70sW_contextUsagePopover:after{content:\"\";border-right:1px solid var(--dsw-alias-border-l2);border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:10px;height:10px;position:absolute;bottom:-6px;right:10px;transform:rotate(45deg)}.VI70sW_contextUsagePopover strong{color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-strong-14)}.VI70sW_contextUsage:hover .VI70sW_contextUsagePopover,.VI70sW_contextUsage:focus-within .VI70sW_contextUsagePopover{opacity:1;transform:translateY(0)}.VI70sW_composerFooter{justify-content:space-between;align-items:center;gap:8px;display:flex}.VI70sW_composerUtilities{align-items:center;gap:3px;min-width:0;display:flex}.VI70sW_permissionSelect{min-width:0;max-width:180px;height:30px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:var(--dsw-font-xxs-strong-12);background:0 0;border:0;border-radius:8px;outline:0;padding:0 8px}.VI70sW_permissionSelect:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.VI70sW_permissionSelect:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}.VI70sW_permissionSelect:disabled{cursor:default;opacity:.6}.VI70sW_reasoningModeControl{height:30px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:var(--dsw-font-xxs-strong-12);border-radius:8px;flex:none;align-items:center;padding:0 8px;display:inline-flex;position:relative}.VI70sW_reasoningModeControl:hover{background:var(--dsw-alias-interactive-bg-hover)}.VI70sW_reasoningModeControl:focus-within{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}.VI70sW_reasoningModeControl select{opacity:0;cursor:pointer;border:0;width:100%;height:100%;position:absolute;inset:0}.VI70sW_reasoningModeControlDisabled{cursor:default;opacity:.6}.VI70sW_reasoningModeControlDisabled select{cursor:default}.VI70sW_composerActions{align-items:center;gap:8px;display:flex}.VI70sW_composerIconButton{background:var(--dsw-alias-button-info-fill);width:36px;height:36px;color:var(--dsw-alias-label-primary-foreground);cursor:pointer;border:0;border-radius:999px;flex:none;place-items:center;transition:background-color .1s,opacity .1s,transform .1s;display:grid}.VI70sW_composerIconButton:hover:not(:disabled){background:var(--dsw-alias-button-info-hover);transform:translateY(-1px)}.VI70sW_composerIconButton:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.VI70sW_composerIconButton:disabled{cursor:default;opacity:.4}.VI70sW_composerAttachButton{width:30px;height:30px;color:var(--dsw-alias-label-secondary);background:0 0}.VI70sW_composerAttachButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);transform:none}.VI70sW_hiddenFileInput{display:none}.VI70sW_skillsInfo{flex:none;position:relative}.VI70sW_skillsInfoButton{width:30px;height:30px;color:var(--dsw-alias-label-secondary);cursor:help;background:0 0;border:0;border-radius:8px;outline:0;place-items:center;padding:0;display:grid}.VI70sW_skillsInfoButton:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.VI70sW_skillsInfoButton:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}.VI70sW_skillsInfoPopover{z-index:6;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:250px;box-shadow:var(--dsw-alias-shadow-l2,var(--dsw-alias-shadow-l1));color:var(--dsw-alias-label-secondary);opacity:0;pointer-events:none;border-radius:9px;flex-direction:column;gap:10px;padding:14px 16px;transition:opacity .1s,transform .1s;display:flex;position:absolute;bottom:calc(100% + 10px);right:0;transform:translateY(4px)}.VI70sW_skillsInfoPopover:after{content:\"\";border-right:1px solid var(--dsw-alias-border-l2);border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:10px;height:10px;position:absolute;bottom:-6px;right:10px;transform:rotate(45deg)}.VI70sW_skillsInfo:hover .VI70sW_skillsInfoPopover,.VI70sW_skillsInfo:focus-within .VI70sW_skillsInfoPopover{opacity:1;transform:translateY(0)}.VI70sW_skillsInfoHeading{justify-content:space-between;align-items:center;gap:12px;display:flex}.VI70sW_skillsInfoHeading strong{color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-strong-14)}.VI70sW_skillsInfoHeading span,.VI70sW_skillsInfoEmpty{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12)}.VI70sW_skillsInfoList{flex-direction:column;gap:6px;max-height:210px;margin:0;padding:0;list-style:none;display:flex;overflow-y:auto}.VI70sW_skillsInfoList li{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);overflow-wrap:anywhere;border-radius:7px;padding:6px 8px}.VI70sW_composerError{color:var(--dsw-alias-state-error-primary);margin-top:5px;font-size:10px;display:block}@media (prefers-reduced-motion:reduce){.VI70sW_conversationColumnExpanded{animation:none}}";
		const tagId$1 = "@limuyang2/dsh-agent-team/ConversationColumn.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@limuyang2/dsh-agent-team";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var ConversationColumn_module_css_default = {
			"columnExpandClose": "VI70sW_columnExpandClose",
			"questionOption": "VI70sW_questionOption",
			"questionFieldset": "VI70sW_questionFieldset",
			"memberAvatar": "VI70sW_memberAvatar",
			"teamMessageType": "VI70sW_teamMessageType",
			"contextUsageButton": "VI70sW_contextUsageButton",
			"composerUtilities": "VI70sW_composerUtilities",
			"composerTriggerOptions": "VI70sW_composerTriggerOptions",
			"contextUsageWarning": "VI70sW_contextUsageWarning",
			"columnEmpty": "VI70sW_columnEmpty",
			"assistantMessage": "VI70sW_assistantMessage",
			"toolSection": "VI70sW_toolSection",
			"columnHeader": "VI70sW_columnHeader",
			"composerIconButton": "VI70sW_composerIconButton",
			"reasoningModeControlDisabled": "VI70sW_reasoningModeControlDisabled",
			"interactionHeader": "VI70sW_interactionHeader",
			"composerTriggerEmpty": "VI70sW_composerTriggerEmpty",
			"reasoningModeBadge": "VI70sW_reasoningModeBadge",
			"teamMessageSystem": "VI70sW_teamMessageSystem",
			"toolError": "VI70sW_toolError",
			"interactionDescription": "VI70sW_interactionDescription",
			"columnModelName": "VI70sW_columnModelName",
			"toolCardError": "VI70sW_toolCardError",
			"leaderCrown": "VI70sW_leaderCrown",
			"permissionSelect": "VI70sW_permissionSelect",
			"skillsInfoPopover": "VI70sW_skillsInfoPopover",
			"userMessage": "VI70sW_userMessage",
			"composer": "VI70sW_composer",
			"composerError": "VI70sW_composerError",
			"noticeNode": "VI70sW_noticeNode",
			"questionDetail": "VI70sW_questionDetail",
			"contextUsageRingValue": "VI70sW_contextUsageRingValue",
			"contextUsagePopover": "VI70sW_contextUsagePopover",
			"composerTriggerMenu": "VI70sW_composerTriggerMenu",
			"contextUsageCritical": "VI70sW_contextUsageCritical",
			"teamMessageIdentity": "VI70sW_teamMessageIdentity",
			"emptyAvatar": "VI70sW_emptyAvatar",
			"skillsInfoEmpty": "VI70sW_skillsInfoEmpty",
			"messageNode": "VI70sW_messageNode",
			"questionCustomInput": "VI70sW_questionCustomInput",
			"skillsInfoList": "VI70sW_skillsInfoList",
			"conversationDialogEnter": "VI70sW_conversationDialogEnter",
			"teamMessageHeader": "VI70sW_teamMessageHeader",
			"interactionError": "VI70sW_interactionError",
			"teamMessageQuestion": "VI70sW_teamMessageQuestion",
			"interactionPrimaryButton": "VI70sW_interactionPrimaryButton",
			"composerTriggerHeading": "VI70sW_composerTriggerHeading",
			"reasoningTime": "VI70sW_reasoningTime",
			"composerActions": "VI70sW_composerActions",
			"columnHeaderActions": "VI70sW_columnHeaderActions",
			"skillsInfo": "VI70sW_skillsInfo",
			"timeline": "VI70sW_timeline",
			"toolIcon": "VI70sW_toolIcon",
			"messageText": "VI70sW_messageText",
			"questionList": "VI70sW_questionList",
			"hiddenFileInput": "VI70sW_hiddenFileInput",
			"questionCard": "VI70sW_questionCard",
			"reasoningModeControl": "VI70sW_reasoningModeControl",
			"teamMessageWarning": "VI70sW_teamMessageWarning",
			"reasoningSeparator": "VI70sW_reasoningSeparator",
			"interactionSecondaryButton": "VI70sW_interactionSecondaryButton",
			"columnStatus": "VI70sW_columnStatus",
			"teamMessageResult": "VI70sW_teamMessageResult",
			"teamMessageProgress": "VI70sW_teamMessageProgress",
			"conversationColumnExpanded": "VI70sW_conversationColumnExpanded",
			"streamingMark": "VI70sW_streamingMark",
			"skillsInfoHeading": "VI70sW_skillsInfoHeading",
			"columnIdentity": "VI70sW_columnIdentity",
			"teamMessageText": "VI70sW_teamMessageText",
			"contextUsageRingTrack": "VI70sW_contextUsageRingTrack",
			"teamMessageMemberId": "VI70sW_teamMessageMemberId",
			"approvalCard": "VI70sW_approvalCard",
			"reasoningIcon": "VI70sW_reasoningIcon",
			"interactionActions": "VI70sW_interactionActions",
			"composerFooter": "VI70sW_composerFooter",
			"skillsInfoButton": "VI70sW_skillsInfoButton",
			"conversationColumn": "VI70sW_conversationColumn",
			"interactionCard": "VI70sW_interactionCard",
			"noticeError": "VI70sW_noticeError",
			"composerTriggerOption": "VI70sW_composerTriggerOption",
			"toolCard": "VI70sW_toolCard",
			"teamMessageInstruction": "VI70sW_teamMessageInstruction",
			"approvalToolName": "VI70sW_approvalToolName",
			"questionOptions": "VI70sW_questionOptions",
			"columnModelMeta": "VI70sW_columnModelMeta",
			"contextUsage": "VI70sW_contextUsage",
			"composerTriggerOptionActive": "VI70sW_composerTriggerOptionActive",
			"teamMessageCard": "VI70sW_teamMessageCard",
			"contextUsageRing": "VI70sW_contextUsageRing",
			"reasoningBlock": "VI70sW_reasoningBlock",
			"composerAttachButton": "VI70sW_composerAttachButton"
		};
		//#endregion
		//#region src/client/conversation-nodes.ts
		function mergeConversationNodes(committed, pending) {
			const committedIds = new Set(committed.map((node) => node.id));
			return [...committed, ...pending.filter((node) => !committedIds.has(node.id))];
		}
		//#endregion
		//#region src/client/file-mentions.ts
		function workspaceFileMention(path) {
			return /\s/.test(path) ? `@"${path.replaceAll("\"", "\\\"")}"` : `@${path}`;
		}
		function insertWorkspaceFileMention(value, selectionStart, selectionEnd, path) {
			const start = Math.max(0, Math.min(selectionStart, value.length));
			const end = Math.max(start, Math.min(selectionEnd, value.length));
			const mention = workspaceFileMention(path);
			const prefix = start > 0 && !/\s/.test(value[start - 1] ?? "") ? " " : "";
			const inserted = `${prefix}${mention}${end < value.length && !/\s/.test(value[end] ?? "") ? " " : ""}`;
			return {
				value: `${value.slice(0, start)}${inserted}${value.slice(end)}`,
				cursor: start + prefix.length + mention.length
			};
		}
		//#endregion
		//#region src/client/icons/CrownIcon.tsx
		function CrownIcon({ size = 16, className, title }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: "0 0 1024 1024",
				width: size,
				height: size,
				className,
				role: title === void 0 ? void 0 : "img",
				"aria-hidden": title === void 0 ? true : void 0,
				"aria-label": title,
				focusable: "false",
				xmlns: "http://www.w3.org/2000/svg",
				children: [
					title !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("title", { children: title }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M793.18 762H231.64a45.5 45.5 0 0 1-45.17-40l-37.12-307.4c-4.36-36 33.18-62.42 65.62-46.11L492 507.76a45.5 45.5 0 0 0 40.89 0l277-139.27c32.44-16.31 70 10.07 65.62 46.11L838.36 722a45.51 45.51 0 0 1-45.18 40z",
						fill: "#FCBA26"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M470.28 244.88L312.57 518.05c-18.73 32.43 4.68 73 42.13 73h315.43c37.45 0 60.85-40.54 42.13-73L554.54 244.88c-18.72-32.43-65.54-32.43-84.26 0z",
						fill: "#FFDE09"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M492 507.76l-134.47-67.59-47.47 82.22c-17.61 30.5 4.41 68.63 39.63 68.63h325.45c35.22 0 57.23-38.13 39.62-68.63l-47.47-82.22-134.43 67.59a45.5 45.5 0 0 1-40.86 0z",
						fill: "#FB8B06"
					})
				]
			});
		}
		//#endregion
		//#region src/client/icons/DeepThinkIcon.tsx
		function DeepThinkIcon({ size = 14, className }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: "0 0 1024 1024",
				width: size,
				height: size,
				className,
				"aria-hidden": "true",
				focusable: "false",
				xmlns: "http://www.w3.org/2000/svg",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M433.493333 548.693333c19.626667 41.386667 68.693333 60.16 110.506667 41.813334a85.12 85.12 0 0 0 44.8-115.2 85.034667 85.034667 0 0 0-117.333333-38.826667c-40.96 20.906667-57.6 70.826667-37.973334 112.213333z",
					fill: "currentColor"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M831.573333 511.146667c75.946667-136.533333 83.626667-274.773333 18.773334-339.626667-64.853333-64.426667-203.946667-56.746667-340.48 19.2-136.106667-74.666667-273.92-81.92-338.346667-17.493333-64.426667 64.426667-57.173333 201.813333 17.92 337.92-75.093333 135.68-82.346667 273.493333-17.92 337.493333 20.053333 20.053333 47.36 34.133333 78.933333 40.96 70.826667 14.933333 162.56-5.546667 258.986667-58.453333 97.28 53.76 190.293333 75.093333 261.546667 60.16 31.146667-6.826667 58.88-20.906667 78.933333-40.96 20.053333-20.053333 34.56-47.36 40.96-78.506667 15.36-71.253333-5.973333-163.84-59.733333-260.693333h0.426666zM232.533333 233.813333c26.026667-26.026667 73.813333-28.586667 142.506667-8.106666 17.066667 5.12 34.133333 11.52 51.2 18.773333-34.133333 25.173333-66.56 53.333333-97.28 84.053333-31.573333 31.146667-60.16 64.426667-85.76 98.986667-7.253333-17.066667-13.653333-34.133333-18.773333-51.626667-20.906667-68.693333-18.346667-116.48 8.106666-142.506666v0.426666z m142.506667 562.346667c-69.12 20.906667-116.48 17.92-142.506667-8.106667-26.026667-26.026667-28.586667-73.386667-8.106666-142.506666 5.12-17.066667 11.52-34.133333 18.773333-51.2a886.613333 886.613333 0 0 0 182.613333 183.04c-17.066667 7.253333-34.133333 13.653333-51.2 18.773333h0.426667z m14.506667-163.413333c-40.106667-40.106667-73.813333-80.64-100.693334-122.026667 26.88-41.386667 60.586667-81.92 100.693334-122.026667 39.68-39.68 79.786667-72.533333 120.32-99.413333 41.386667 26.88 82.346667 60.586667 122.453333 100.693333 39.68 39.68 72.96 79.786667 99.84 120.32-26.88 40.533333-60.16 80.64-99.84 120.32-40.533333 40.106667-81.066667 73.813333-122.453333 100.693334-40.533333-26.88-80.64-59.733333-120.32-99.413334v0.853334z m399.786666 157.013333c-26.026667 26.026667-73.813333 28.586667-142.506666 8.106667-17.92-5.546667-35.84-11.946667-53.76-19.626667 34.986667-25.6 68.266667-54.186667 99.84-85.76 31.146667-30.72 59.306667-63.573333 84.48-97.706667 7.68 17.493333 14.08 35.413333 19.626666 53.333334 20.906667 68.693333 18.346667 116.48-8.106666 142.506666l0.426666-0.853333z m8.106667-415.146667c-5.546667 17.92-11.946667 35.84-19.626667 53.333334-25.173333-34.133333-53.76-66.986667-84.906666-98.133334-31.573333-31.573333-64.853333-60.16-99.84-85.76 17.92-7.68 35.84-14.506667 53.76-20.053333 69.12-20.906667 116.48-17.92 142.506666 8.106667 26.026667 26.026667 28.586667 73.386667 8.106667 142.506666z",
					fill: "currentColor"
				})]
			});
		}
		//#endregion
		//#region src/client/workbench/PendingInteractionCard.tsx
		function PendingInteractionCard({ interaction, onRespond }) {
			const [answers, setAnswers] = (0, react.useState)(() => interaction.kind === "question" ? Object.fromEntries(interaction.questions.map((question) => [question.id, {
				id: question.id,
				selected: []
			}])) : {});
			const [submitting, setSubmitting] = (0, react.useState)(false);
			const [submitted, setSubmitted] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)();
			async function submitResponse(response) {
				if (submitting || submitted) return;
				setSubmitting(true);
				try {
					await onRespond(response);
					setSubmitted(true);
					setError(void 0);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setSubmitting(false);
				}
			}
			if (interaction.kind === "approval") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: `${ConversationColumn_module_css_default.interactionCard} ${ConversationColumn_module_css_default.approvalCard}`,
				"aria-live": "polite",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: ConversationColumn_module_css_default.interactionHeader,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "需要审批" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: submitted ? "已提交" : "等待操作" })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ConversationColumn_module_css_default.approvalToolName,
						children: interaction.toolName
					}),
					interaction.reason && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ConversationColumn_module_css_default.interactionDescription,
						children: interaction.reason
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ConversationColumn_module_css_default.interactionActions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: ConversationColumn_module_css_default.interactionSecondaryButton,
							disabled: submitting || submitted,
							onClick: () => {
								submitResponse({
									kind: "approval",
									outcome: "rejected"
								});
							},
							children: "拒绝"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: ConversationColumn_module_css_default.interactionPrimaryButton,
							disabled: submitting || submitted,
							onClick: () => {
								submitResponse({
									kind: "approval",
									outcome: "allowed-once"
								});
							},
							children: submitting ? "提交中…" : submitted ? "已允许" : "允许本次"
						})]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ConversationColumn_module_css_default.interactionError,
						children: error
					})
				]
			});
			const complete = interaction.questions.every((question) => {
				const answer = answers[question.id];
				return answer !== void 0 && (answer.selected.length > 0 || Boolean(answer.custom?.trim()));
			});
			function updateAnswer(questionId, update) {
				setAnswers((current) => {
					const answer = current[questionId] ?? {
						id: questionId,
						selected: []
					};
					return {
						...current,
						[questionId]: update(answer)
					};
				});
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
				className: `${ConversationColumn_module_css_default.interactionCard} ${ConversationColumn_module_css_default.questionCard}`,
				"aria-live": "polite",
				onSubmit: (event) => {
					event.preventDefault();
					if (!complete) return;
					submitResponse({
						kind: "question",
						answers: interaction.questions.map((question) => answers[question.id])
					});
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: ConversationColumn_module_css_default.interactionHeader,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: interaction.questions.some((question) => question.intent?.kind === "plan-review") ? "请审阅方案" : "需要你的回答" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [interaction.questions.length, " 个问题"] })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ConversationColumn_module_css_default.questionList,
						children: interaction.questions.map((question, index) => {
							const answer = answers[question.id] ?? {
								id: question.id,
								selected: []
							};
							const inputType = question.multiSelect === true ? "checkbox" : "radio";
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
								className: ConversationColumn_module_css_default.questionFieldset,
								disabled: submitting || submitted,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("legend", { children: [question.header && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: question.header }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: interaction.questions.length > 1 ? `${index + 1}. ${question.question}` : question.question })] }),
									question.detail && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: ConversationColumn_module_css_default.questionDetail,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, { text: question.detail })
									}),
									(question.options?.length ?? 0) > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: ConversationColumn_module_css_default.questionOptions,
										children: question.options?.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: ConversationColumn_module_css_default.questionOption,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: inputType,
												name: `${interaction.id}:${question.id}`,
												checked: answer.selected.includes(option.label),
												onChange: (event) => {
													updateAnswer(question.id, (current) => {
														if (question.multiSelect === true) {
															const selected = event.target.checked ? [...current.selected, option.label] : current.selected.filter((label) => label !== option.label);
															return {
																...current,
																selected
															};
														}
														return {
															id: current.id,
															selected: [option.label]
														};
													});
												}
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: option.label }), option.description && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: option.description })] })]
										}, option.label))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										className: ConversationColumn_module_css_default.questionCustomInput,
										value: answer.custom ?? "",
										rows: 2,
										placeholder: (question.options?.length ?? 0) > 0 ? "其他答案（可选）" : "请输入回答",
										onChange: (event) => {
											const custom = event.target.value;
											updateAnswer(question.id, (current) => ({
												id: current.id,
												selected: question.multiSelect === true ? current.selected : [],
												...custom.length === 0 ? {} : { custom }
											}));
										}
									})
								]
							}, question.id);
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ConversationColumn_module_css_default.interactionActions,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "submit",
							className: ConversationColumn_module_css_default.interactionPrimaryButton,
							disabled: !complete || submitting || submitted,
							children: submitting ? "提交中…" : submitted ? "已提交" : "提交回答"
						})
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ConversationColumn_module_css_default.interactionError,
						children: error
					})
				]
			});
		}
		//#endregion
		//#region src/client/workbench/ConversationColumn.tsx
		function ConversationColumn({ team, member, conversation, permissionPresets, onSent, onTeamChanged, expanded, onExpandedChange }) {
			const [content, setContent] = (0, react.useState)("");
			const [sending, setSending] = (0, react.useState)(false);
			const [stopping, setStopping] = (0, react.useState)(false);
			const [changingPermission, setChangingPermission] = (0, react.useState)(false);
			const [changingReasoning, setChangingReasoning] = (0, react.useState)(false);
			const [permissionPresetId, setPermissionPresetId] = (0, react.useState)(member.permissionPresetId);
			const [reasoningEffort, setReasoningEffort] = (0, react.useState)(member.reasoningEffort ?? "");
			const [error, setError] = (0, react.useState)();
			const [pendingMessages, setPendingMessages] = (0, react.useState)([]);
			const [uploadingFiles, setUploadingFiles] = (0, react.useState)(false);
			const [composerTrigger, setComposerTrigger] = (0, react.useState)();
			const [composerCandidates, setComposerCandidates] = (0, react.useState)([]);
			const [composerCandidateIndex, setComposerCandidateIndex] = (0, react.useState)(0);
			const [composerCandidatesLoading, setComposerCandidatesLoading] = (0, react.useState)(false);
			const [composerCandidatesError, setComposerCandidatesError] = (0, react.useState)();
			const textareaRef = (0, react.useRef)(null);
			const composerTriggerOptionsRef = (0, react.useRef)(null);
			const fileInputRef = (0, react.useRef)(null);
			const fileInsertionPoint = (0, react.useRef)({
				start: 0,
				end: 0
			});
			const timelineRef = (0, react.useRef)(null);
			const stickToBottom = (0, react.useRef)(true);
			const composing = (0, react.useRef)(false);
			const sendInFlight = (0, react.useRef)(false);
			const composerCandidateGeneration = (0, react.useRef)(0);
			const canChat = team.state === "active" && (member.role === "leader" || team.directMemberChat);
			const running = conversation?.status === "running";
			const visibleNodes = mergeConversationNodes(conversation?.nodes ?? [], pendingMessages);
			const pendingInteractions = conversation?.pendingInteractions ?? [];
			const statusLabel = pendingInteractions.some((interaction) => interaction.kind === "approval") ? "等待审批" : pendingInteractions.length > 0 ? "等待回答" : memberStatusLabel(conversation?.status ?? member.lastRuntimeState);
			const modelCapabilities = useModelCapabilities(member.assistantSnapshot.provider, member.assistantSnapshot.model);
			const defaultReasoningEffort = modelCapabilities.value?.reasoning?.defaultEffort;
			const reasoningModeLabel = reasoningEffort ? reasoningEffortLabel(modelCapabilities.value, reasoningEffort) : defaultReasoningEffort ? reasoningEffortLabel(modelCapabilities.value, defaultReasoningEffort) : "默认";
			const skillNamesKey = member.assistantSnapshot.skillAllowlist.join("\0");
			const composerMenuId = `agent-team-composer-menu-${member.id}`;
			(0, react.useEffect)(() => {
				setPermissionPresetId(member.permissionPresetId);
			}, [member.permissionPresetId]);
			(0, react.useEffect)(() => {
				setReasoningEffort(member.reasoningEffort ?? "");
			}, [member.reasoningEffort]);
			(0, react.useEffect)(() => {
				const committedIds = new Set(conversation?.nodes.map((node) => node.id) ?? []);
				setPendingMessages((current) => {
					const next = current.filter((node) => !committedIds.has(node.id));
					return next.length === current.length ? current : next;
				});
			}, [conversation?.throughSeq]);
			(0, react.useEffect)(() => {
				if (!stickToBottom.current) return;
				const frame = requestAnimationFrame(() => {
					const timeline = timelineRef.current;
					if (timeline !== null) timeline.scrollTop = timeline.scrollHeight;
				});
				return () => {
					cancelAnimationFrame(frame);
				};
			}, [
				conversation?.throughSeq,
				pendingInteractions.length,
				pendingMessages.length
			]);
			(0, react.useEffect)(() => {
				const generation = ++composerCandidateGeneration.current;
				setComposerCandidateIndex(0);
				setComposerCandidatesError(void 0);
				if (composerTrigger === void 0) {
					setComposerCandidates([]);
					setComposerCandidatesLoading(false);
					return;
				}
				const query = composerTrigger.query.toLocaleLowerCase();
				if (composerTrigger.kind === "skill") {
					setComposerCandidates([]);
					setComposerCandidatesLoading(true);
					const timer = window.setTimeout(() => {
						callAgentTeam("skill.catalog", { agentPresetId: member.assistantSnapshot.agentPresetId }).then((catalog) => {
							if (generation !== composerCandidateGeneration.current) return;
							const selected = new Set(member.assistantSnapshot.skillAllowlist);
							const candidates = matchingUserSkills(catalog.skills, selected, query).map((skill) => ({
								id: `skill:${skill.name}`,
								label: `/${skill.name}`,
								description: skill.description,
								replacement: `/${skill.name}`
							}));
							setComposerCandidates(candidates);
							setComposerCandidatesLoading(false);
						}).catch((cause) => {
							if (generation !== composerCandidateGeneration.current) return;
							setComposerCandidates([]);
							setComposerCandidatesLoading(false);
							setComposerCandidatesError(cause instanceof Error ? cause.message : String(cause));
						});
					}, 100);
					return () => {
						window.clearTimeout(timer);
					};
				}
				setComposerCandidates([]);
				setComposerCandidatesLoading(true);
				const timer = window.setTimeout(() => {
					callAgentTeam("team.workspace.search", {
						teamId: team.id,
						query: composerTrigger.query,
						limit: 40
					}).then((entries) => {
						if (generation !== composerCandidateGeneration.current) return;
						setComposerCandidates(entries.map((entry) => ({
							id: `file:${entry.path}`,
							label: entry.path,
							description: "Workspace 文件",
							replacement: workspaceFileMention(entry.path)
						})));
						setComposerCandidatesLoading(false);
					}).catch((cause) => {
						if (generation !== composerCandidateGeneration.current) return;
						setComposerCandidates([]);
						setComposerCandidatesLoading(false);
						setComposerCandidatesError(cause instanceof Error ? cause.message : String(cause));
					});
				}, 140);
				return () => {
					window.clearTimeout(timer);
				};
			}, [
				composerTrigger?.kind,
				composerTrigger?.query,
				skillNamesKey,
				team.id
			]);
			(0, react.useEffect)(() => {
				const container = composerTriggerOptionsRef.current;
				if (container === null || composerCandidates.length === 0) return;
				const active = container.querySelector("[aria-selected=\"true\"]");
				if (active === null) return;
				const viewport = container.getBoundingClientRect();
				const option = active.getBoundingClientRect();
				container.scrollTop = scrollTopForActiveOption({
					viewportTop: viewport.top,
					viewportBottom: viewport.bottom,
					optionTop: option.top,
					optionBottom: option.bottom,
					scrollTop: container.scrollTop
				});
			}, [composerCandidateIndex, composerCandidates.length]);
			function updateComposerTrigger(value, cursor) {
				setComposerTrigger(composerTriggerAt(value, cursor ?? value.length));
			}
			function acceptComposerCandidate(candidate) {
				if (composerTrigger === void 0) return;
				const next = replaceComposerTrigger(content, composerTrigger, candidate.replacement);
				setContent(next.value);
				setComposerTrigger(void 0);
				requestAnimationFrame(() => {
					textareaRef.current?.focus();
					textareaRef.current?.setSelectionRange(next.cursor, next.cursor);
				});
			}
			async function send(event) {
				event.preventDefault();
				const message = content.trim();
				if (!message || sendInFlight.current) return;
				const pendingId = `pending:${crypto.randomUUID()}`;
				const pending = {
					id: pendingId,
					kind: "user",
					seq: Number.MAX_SAFE_INTEGER,
					time: Date.now(),
					text: message
				};
				sendInFlight.current = true;
				setSending(true);
				setContent("");
				setComposerTrigger(void 0);
				setPendingMessages((current) => [...current, pending]);
				stickToBottom.current = true;
				try {
					const delivered = await callAgentTeam("team.message.send", {
						teamId: team.id,
						targetSlotId: member.id,
						content: message
					});
					setPendingMessages((current) => current.map((node) => node.id === pendingId ? {
						...node,
						id: delivered.id
					} : node));
					setError(void 0);
					await onSent();
				} catch (cause) {
					setPendingMessages((current) => current.filter((node) => node.id !== pendingId));
					setContent((current) => current.length === 0 ? message : current);
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					sendInFlight.current = false;
					setSending(false);
				}
			}
			async function stop() {
				if (stopping) return;
				setStopping(true);
				try {
					await callAgentTeam("team.member.stop", {
						teamId: team.id,
						slotId: member.id
					});
					setError(void 0);
					await onSent();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setStopping(false);
				}
			}
			async function changePermission(nextPermissionPresetId) {
				if (changingPermission || nextPermissionPresetId === permissionPresetId) return;
				const previous = permissionPresetId;
				setPermissionPresetId(nextPermissionPresetId);
				setChangingPermission(true);
				try {
					await callAgentTeam("team.member.setPermissionPreset", {
						teamId: team.id,
						slotId: member.id,
						permissionPresetId: nextPermissionPresetId
					});
					setError(void 0);
					await onTeamChanged();
				} catch (cause) {
					setPermissionPresetId(previous);
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setChangingPermission(false);
				}
			}
			async function changeReasoning(nextReasoningEffort) {
				if (changingReasoning || nextReasoningEffort === reasoningEffort) return;
				const previous = reasoningEffort;
				setReasoningEffort(nextReasoningEffort);
				setChangingReasoning(true);
				try {
					await callAgentTeam("team.member.setReasoningEffort", {
						teamId: team.id,
						slotId: member.id,
						...nextReasoningEffort ? { reasoningEffort: nextReasoningEffort } : {}
					});
					setError(void 0);
					await onTeamChanged();
				} catch (cause) {
					setReasoningEffort(previous);
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setChangingReasoning(false);
				}
			}
			async function uploadFiles(files) {
				const selected = Array.from(files ?? []);
				if (selected.length === 0 || uploadingFiles) return;
				setUploadingFiles(true);
				try {
					const uploads = [];
					for (const file of selected) uploads.push(await uploadAgentTeamFile(team.id, file));
					let nextCursor = fileInsertionPoint.current.start;
					setContent((current) => {
						let nextValue = current;
						let selectionStart = Math.min(fileInsertionPoint.current.start, current.length);
						let selectionEnd = Math.min(fileInsertionPoint.current.end, current.length);
						for (const upload of uploads) {
							const inserted = insertWorkspaceFileMention(nextValue, selectionStart, selectionEnd, upload.path);
							nextValue = inserted.value;
							nextCursor = inserted.cursor;
							selectionStart = inserted.cursor;
							selectionEnd = inserted.cursor;
						}
						return nextValue;
					});
					setError(void 0);
					requestAnimationFrame(() => {
						textareaRef.current?.focus();
						textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
					});
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					if (fileInputRef.current !== null) fileInputRef.current.value = "";
					setUploadingFiles(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: `${ConversationColumn_module_css_default.conversationColumn} ${expanded ? ConversationColumn_module_css_default.conversationColumnExpanded : ""}`,
				"aria-label": `${member.displayName} 对话`,
				role: expanded ? "dialog" : void 0,
				"aria-modal": expanded || void 0,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: ConversationColumn_module_css_default.columnHeader,
						title: expanded ? void 0 : "双击放大对话",
						onDoubleClick: () => {
							if (!expanded) onExpandedChange(true);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ConversationColumn_module_css_default.columnIdentity,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ConversationColumn_module_css_default.memberAvatar,
								children: member.displayName.slice(0, 1).toUpperCase()
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
								member.displayName,
								" ",
								member.role === "leader" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CrownIcon, {
									size: 15,
									className: ConversationColumn_module_css_default.leaderCrown,
									title: "Leader"
								})
							] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ConversationColumn_module_css_default.columnModelMeta,
								title: `${member.assistantSnapshot.provider} / ${member.assistantSnapshot.model} · 思考模式：${reasoningModeLabel}`,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: ConversationColumn_module_css_default.columnModelName,
									children: [
										member.assistantSnapshot.provider,
										" / ",
										member.assistantSnapshot.model
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ConversationColumn_module_css_default.reasoningModeBadge,
									children: reasoningModeLabel
								})]
							})] })]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ConversationColumn_module_css_default.columnHeaderActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ConversationColumn_module_css_default.columnStatus,
								children: statusLabel
							}), expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: "关闭放大对话",
								side: "bottom",
								delayMs: 400,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: ConversationColumn_module_css_default.columnExpandClose,
									"aria-label": "关闭放大对话",
									onDoubleClick: (event) => {
										event.stopPropagation();
									},
									onClick: () => {
										onExpandedChange(false);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, { size: 16 })
								})
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ConversationColumn_module_css_default.timeline,
						ref: timelineRef,
						onScroll: (event) => {
							const timeline = event.currentTarget;
							stickToBottom.current = timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight < 80;
						},
						children: visibleNodes.length === 0 && pendingInteractions.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ConversationColumn_module_css_default.columnEmpty,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ConversationColumn_module_css_default.emptyAvatar,
									children: member.displayName.slice(0, 1).toUpperCase()
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: member.displayName }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: member.role === "leader" ? "向 Leader 描述目标，由它组织团队协作。" : "等待 Leader 分配任务，或直接向该成员发送消息。" })
							]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [visibleNodes.map((node) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConversationNodeView, { node }, node.id)), pendingInteractions.map((interaction) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PendingInteractionCard, {
							interaction,
							onRespond: async (response) => {
								await callAgentTeam("team.interaction.respond", {
									teamId: team.id,
									slotId: member.id,
									interactionId: interaction.id,
									response
								});
								await onSent();
							}
						}, interaction.id))] })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
						className: ConversationColumn_module_css_default.composer,
						onSubmit: (event) => {
							send(event);
						},
						children: [
							composerTrigger !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								id: composerMenuId,
								className: ConversationColumn_module_css_default.composerTriggerMenu,
								role: "listbox",
								"aria-label": composerTrigger.kind === "skill" ? "Skill 候选" : "Workspace 文件候选",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ConversationColumn_module_css_default.composerTriggerHeading,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: composerTrigger.kind === "skill" ? "Skills" : "Workspace 文件" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "↑↓ 选择 · Enter 插入 · Esc 关闭" })]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									ref: composerTriggerOptionsRef,
									className: ConversationColumn_module_css_default.composerTriggerOptions,
									children: [
										composerCandidates.map((candidate, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											id: `${composerMenuId}-${index}`,
											type: "button",
											role: "option",
											"aria-selected": index === composerCandidateIndex,
											className: `${ConversationColumn_module_css_default.composerTriggerOption} ${index === composerCandidateIndex ? ConversationColumn_module_css_default.composerTriggerOptionActive : ""}`,
											onMouseDown: (event) => {
												event.preventDefault();
											},
											onMouseEnter: () => {
												setComposerCandidateIndex(index);
											},
											onClick: () => {
												acceptComposerCandidate(candidate);
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: candidate.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: candidate.description })]
										}, candidate.id)),
										composerCandidatesLoading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: ConversationColumn_module_css_default.composerTriggerEmpty,
											children: "正在搜索…"
										}),
										!composerCandidatesLoading && composerCandidatesError !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: ConversationColumn_module_css_default.composerTriggerEmpty,
											children: composerCandidatesError
										}),
										!composerCandidatesLoading && composerCandidatesError === void 0 && composerCandidates.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: ConversationColumn_module_css_default.composerTriggerEmpty,
											children: composerTrigger.kind === "skill" ? "当前成员没有匹配的已加载 Skill" : "没有匹配的 Workspace 文件"
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								ref: textareaRef,
								value: content,
								onChange: (event) => {
									setContent(event.currentTarget.value);
									updateComposerTrigger(event.currentTarget.value, event.currentTarget.selectionStart);
								},
								onClick: (event) => {
									updateComposerTrigger(event.currentTarget.value, event.currentTarget.selectionStart);
								},
								onBlur: () => {
									window.setTimeout(() => {
										setComposerTrigger(void 0);
									}, 100);
								},
								onCompositionStart: () => {
									composing.current = true;
								},
								onCompositionEnd: () => {
									composing.current = false;
								},
								onKeyDown: (event) => {
									if (composerTrigger !== void 0) {
										if (event.key === "ArrowDown" && composerCandidates.length > 0) {
											event.preventDefault();
											setComposerCandidateIndex((current) => (current + 1) % composerCandidates.length);
											return;
										}
										if (event.key === "ArrowUp" && composerCandidates.length > 0) {
											event.preventDefault();
											setComposerCandidateIndex((current) => (current - 1 + composerCandidates.length) % composerCandidates.length);
											return;
										}
										if ((event.key === "Enter" || event.key === "Tab") && composerCandidates.length > 0) {
											event.preventDefault();
											acceptComposerCandidate(composerCandidates[composerCandidateIndex]);
											return;
										}
										if (event.key === "Escape") {
											event.preventDefault();
											setComposerTrigger(void 0);
											return;
										}
									}
									if (!shouldSubmitComposer({
										key: event.key,
										shiftKey: event.shiftKey,
										isComposing: event.nativeEvent.isComposing,
										keyCode: event.nativeEvent.keyCode
									}, composing.current)) return;
									event.preventDefault();
									event.currentTarget.form?.requestSubmit();
								},
								disabled: !canChat || uploadingFiles,
								placeholder: !canChat ? "当前不可直接对话" : `发送消息到 ${member.displayName}…`,
								"aria-controls": composerTrigger === void 0 ? void 0 : composerMenuId,
								"aria-expanded": composerTrigger !== void 0,
								"aria-activedescendant": composerTrigger !== void 0 && composerCandidates.length > 0 ? `${composerMenuId}-${composerCandidateIndex}` : void 0,
								rows: 2
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ConversationColumn_module_css_default.composerFooter,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ConversationColumn_module_css_default.composerUtilities,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: `${ConversationColumn_module_css_default.composerIconButton} ${ConversationColumn_module_css_default.composerAttachButton}`,
											disabled: !canChat || uploadingFiles,
											"aria-label": uploadingFiles ? "正在上传文件" : "选择文件",
											onClick: () => {
												const textarea = textareaRef.current;
												fileInsertionPoint.current = {
													start: textarea?.selectionStart ?? content.length,
													end: textarea?.selectionEnd ?? content.length
												};
												fileInputRef.current?.click();
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPaperclipOutline16, { size: 16 })
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											ref: fileInputRef,
											type: "file",
											className: ConversationColumn_module_css_default.hiddenFileInput,
											multiple: true,
											tabIndex: -1,
											onChange: (event) => {
												uploadFiles(event.currentTarget.files);
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
											className: ConversationColumn_module_css_default.permissionSelect,
											"aria-label": `${member.displayName} 权限`,
											value: permissionPresetId,
											disabled: changingPermission || permissionPresets.length === 0,
											onChange: (event) => {
												changePermission(event.target.value);
											},
											children: permissionPresets.map((permission) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
												value: permission.value,
												children: ["权限 · ", PERMISSION_LABELS[permission.value] ?? permission.name]
											}, permission.value))
										}),
										modelCapabilities.value?.reasoning !== void 0 && modelCapabilities.value.reasoning.efforts.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: `${ConversationColumn_module_css_default.reasoningModeControl} ${changingReasoning ? ConversationColumn_module_css_default.reasoningModeControlDisabled : ""}`,
											title: `思考模式：${reasoningModeLabel}；切换后下一轮生效`,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "思考模式" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
												"aria-label": `${member.displayName} 思考模式；当前为 ${reasoningModeLabel}；切换后下一轮生效`,
												value: reasoningEffort,
												disabled: changingReasoning,
												onChange: (event) => {
													changeReasoning(event.target.value);
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "",
													children: defaultReasoningLabel(modelCapabilities.value)
												}), modelCapabilities.value.reasoning.efforts.map((effort) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: effort.id,
													children: reasoningEffortLabel(modelCapabilities.value, effort.id)
												}, effort.id))]
											})]
										})
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ConversationColumn_module_css_default.composerActions,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssistantSkillsInfo, { skills: member.assistantSnapshot.skillAllowlist }),
										conversation?.contextUsage !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextUsageMeter, { usage: conversation.contextUsage }),
										running && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											label: stopping ? "停止中…" : "停止生成",
											side: "top",
											delayMs: 400,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: ConversationColumn_module_css_default.composerIconButton,
												disabled: stopping,
												"aria-label": stopping ? "停止中" : "停止生成",
												onClick: () => {
													stop();
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconStopFill16, { size: 16 })
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											label: sending ? "发送中…" : "发送消息",
											side: "top",
											delayMs: 400,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "submit",
												className: ConversationColumn_module_css_default.composerIconButton,
												disabled: !canChat || sending || uploadingFiles || !content.trim(),
												"aria-label": sending ? "发送中" : "发送消息",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSendOutline16, { size: 16 })
											})
										})
									]
								})]
							}),
							error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ConversationColumn_module_css_default.composerError,
								children: error
							})
						]
					})
				]
			});
		}
		function AssistantSkillsInfo({ skills }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ConversationColumn_module_css_default.skillsInfo,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: ConversationColumn_module_css_default.skillsInfoButton,
					"aria-label": skills.length === 0 ? "当前助手未加载 Skills" : `查看当前助手加载的 ${skills.length} 个 Skills`,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(InfoIcon, { size: 16 })
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ConversationColumn_module_css_default.skillsInfoPopover,
					role: "tooltip",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ConversationColumn_module_css_default.skillsInfoHeading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "已加载 Skills" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [skills.length, " 个"] })]
					}), skills.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ConversationColumn_module_css_default.skillsInfoEmpty,
						children: "当前助手未加载 Skill"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: ConversationColumn_module_css_default.skillsInfoList,
						children: skills.map((skill) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: skill }, skill))
					})]
				})]
			});
		}
		function InfoIcon({ size }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "8",
						cy: "8",
						r: "6.25",
						stroke: "currentColor",
						strokeWidth: "1.5"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "8",
						cy: "5",
						r: "1",
						fill: "currentColor"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M8 7.5V11",
						stroke: "currentColor",
						strokeWidth: "1.5",
						strokeLinecap: "round"
					})
				]
			});
		}
		function ContextUsageMeter({ usage }) {
			const percent = usage.contextWindow === void 0 ? void 0 : Math.min(100, Math.round(usage.usedTokens / usage.contextWindow * 100));
			const pressureClass = percent !== void 0 && percent >= 90 ? ConversationColumn_module_css_default.contextUsageCritical : percent !== void 0 && percent >= 75 ? ConversationColumn_module_css_default.contextUsageWarning : "";
			const cacheHitPercent = usage.inputTokens === 0 ? 0 : Math.round(usage.cacheReadTokens / usage.inputTokens * 100);
			const details = [
				`输入 ${formatTokenCount(usage.inputTokens)}`,
				`输出 ${formatTokenCount(usage.outputTokens)}`,
				`缓存命中 ${cacheHitPercent}%`,
				...usage.cacheWriteTokens > 0 ? [`缓存写 ${formatTokenCount(usage.cacheWriteTokens)}`] : [],
				...usage.reasoningTokens > 0 ? [`思考 ${formatTokenCount(usage.reasoningTokens)}`] : []
			];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `${ConversationColumn_module_css_default.contextUsage} ${pressureClass}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: ConversationColumn_module_css_default.contextUsageButton,
					"aria-label": percent === void 0 ? `已使用约 ${usage.usedTokens} tokens，上下文窗口大小未知` : `上下文已使用约 ${usage.usedTokens} / ${usage.contextWindow} tokens，${percent}%`,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
						className: ConversationColumn_module_css_default.contextUsageRing,
						viewBox: "0 0 36 36",
						"aria-hidden": "true",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
							className: ConversationColumn_module_css_default.contextUsageRingTrack,
							cx: "18",
							cy: "18",
							r: "14"
						}), percent !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
							className: ConversationColumn_module_css_default.contextUsageRingValue,
							cx: "18",
							cy: "18",
							r: "14",
							pathLength: "100",
							strokeDasharray: `${percent} 100`
						})]
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ConversationColumn_module_css_default.contextUsagePopover,
					role: "tooltip",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
							"已使用 ",
							formatTokenCount(usage.usedTokens),
							" tokens"
						] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: usage.contextWindow === void 0 ? "上下文窗口大小未知" : `上下文窗口 ${formatTokenCount(usage.contextWindow)} · 已用 ${percent}%` }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: details.join(" · ") })
					]
				})]
			});
		}
		function ConversationNodeView({ node }) {
			if (node.kind === "tool") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolCard, { node });
			if (node.kind === "notice") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: `${ConversationColumn_module_css_default.noticeNode} ${node.tone === "error" ? ConversationColumn_module_css_default.noticeError : ""}`,
				children: node.text
			});
			if (node.kind === "team-message") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TeamMessageCard, { node });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: `${ConversationColumn_module_css_default.messageNode} ${node.kind === "user" ? ConversationColumn_module_css_default.userMessage : ConversationColumn_module_css_default.assistantMessage}`,
				children: [
					node.reasoning && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ReasoningBlock, { node }),
					node.text && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ConversationColumn_module_css_default.messageText,
						children: node.kind === "assistant" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
							text: node.text,
							streaming: node.streaming === true
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MessageText, { text: node.text })
					}),
					node.streaming && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ConversationColumn_module_css_default.streamingMark,
						children: "生成中…"
					})
				]
			});
		}
		function ReasoningBlock({ node }) {
			const reasoningRunning = node.reasoningStartedAt !== void 0 && node.reasoningCompletedAt === void 0 && node.streaming === true;
			const [now, setNow] = (0, react.useState)(() => Date.now());
			(0, react.useEffect)(() => {
				if (!reasoningRunning) return;
				setNow(Date.now());
				const timer = window.setInterval(() => {
					setNow(Date.now());
				}, 200);
				return () => {
					window.clearInterval(timer);
				};
			}, [reasoningRunning]);
			const elapsed = node.reasoningStartedAt === void 0 ? void 0 : Math.max(0, (node.reasoningCompletedAt ?? now) - node.reasoningStartedAt);
			const timing = elapsed === void 0 ? void 0 : reasoningRunning ? `思考中 · ${formatElapsedTime(elapsed)}` : `用时 ${formatElapsedTime(elapsed)}`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: ConversationColumn_module_css_default.reasoningBlock,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(DeepThinkIcon, {
						size: 14,
						className: ConversationColumn_module_css_default.reasoningIcon
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "Think" }),
					timing !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ConversationColumn_module_css_default.reasoningSeparator,
						"aria-hidden": "true",
						children: "·"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ConversationColumn_module_css_default.reasoningTime,
						children: timing
					})] })
				] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: node.reasoning })]
			});
		}
		function formatElapsedTime(milliseconds) {
			if (milliseconds < 6e4) return `${(milliseconds / 1e3).toFixed(1)} 秒`;
			return `${Math.floor(milliseconds / 6e4)} 分 ${Math.floor(milliseconds % 6e4 / 1e3)} 秒`;
		}
		const TEAM_MESSAGE_TYPE_LABELS = {
			instruction: "指令",
			progress: "进度",
			result: "结果",
			question: "问题",
			warning: "警告",
			system: "系统"
		};
		function TeamMessageCard({ node }) {
			const toneClass = node.messageType === "result" ? ConversationColumn_module_css_default.teamMessageResult : node.messageType === "question" ? ConversationColumn_module_css_default.teamMessageQuestion : node.messageType === "warning" ? ConversationColumn_module_css_default.teamMessageWarning : node.messageType === "instruction" ? ConversationColumn_module_css_default.teamMessageInstruction : node.messageType === "system" ? ConversationColumn_module_css_default.teamMessageSystem : ConversationColumn_module_css_default.teamMessageProgress;
			const category = node.senderRole === "leader" ? "Leader 消息" : node.senderRole === "system" ? "团队事件" : "成员反馈";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: `${ConversationColumn_module_css_default.teamMessageCard} ${toneClass}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
					className: ConversationColumn_module_css_default.teamMessageHeader,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: ConversationColumn_module_css_default.teamMessageIdentity,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: category }),
							node.senderRole !== "system" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: node.senderName }),
							node.senderRole !== "system" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("code", {
								className: ConversationColumn_module_css_default.teamMessageMemberId,
								title: `成员 ID：${node.senderId}`,
								children: ["ID ", shortMemberId(node.senderId)]
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ConversationColumn_module_css_default.teamMessageType,
						children: TEAM_MESSAGE_TYPE_LABELS[node.messageType]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: ConversationColumn_module_css_default.teamMessageText,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MessageText, { text: node.text })
				})]
			});
		}
		function shortMemberId(id) {
			return id.length > 8 ? `${id.slice(0, 8)}…` : id;
		}
		function ToolCard({ node }) {
			const status = node.status === "running" ? "执行中" : node.status === "success" ? "已完成" : "失败";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: `${ConversationColumn_module_css_default.toolCard} ${node.status === "error" ? ConversationColumn_module_css_default.toolCardError : ""}`,
				open: node.status !== "success",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ConversationColumn_module_css_default.toolIcon,
							children: "⌘"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: node.name }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: status })
					] }),
					node.arguments && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ConversationColumn_module_css_default.toolSection,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "参数" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: prettyJson(node.arguments) })]
					}),
					node.result && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ConversationColumn_module_css_default.toolSection,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "结果" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: node.result })]
					}),
					node.error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ConversationColumn_module_css_default.toolError,
						children: node.error
					})
				]
			});
		}
		function formatTokenCount(value) {
			if (value < 1e3) return String(value);
			if (value < 1e6) {
				const scaled = value / 1e3;
				return `${scaled >= 100 ? Math.round(scaled) : scaled.toFixed(1).replace(/\.0$/, "")}k`;
			}
			const scaled = value / 1e6;
			return `${scaled >= 100 ? Math.round(scaled) : scaled.toFixed(1).replace(/\.0$/, "")}m`;
		}
		function prettyJson(value) {
			try {
				return JSON.stringify(JSON.parse(value), null, 2);
			} catch {
				return value;
			}
		}
		//#endregion
		//#region src/client/assistants/AssistantPanel.tsx
		const ASSISTANT_FORM_ID = "agent-team-assistant-form";
		const ASSISTANT_EDIT_FORM_ID = "agent-team-assistant-edit-form";
		function AssistantPanel({ catalog, assistants, onChanged }) {
			const [creating, setCreating] = (0, react.useState)(false);
			const [editingAssistant, setEditingAssistant] = (0, react.useState)();
			const [builderOpen, setBuilderOpen] = (0, react.useState)(false);
			const [assistantSaving, setAssistantSaving] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: AgentTeam_module_css_default.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AgentTeam_module_css_default.sectionHeader,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h2", {
							className: AgentTeam_module_css_default.sectionHeading,
							children: ["助手模板 ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: AgentTeam_module_css_default.count,
								children: assistants.length
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AgentTeam_module_css_default.sectionDescription,
							children: "助手是可复用模板，解散团队不会删除助手。"
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: AgentTeam_module_css_default.sectionHeaderActions,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								onClick: () => {
									setCreating(true);
								},
								children: "手动新建"
							})
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
						className: AgentTeam_module_css_default.assistantBuilderCard,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: AgentTeam_module_css_default.assistantBuilderAvatar,
								"aria-hidden": "true",
								children: "AI"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AgentTeam_module_css_default.assistantBuilderCopy,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: AgentTeam_module_css_default.assistantBuilderEyebrow,
										children: "内置 · 默认"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "团队 Agent 小助手" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "描述你需要的角色，它会询问必要参数、整理长期提示词，并在确认后创建助手。" })
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								onClick: () => {
									setBuilderOpen(true);
								},
								children: "开始对话"
							})
						]
					}),
					assistants.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
						text: "还没有助手模板",
						hint: "创建助手后，就可以把它作为 Leader 或普通成员加入不同团队。"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: AgentTeam_module_css_default.cardGrid,
						children: assistants.map((assistant) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssistantCard, {
							assistant,
							onEdit: () => {
								setEditingAssistant(assistant);
							},
							onChanged
						}, assistant.id))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnimatedModal, {
						open: builderOpen,
						onClose: () => {
							setBuilderOpen(false);
						},
						title: "团队 Agent 小助手",
						closeLabel: "关闭",
						description: "通过对话设计助手，完整配置会在你确认后保存到助手模板库。",
						className: AgentTeam_module_css_default.assistantBuilderDialog ?? "",
						contentClassName: AgentTeam_module_css_default.assistantBuilderDialogContent ?? "",
						children: builderOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssistantBuilderConversation, { catalog })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnimatedModal, {
						open: creating,
						onClose: () => {
							setCreating(false);
						},
						title: "新建助手",
						closeLabel: "关闭",
						description: "配置可复用的模型、权限与长期规则。具体任务在团队启动后发送。",
						className: AgentTeam_module_css_default.assistantDialog ?? "",
						contentClassName: AgentTeam_module_css_default.modalScrollContent ?? "",
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setCreating(false);
							},
							disabled: assistantSaving,
							children: "取消"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							type: "submit",
							form: ASSISTANT_FORM_ID,
							disabled: assistantSaving,
							children: assistantSaving ? "保存中…" : "保存助手"
						})] }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssistantForm, {
							catalog,
							formId: ASSISTANT_FORM_ID,
							saving: assistantSaving,
							setSaving: setAssistantSaving,
							onSaved: async () => {
								setCreating(false);
								await onChanged();
							}
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnimatedModal, {
						open: editingAssistant !== void 0,
						onClose: () => {
							setEditingAssistant(void 0);
						},
						title: "编辑助手",
						closeLabel: "关闭",
						description: "更新助手模板只影响之后启动的团队成员，不修改已有成员快照。",
						className: AgentTeam_module_css_default.assistantDialog ?? "",
						contentClassName: AgentTeam_module_css_default.modalScrollContent ?? "",
						footer: editingAssistant === void 0 ? void 0 : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: () => {
								setEditingAssistant(void 0);
							},
							disabled: assistantSaving,
							children: "取消"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							type: "submit",
							form: ASSISTANT_EDIT_FORM_ID,
							disabled: assistantSaving,
							children: assistantSaving ? "保存中…" : "保存修改"
						})] }),
						children: editingAssistant !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssistantForm, {
							catalog,
							formId: ASSISTANT_EDIT_FORM_ID,
							assistant: editingAssistant,
							saving: assistantSaving,
							setSaving: setAssistantSaving,
							onSaved: async () => {
								setEditingAssistant(void 0);
								await onChanged();
							}
						}, `${editingAssistant.id}:${editingAssistant.revision}`)
					})
				]
			});
		}
		function AssistantBuilderConversation({ catalog }) {
			const [conversation, setConversation] = (0, react.useState)();
			const [draft, setDraft] = (0, react.useState)();
			const [history, setHistory] = (0, react.useState)([]);
			const [content, setContent] = (0, react.useState)("");
			const [loading, setLoading] = (0, react.useState)(true);
			const [sending, setSending] = (0, react.useState)(false);
			const [applyingModel, setApplyingModel] = (0, react.useState)(false);
			const [archivingSessionId, setArchivingSessionId] = (0, react.useState)();
			const [archiveCandidate, setArchiveCandidate] = (0, react.useState)();
			const [archiveError, setArchiveError] = (0, react.useState)();
			const [selectedProvider, setSelectedProvider] = (0, react.useState)("");
			const [selectedModel, setSelectedModel] = (0, react.useState)("");
			const [modelSelectionDirty, setModelSelectionDirty] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)();
			const timeline = (0, react.useRef)(null);
			const drafting = (0, react.useRef)(false);
			const composing = (0, react.useRef)(false);
			const sendInFlight = (0, react.useRef)(false);
			const loadHistory = (0, react.useCallback)(async () => {
				const next = await callAgentTeam("assistant.builder.list");
				setHistory(next.items);
				return next;
			}, []);
			const load = (0, react.useCallback)(async (sessionId) => {
				try {
					if (sessionId !== void 0) {
						const next = await callAgentTeam("assistant.builder.get", { sessionId });
						setConversation(next);
						setDraft(void 0);
						drafting.current = false;
						await loadHistory();
					} else {
						const latest = (await loadHistory()).items[0];
						if (latest !== void 0) {
							const next = await callAgentTeam("assistant.builder.get", { sessionId: latest.sessionId });
							setConversation(next);
							setDraft(void 0);
							drafting.current = false;
						} else {
							const next = await callAgentTeam("assistant.builder.draft.get");
							setConversation(void 0);
							setDraft(next);
							drafting.current = true;
						}
					}
					setModelSelectionDirty(false);
					setError(void 0);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setLoading(false);
				}
			}, [loadHistory]);
			(0, react.useEffect)(() => {
				load();
				return subscribeAssistantBuilderConversation((next) => {
					if (next !== void 0) setConversation((current) => {
						if (current?.sessionId !== next.sessionId) return current;
						if (current.status === "running" && next.status === "idle") loadHistory();
						return next;
					});
					else if (drafting.current) loadHistory();
					else load();
					setError(void 0);
				}, () => {
					setError("实时连接已断开，正在等待重连");
				}, () => {
					setError(void 0);
					if (drafting.current) loadHistory();
					else load();
				});
			}, [load, loadHistory]);
			(0, react.useEffect)(() => {
				const configuration = conversation?.configuration ?? draft?.configuration;
				if (configuration === void 0 || modelSelectionDirty) return;
				setSelectedProvider(configuration.provider);
				setSelectedModel(configuration.model);
			}, [
				conversation,
				draft,
				modelSelectionDirty
			]);
			(0, react.useEffect)(() => {
				const element = timeline.current;
				if (element === null) return;
				element.scrollTop = element.scrollHeight;
			}, [
				conversation?.throughSeq,
				conversation?.nodes.length,
				conversation?.pendingInteractions.length
			]);
			async function send() {
				const message = content.trim();
				if (message.length === 0 || !selectedProvider || !selectedModel || sendInFlight.current || conversation === void 0 && draft === void 0 || conversation?.status === "running") return;
				sendInFlight.current = true;
				setSending(true);
				try {
					if (conversation === void 0) {
						const next = await callAgentTeam("assistant.builder.start", {
							provider: selectedProvider,
							model: selectedModel,
							content: message
						});
						setConversation(next);
						setDraft(void 0);
						drafting.current = false;
						setModelSelectionDirty(false);
					} else await callAgentTeam("assistant.builder.send", {
						sessionId: conversation.sessionId,
						content: message
					});
					setContent("");
					await loadHistory();
					setError(void 0);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					sendInFlight.current = false;
					setSending(false);
				}
			}
			async function stop() {
				if (conversation === void 0) return;
				try {
					await callAgentTeam("assistant.builder.stop", { sessionId: conversation.sessionId });
					await load(conversation.sessionId);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				}
			}
			async function applyModel() {
				if (!selectedProvider || !selectedModel || applyingModel || conversation === void 0 && draft === void 0 || conversation?.status === "running") return;
				setApplyingModel(true);
				try {
					if (conversation === void 0) {
						const next = await callAgentTeam("assistant.builder.draft.configure", {
							provider: selectedProvider,
							model: selectedModel
						});
						setDraft(next);
					} else {
						const next = await callAgentTeam("assistant.builder.configure", {
							sessionId: conversation.sessionId,
							provider: selectedProvider,
							model: selectedModel
						});
						setConversation(next);
					}
					setModelSelectionDirty(false);
					setError(void 0);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setApplyingModel(false);
				}
			}
			async function createDraft() {
				if (running || loading || draft !== void 0) return;
				setLoading(true);
				try {
					const next = await callAgentTeam("assistant.builder.draft.get");
					setConversation(void 0);
					setDraft(next);
					drafting.current = true;
					setContent("");
					setModelSelectionDirty(false);
					setError(void 0);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setLoading(false);
				}
			}
			async function selectConversation(sessionId) {
				if (running || loading || sessionId === conversation?.sessionId) return;
				setLoading(true);
				setContent("");
				setDraft(void 0);
				drafting.current = false;
				await load(sessionId);
			}
			async function archiveConversation() {
				const item = archiveCandidate;
				if (item === void 0 || loading || archivingSessionId !== void 0) return;
				setArchivingSessionId(item.sessionId);
				setArchiveError(void 0);
				try {
					await callAgentTeam("assistant.builder.archive", { sessionId: item.sessionId });
					setContent("");
					if (item.sessionId === conversation?.sessionId) {
						setConversation(void 0);
						setLoading(true);
						await load();
					} else await loadHistory();
					setArchiveCandidate(void 0);
					setError(void 0);
				} catch (cause) {
					setArchiveError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setArchivingSessionId(void 0);
					setLoading(false);
				}
			}
			const running = conversation?.status === "running";
			const pendingInteractions = conversation?.pendingInteractions ?? [];
			const runtimeLabel = pendingInteractions.some((interaction) => interaction.kind === "approval") ? "等待审批" : pendingInteractions.length > 0 ? "等待回答" : loading ? "正在启动…" : running ? "正在思考" : "可以对话";
			const providers = catalog?.providers ?? [];
			const modelSelection = JSON.stringify([selectedProvider, selectedModel]);
			const appliedConfiguration = conversation?.configuration ?? draft?.configuration;
			const modelChanged = appliedConfiguration !== void 0 && (selectedProvider !== appliedConfiguration.provider || selectedModel !== appliedConfiguration.model);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: AgentTeam_module_css_default.assistantBuilderConversation,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
					className: AgentTeam_module_css_default.assistantBuilderHistory,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: AgentTeam_module_css_default.assistantBuilderNewConversation,
						disabled: loading || running || draft !== void 0,
						onClick: () => {
							createDraft();
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 14 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "新对话" })]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AgentTeam_module_css_default.assistantBuilderHistoryList,
						children: [history.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: AgentTeam_module_css_default.assistantBuilderHistoryRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: `${AgentTeam_module_css_default.assistantBuilderHistoryItem} ${item.sessionId === conversation?.sessionId ? AgentTeam_module_css_default.assistantBuilderHistoryItemActive : ""}`,
								disabled: loading || running || archivingSessionId !== void 0,
								onClick: () => {
									selectConversation(item.sessionId);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: item.title }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", {
									dateTime: item.updatedAt,
									children: formatConversationTime(item.updatedAt)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: assistantBuilderStateLabel(item.state) })] })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: "归档会话",
								side: "right",
								delayMs: 400,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: AgentTeam_module_css_default.assistantBuilderHistoryArchive,
									"aria-label": `归档会话 ${item.title}`,
									disabled: loading || archivingSessionId !== void 0 || running && item.sessionId === conversation?.sessionId,
									onClick: () => {
										setArchiveError(void 0);
										setArchiveCandidate(item);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutline20, { size: 14 })
								})
							})]
						}, item.sessionId)), !loading && history.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: AgentTeam_module_css_default.assistantBuilderHistoryEmpty,
							children: "暂无历史对话"
						})]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AgentTeam_module_css_default.assistantBuilderMain,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: AgentTeam_module_css_default.assistantBuilderRuntime,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: AgentTeam_module_css_default.assistantBuilderRuntimeState,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: `${AgentTeam_module_css_default.statusDot} ${running ? AgentTeam_module_css_default.statusRunning : AgentTeam_module_css_default.statusIdle}`,
									"aria-hidden": "true"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: runtimeLabel })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AgentTeam_module_css_default.assistantBuilderModelControls,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									value: modelSelection,
									onChange: (event) => {
										const [provider, model] = JSON.parse(event.target.value);
										setSelectedProvider(provider);
										setSelectedModel(model);
										setModelSelectionDirty(true);
									},
									className: AgentTeam_module_css_default.assistantBuilderModelSelect,
									"aria-label": "小助手模型目录",
									disabled: loading || running || applyingModel,
									children: providers.map((provider) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("optgroup", {
										label: provider.name,
										children: (catalog?.models[provider.id] ?? []).map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: JSON.stringify([provider.id, model.id]),
											children: model.name === model.id ? model.id : `${model.name}（${model.id}）`
										}, `${provider.id}/${model.id}`))
									}, provider.id))
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									disabled: !modelChanged || !selectedProvider || !selectedModel || loading || running || applyingModel,
									onClick: () => {
										applyModel();
									},
									children: applyingModel ? "切换中…" : "应用模型"
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							ref: timeline,
							className: `${ConversationColumn_module_css_default.timeline} ${AgentTeam_module_css_default.assistantBuilderTimeline}`,
							children: [
								!loading && (draft !== void 0 || conversation?.nodes.length === 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("article", {
									className: `${ConversationColumn_module_css_default.messageNode} ${ConversationColumn_module_css_default.assistantMessage}`,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: ConversationColumn_module_css_default.messageText,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, { text: "你好，我是团队 Agent 小助手。告诉我你想创建什么样的助手，以及它主要负责什么；缺少的配置我会逐项询问你。" })
									})
								}),
								conversation?.nodes.map((node) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConversationNodeView, { node }, node.id)),
								pendingInteractions.map((interaction) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PendingInteractionCard, {
									interaction,
									onRespond: async (response) => {
										if (conversation === void 0) return;
										await callAgentTeam("assistant.builder.interaction.respond", {
											sessionId: conversation.sessionId,
											interactionId: interaction.id,
											response
										});
									}
								}, interaction.id))
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
							className: `${ConversationColumn_module_css_default.composer} ${AgentTeam_module_css_default.assistantBuilderComposer}`,
							onSubmit: (event) => {
								event.preventDefault();
								send();
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									value: content,
									onChange: (event) => {
										setContent(event.target.value);
									},
									onCompositionStart: () => {
										composing.current = true;
									},
									onCompositionEnd: () => {
										composing.current = false;
									},
									onKeyDown: (event) => {
										if (!shouldSubmitComposer({
											key: event.key,
											shiftKey: event.shiftKey,
											isComposing: event.nativeEvent.isComposing,
											keyCode: event.nativeEvent.keyCode
										}, composing.current)) return;
										event.preventDefault();
										send();
									},
									placeholder: running ? "小助手正在回复…" : "例如：我需要一个负责 React 前端开发和代码审查的助手",
									disabled: loading || running,
									rows: 3
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ConversationColumn_module_css_default.composerFooter,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: AgentTeam_module_css_default.muted,
										children: "Enter 发送 · Shift+Enter 换行"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: ConversationColumn_module_css_default.composerActions,
										children: [running && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											label: "停止生成",
											side: "top",
											delayMs: 400,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: ConversationColumn_module_css_default.composerIconButton,
												onClick: () => {
													stop();
												},
												"aria-label": "停止生成",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconStopFill16, { size: 16 })
											})
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											label: sending ? "发送中…" : "发送消息",
											side: "top",
											delayMs: 400,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "submit",
												className: ConversationColumn_module_css_default.composerIconButton,
												disabled: loading || running || sending || !selectedProvider || !selectedModel || content.trim().length === 0,
												"aria-label": sending ? "发送中" : "发送消息",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSendOutline16, { size: 16 })
											})
										})]
									})]
								}),
								error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ConversationColumn_module_css_default.composerError,
									children: error
								})
							]
						})
					]
				})]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnimatedModal, {
				open: archiveCandidate !== void 0,
				onClose: () => {
					if (archivingSessionId === void 0) {
						setArchiveCandidate(void 0);
						setArchiveError(void 0);
					}
				},
				title: "归档会话",
				closeLabel: "关闭",
				description: "归档后，该会话将不再显示在团队 Agent 小助手的历史记录中。",
				className: AgentTeam_module_css_default.assistantBuilderArchiveDialog ?? "",
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					disabled: archivingSessionId !== void 0,
					onClick: () => {
						setArchiveCandidate(void 0);
						setArchiveError(void 0);
					},
					children: "取消"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					disabled: archiveCandidate === void 0 || archivingSessionId !== void 0,
					onClick: () => {
						archiveConversation();
					},
					children: archivingSessionId !== void 0 ? "归档中…" : "确认归档"
				})] }),
				children: archiveCandidate !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AgentTeam_module_css_default.assistantBuilderArchiveConfirm,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: AgentTeam_module_css_default.assistantBuilderArchiveIcon,
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutline20, { size: 20 })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: archiveCandidate.title }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "会话内容不会被删除，底层 Session 日志仍由 Harness 保留。" })] }),
						archiveError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "alert",
							className: AgentTeam_module_css_default.inlineError,
							children: archiveError
						})
					]
				})
			})] });
		}
		function assistantBuilderStateLabel(state) {
			if (state === "completed") return "已创建";
			if (state === "in_progress") return "配置中";
			return "新对话";
		}
		function formatConversationTime(value) {
			return new Intl.DateTimeFormat("zh-CN", {
				month: "numeric",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit"
			}).format(new Date(value));
		}
		function AssistantCard({ assistant, onEdit, onChanged }) {
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)();
			const [deleteOpen, setDeleteOpen] = (0, react.useState)(false);
			async function clone() {
				setBusy(true);
				try {
					await callAgentTeam("assistant.clone", {
						id: assistant.id,
						name: `${assistant.name} Copy`
					});
					await onChanged();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			}
			async function remove() {
				setBusy(true);
				try {
					await callAgentTeam("assistant.delete", { id: assistant.id });
					setDeleteOpen(false);
					setError(void 0);
					await onChanged();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: AgentTeam_module_css_default.card,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AgentTeam_module_css_default.assistantCardContent,
						role: "button",
						tabIndex: busy ? -1 : 0,
						"aria-label": `编辑助手 ${assistant.name}`,
						onClick: () => {
							if (!busy) onEdit();
						},
						onKeyDown: (event) => {
							if (busy || event.key !== "Enter" && event.key !== " ") return;
							event.preventDefault();
							onEdit();
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: assistant.name }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: AgentTeam_module_css_default.muted,
								children: [
									assistant.provider,
									" / ",
									assistant.model
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: AgentTeam_module_css_default.muted,
								children: [
									"Preset: ",
									assistant.agentPresetId,
									" · 权限: ",
									PERMISSION_LABELS[assistant.permissionPresetId] ?? assistant.permissionPresetId,
									" · 思考模式：",
									assistant.reasoningEffort ?? "模型默认"
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: AgentTeam_module_css_default.muted,
								children: ["Skills: ", assistant.skillAllowlist.length > 0 ? assistant.skillAllowlist.join("、") : "未选择"]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: AgentTeam_module_css_default.muted,
								children: ["MCP: ", assistant.mcpServers.length > 0 ? assistant.mcpServers.join("、") : "未选择"]
							}),
							assistant.description && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: AgentTeam_module_css_default.description,
								children: assistant.description
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AgentTeam_module_css_default.actions,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: AgentTeam_module_css_default.secondaryButton,
								disabled: busy,
								onClick: onEdit,
								children: "编辑"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: AgentTeam_module_css_default.secondaryButton,
								disabled: busy,
								onClick: () => {
									clone();
								},
								children: "复制"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: AgentTeam_module_css_default.dangerButton,
								disabled: busy,
								onClick: () => {
									setError(void 0);
									setDeleteOpen(true);
								},
								children: "删除"
							})
						]
					}),
					error && !deleteOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						role: "alert",
						className: AgentTeam_module_css_default.inlineError,
						children: error
					})
				]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnimatedModal, {
				open: deleteOpen,
				onClose: () => {
					if (busy) return;
					setDeleteOpen(false);
					setError(void 0);
				},
				title: "删除助手模板",
				closeLabel: "关闭",
				description: "此操作无法撤销。",
				className: AgentTeam_module_css_default.assistantDeleteDialog ?? "",
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					disabled: busy,
					onClick: () => {
						setDeleteOpen(false);
						setError(void 0);
					},
					children: "取消"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: `${AgentTeam_module_css_default.dangerButton} ${AgentTeam_module_css_default.confirmDangerButton}`,
					disabled: busy,
					onClick: () => {
						remove();
					},
					children: busy ? "删除中…" : "确认删除"
				})] }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AgentTeam_module_css_default.assistantDeleteConfirm,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: AgentTeam_module_css_default.assistantDeleteIcon,
							"aria-hidden": "true",
							children: assistant.name.slice(0, 1).toLocaleUpperCase()
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: assistant.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "删除后不会影响团队或 Workspace。若模板仍被团队成员引用，系统会拒绝删除。" })] }),
						error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "alert",
							className: AgentTeam_module_css_default.inlineError,
							children: error
						})
					]
				})
			})] });
		}
		function AssistantForm({ catalog, formId, assistant, saving, setSaving, onSaved }) {
			const providers = catalog?.providers ?? [];
			const presets = catalog?.agentPresets.filter((preset) => preset.broken === void 0) ?? [];
			const permissions = catalog?.permissionPresets ?? [];
			const [name, setName] = (0, react.useState)(assistant?.name ?? "");
			const [description, setDescription] = (0, react.useState)(assistant?.description ?? "");
			const [instructions, setInstructions] = (0, react.useState)(assistant?.instructions ?? "");
			const [provider, setProvider] = (0, react.useState)(assistant?.provider ?? providers[0]?.id ?? "");
			const models = catalog?.models[provider] ?? [];
			const [modelChoice, setModelChoice] = (0, react.useState)(assistant?.model ?? "");
			const [reasoningEffort, setReasoningEffort] = (0, react.useState)(assistant?.reasoningEffort ?? "");
			const [agentPresetId, setAgentPresetId] = (0, react.useState)(assistant?.agentPresetId ?? presets[0]?.id ?? "");
			const [permissionPresetId, setPermissionPresetId] = (0, react.useState)(assistant?.permissionPresetId ?? permissions[0]?.value ?? "");
			const [availableSkills, setAvailableSkills] = (0, react.useState)([]);
			const [selectedSkills, setSelectedSkills] = (0, react.useState)(assistant?.skillAllowlist ?? []);
			const [skillsLoading, setSkillsLoading] = (0, react.useState)(false);
			const [skillsError, setSkillsError] = (0, react.useState)();
			const [availableMcpServers, setAvailableMcpServers] = (0, react.useState)([]);
			const [selectedMcpServers, setSelectedMcpServers] = (0, react.useState)(assistant?.mcpServers ?? []);
			const [mcpLoading, setMcpLoading] = (0, react.useState)(false);
			const [mcpError, setMcpError] = (0, react.useState)();
			const [error, setError] = (0, react.useState)();
			const modelCapabilities = useModelCapabilities(provider, modelChoice);
			(0, react.useEffect)(() => {
				if (!provider && providers[0]) setProvider(providers[0].id);
				if (!agentPresetId && presets[0]) setAgentPresetId(presets[0].id);
				if (!permissionPresetId && permissions[0]) setPermissionPresetId(permissions[0].value);
			}, [
				agentPresetId,
				permissionPresetId,
				permissions,
				presets,
				provider,
				providers
			]);
			(0, react.useEffect)(() => {
				setModelChoice((current) => {
					if (models.some((candidate) => candidate.id === current)) return current;
					return models[0]?.id ?? "";
				});
			}, [models]);
			(0, react.useEffect)(() => {
				if (modelCapabilities.loading || modelCapabilities.value === void 0) return;
				const efforts = modelCapabilities.value.reasoning?.efforts ?? [];
				setReasoningEffort((current) => current && !efforts.some((effort) => effort.id === current) ? "" : current);
			}, [modelCapabilities.loading, modelCapabilities.value]);
			(0, react.useEffect)(() => {
				let active = true;
				if (!agentPresetId) {
					setAvailableSkills([]);
					setSelectedSkills([]);
					return () => {
						active = false;
					};
				}
				setSkillsLoading(true);
				setSkillsError(void 0);
				callAgentTeam("skill.catalog", { agentPresetId }).then((value) => {
					if (!active) return;
					setAvailableSkills(value.skills);
					const availableNames = new Set(value.skills.map((skill) => skill.name));
					setSelectedSkills((current) => current.filter((name) => availableNames.has(name)));
				}).catch((cause) => {
					if (!active) return;
					setAvailableSkills([]);
					setSelectedSkills([]);
					setSkillsError(cause instanceof Error ? cause.message : String(cause));
				}).finally(() => {
					if (active) setSkillsLoading(false);
				});
				return () => {
					active = false;
				};
			}, [agentPresetId]);
			(0, react.useEffect)(() => {
				let active = true;
				if (!agentPresetId) {
					setAvailableMcpServers([]);
					setSelectedMcpServers([]);
					return () => {
						active = false;
					};
				}
				setMcpLoading(true);
				setMcpError(void 0);
				callAgentTeam("mcp.catalog", { agentPresetId }).then((value) => {
					if (!active) return;
					setAvailableMcpServers(value.servers);
					const availableNames = new Set(value.servers.map((server) => server.name));
					setSelectedMcpServers((current) => current.filter((name) => availableNames.has(name)));
				}).catch((cause) => {
					if (!active) return;
					setAvailableMcpServers([]);
					setSelectedMcpServers([]);
					setMcpError(cause instanceof Error ? cause.message : String(cause));
				}).finally(() => {
					if (active) setMcpLoading(false);
				});
				return () => {
					active = false;
				};
			}, [agentPresetId]);
			const model = modelChoice;
			async function submit(event) {
				event.preventDefault();
				if (saving) return;
				setSaving(true);
				try {
					const value = {
						name,
						...assistant === void 0 && !description.trim() ? {} : { description: description.trim() },
						instructions,
						provider,
						model,
						...reasoningEffort ? { reasoningEffort } : {},
						agentPresetId,
						permissionPresetId,
						skillAllowlist: selectedSkills,
						mcpServers: selectedMcpServers
					};
					if (assistant === void 0) await callAgentTeam("assistant.create", value);
					else await callAgentTeam("assistant.update", {
						id: assistant.id,
						value
					}, assistant.revision);
					await onSaved();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setSaving(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
				id: formId,
				onSubmit: (event) => {
					submit(event);
				},
				className: `${AgentTeam_module_css_default.form} ${AgentTeam_module_css_default.assistantForm}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AgentTeam_module_css_default.formGrid,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: "名称",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								required: true,
								value: name,
								onChange: (event) => {
									setName(event.target.value);
								},
								className: AgentTeam_module_css_default.input
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: "说明",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								value: description,
								onChange: (event) => {
									setDescription(event.target.value);
								},
								className: AgentTeam_module_css_default.input
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: "Provider",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								required: true,
								value: provider,
								onChange: (event) => {
									setProvider(event.target.value);
								},
								className: AgentTeam_module_css_default.input,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "",
									children: "请选择"
								}), providers.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: item.id,
									children: item.name
								}, item.id))]
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: `模型（${models.length} 个可选）`,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								required: true,
								value: modelChoice,
								onChange: (event) => {
									setModelChoice(event.target.value);
								},
								className: AgentTeam_module_css_default.input,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "",
									disabled: true,
									children: "请选择"
								}), models.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: item.id,
									children: item.name === item.id ? item.id : `${item.name}（${item.id}）`
								}, item.id))]
							})
						}),
						modelCapabilities.value?.reasoning !== void 0 && modelCapabilities.value.reasoning.efforts.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Field, {
							label: "思考模式",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								value: reasoningEffort,
								onChange: (event) => {
									setReasoningEffort(event.target.value);
								},
								className: AgentTeam_module_css_default.input,
								"aria-describedby": `${formId}-reasoning-hint`,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "",
									children: defaultReasoningLabel(modelCapabilities.value)
								}), modelCapabilities.value.reasoning.efforts.map((effort) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: effort.id,
									children: effort.name === effort.id ? effort.name : `${effort.name}（${effort.id}）`
								}, effort.id))]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								id: `${formId}-reasoning-hint`,
								className: AgentTeam_module_css_default.hint,
								children: "由当前 Provider 和模型决定可用档位。"
							})]
						}),
						modelCapabilities.error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ConversationColumn_module_css_default.composerError,
							children: modelCapabilities.error
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: "Agent Preset",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
								required: true,
								value: agentPresetId,
								onChange: (event) => {
									setAgentPresetId(event.target.value);
								},
								className: AgentTeam_module_css_default.input,
								children: presets.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: item.id,
									children: item.name
								}, item.id))
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: "权限预设",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
								required: true,
								value: permissionPresetId,
								onChange: (event) => {
									setPermissionPresetId(event.target.value);
								},
								className: AgentTeam_module_css_default.input,
								children: permissions.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: item.value,
									children: PERMISSION_LABELS[item.value] ?? item.name
								}, item.value))
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Field, {
							label: "助手规则（可选）",
							className: AgentTeam_module_css_default.fullWidth ?? "",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								value: instructions,
								onChange: (event) => {
									setInstructions(event.target.value);
								},
								rows: 4,
								placeholder: "例如：你负责前端实现；遵循现有代码风格；修改前先阅读相关文件；完成后向 Leader 汇报测试结果。",
								className: AgentTeam_module_css_default.input
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: AgentTeam_module_css_default.hint,
								children: "随助手模板保存，在成员启动时加入系统提示词；这里不填写具体任务。"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Field, {
							label: `可用 Skills（已选择 ${selectedSkills.length} 个）`,
							className: AgentTeam_module_css_default.fullWidth ?? "",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AgentTeam_module_css_default.skillPicker,
								role: "group",
								"aria-label": "选择助手可使用的 Skills",
								children: [
									skillsLoading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: AgentTeam_module_css_default.hint,
										children: "正在读取该 Preset 的 Skills…"
									}),
									!skillsLoading && skillsError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ConversationColumn_module_css_default.composerError,
										children: skillsError
									}),
									!skillsLoading && !skillsError && availableSkills.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: AgentTeam_module_css_default.hint,
										children: "该 Agent Preset 没有可用的 Skill。"
									}),
									!skillsLoading && availableSkills.map((skill) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: AgentTeam_module_css_default.skillOption,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: selectedSkills.includes(skill.name),
											onChange: (event) => {
												setSelectedSkills((current) => event.target.checked ? [...current, skill.name].sort() : current.filter((name) => name !== skill.name));
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: AgentTeam_module_css_default.skillOptionText,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [skill.name, !skill.modelInvocable && skill.userInvocable ? " · 仅斜杠调用" : ""] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: skill.description })]
										})]
									}, skill.name))
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: AgentTeam_module_css_default.hint,
								children: "只选择这个助手执行任务时可能需要的 Skills；运行时会按任务需要加载具体 Skill 指令。"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Field, {
							label: `可用 MCP（已选择 ${selectedMcpServers.length} 个）`,
							className: AgentTeam_module_css_default.fullWidth ?? "",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AgentTeam_module_css_default.skillPicker,
								role: "group",
								"aria-label": "选择助手可使用的 MCP Server",
								children: [
									mcpLoading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: AgentTeam_module_css_default.hint,
										children: "正在读取该 Preset 的 MCP Server…"
									}),
									!mcpLoading && mcpError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ConversationColumn_module_css_default.composerError,
										children: mcpError
									}),
									!mcpLoading && !mcpError && availableMcpServers.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: AgentTeam_module_css_default.hint,
										children: "当前 Harness 未为该 Agent Preset 配置 MCP Server。"
									}),
									!mcpLoading && availableMcpServers.map((server) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: AgentTeam_module_css_default.skillOption,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: selectedMcpServers.includes(server.name),
											onChange: (event) => {
												setSelectedMcpServers((current) => event.target.checked ? [...current, server.name].sort() : current.filter((name) => name !== server.name));
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: AgentTeam_module_css_default.skillOptionText,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: server.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [server.tools.length, " 个工具"] })]
										})]
									}, server.name))
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: AgentTeam_module_css_default.hint,
								children: "MCP 连接和密钥由 Harness Profile/Preset 统一管理；运行时只向助手开放已选 Server 的工具。"
							})]
						})
					]
				}), error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					role: "alert",
					className: AgentTeam_module_css_default.inlineError,
					children: error
				})]
			});
		}
		//#endregion
		//#region src/client/store.ts
		let state = {
			visible: false,
			createTeamRequest: 0
		};
		const listeners = /* @__PURE__ */ new Set();
		function openTeams() {
			update({
				visible: true,
				createTeamRequest: 0
			});
		}
		function openTeam(teamId) {
			update({
				visible: true,
				createTeamRequest: 0,
				selectedTeamId: teamId
			});
		}
		function openTeamCreator() {
			update({
				visible: true,
				createTeamRequest: state.createTeamRequest + 1
			});
		}
		function closeAgentTeam() {
			update({
				visible: false,
				createTeamRequest: 0
			});
		}
		function useAgentTeamUi() {
			return (0, react.useSyncExternalStore)(subscribe, getSnapshot, getServerSnapshot);
		}
		function getSnapshot() {
			return state;
		}
		function getServerSnapshot() {
			return {
				visible: false,
				createTeamRequest: 0
			};
		}
		function update(next) {
			if (state.visible === next.visible && state.createTeamRequest === next.createTeamRequest && state.selectedTeamId === next.selectedTeamId) return;
			state = next;
			for (const listener of listeners) listener();
		}
		function subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
		//#endregion
		//#region src/client/team-status.ts
		function isTeamExecuting(team) {
			return Object.values(team.members).some((member) => member.lastRuntimeState === "running" || member.lastRuntimeState === "waiting_approval") || Object.values(team.tasks).some((task) => task.status === "running");
		}
		//#endregion
		//#region src/client/member-visibility.ts
		function initialVisibleMemberSlots(memberIds) {
			return [...memberIds];
		}
		function reconcileVisibleMemberSlots(current, previousMemberIds, memberIds) {
			const available = new Set(memberIds);
			const previous = new Set(previousMemberIds);
			const valid = current.filter((slotId) => available.has(slotId));
			const added = memberIds.filter((slotId) => !previous.has(slotId));
			const next = [.../* @__PURE__ */ new Set([...valid, ...added])];
			return next.length > 0 ? next : [...memberIds];
		}
		function toggleVisibleMemberSlot(current, slotId) {
			if (!current.includes(slotId)) return [...current, slotId];
			return current.length === 1 ? [...current] : current.filter((value) => value !== slotId);
		}
		//#endregion
		//#region \0agent-team-css:/Users/xiong/Doubao/chats/2026-10-15/new-chat/dsh-agent-team/src/client/workspace/WorkspacePanel.module.css.mjs
		const css = ".-cfc9G_workspacePanel{border-left:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);flex-direction:column;flex:none;width:300px;min-height:0;display:flex;overflow:hidden}.-cfc9G_workspaceHeader{background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;justify-content:space-between;align-items:center;gap:8px;min-height:56px;padding:9px 13px;display:flex}.-cfc9G_workspaceHeader>div:first-child{flex-direction:column;min-width:0;display:flex}.-cfc9G_workspaceHeader strong{color:var(--dsw-alias-label-primary);font-size:13px;line-height:19px}.-cfc9G_workspaceHeader>div:first-child>span,.-cfc9G_workspaceHeaderActions>span{color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;font-size:11px;overflow:hidden}.-cfc9G_workspaceHeaderActions{flex:none;align-items:center;gap:3px;display:flex}.-cfc9G_workspaceRefreshButton{width:28px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;border-radius:7px;justify-content:center;align-items:center;padding:0;display:inline-flex}.-cfc9G_workspaceRefreshButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.-cfc9G_workspaceRefreshButton:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}.-cfc9G_workspaceRefreshButton:disabled{cursor:default}.-cfc9G_workspaceRefreshButtonBusy svg{animation:.8s linear infinite -cfc9G_workspaceRefreshSpin}@keyframes -cfc9G_workspaceRefreshSpin{to{transform:rotate(360deg)}}.-cfc9G_workspaceTabs{border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;align-items:stretch;gap:14px;height:38px;padding:0 13px;display:flex}.-cfc9G_workspaceTabs button{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;align-items:center;gap:5px;padding:0 2px;font-size:12px;display:inline-flex;position:relative}.-cfc9G_workspaceTabs button:hover,.-cfc9G_workspaceTabs .-cfc9G_workspaceTabActive{color:var(--dsw-alias-label-primary)}.-cfc9G_workspaceTabs .-cfc9G_workspaceTabActive:after{background:var(--dsw-alias-brand-primary);content:\"\";border-radius:2px 2px 0 0;height:2px;position:absolute;bottom:0;left:0;right:0}.-cfc9G_workspaceTabs button>span{box-sizing:border-box;background:var(--dsw-alias-bg-module-platform);min-width:16px;height:16px;color:var(--dsw-alias-label-secondary);border-radius:8px;place-items:center;padding:0 4px;font-size:10px;display:inline-grid}.-cfc9G_workspaceContent{flex-direction:column;flex:1;min-height:0;display:flex}.-cfc9G_fileTree{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);flex:1;min-height:120px;padding:9px 7px;overflow:auto}.-cfc9G_fileRow{width:100%;min-width:0;height:30px;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:6px;grid-template-columns:12px 16px minmax(0,1fr);align-items:center;gap:4px;padding-right:8px;font-size:12px;display:grid}.-cfc9G_fileRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.-cfc9G_fileDisclosure,.-cfc9G_fileKindIcon{color:var(--dsw-alias-label-tertiary);place-items:center;display:grid}.-cfc9G_fileDisclosure svg{transition:transform .12s}.-cfc9G_fileDisclosureOpen svg{transform:rotate(90deg)}.-cfc9G_fileKindIcon{color:var(--dsw-alias-label-secondary)}.-cfc9G_fileRow span:last-child{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.-cfc9G_fileEmpty,.-cfc9G_fileError{color:var(--dsw-alias-label-tertiary);padding:10px;font-size:11px;display:block}.-cfc9G_fileError{color:var(--dsw-alias-state-error-primary)}.-cfc9G_workspaceChanges{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);flex:1;min-height:0;padding:8px 7px 14px;overflow:auto}.-cfc9G_workspaceChangeGroup+.-cfc9G_workspaceChangeGroup{margin-top:10px}.-cfc9G_workspaceChangeGroup>header{height:26px;color:var(--dsw-alias-label-tertiary);justify-content:space-between;align-items:center;padding:0 7px;font-size:11px;display:flex}.-cfc9G_workspaceChangeGroup>header strong{color:var(--dsw-alias-label-secondary);font-weight:500}.-cfc9G_workspaceChangeRow{width:100%;min-width:0;height:30px;color:var(--dsw-alias-label-secondary);text-align:left;cursor:pointer;background:0 0;border:0;border-radius:6px;grid-template-columns:18px minmax(0,1fr);align-items:center;gap:6px;padding:0 7px;font-family:inherit;font-size:12px;display:grid}.-cfc9G_workspaceChangeRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.-cfc9G_workspaceChangeCode{text-align:center;border-radius:5px;place-items:center;width:18px;height:18px;font-size:11px;font-weight:600;display:grid}.-cfc9G_workspaceChangeAdded{background:var(--dsw-alias-state-success-tertiary);color:var(--dsw-alias-state-success-primary)}.-cfc9G_workspaceChangeModified{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warning-primary)}.-cfc9G_workspaceChangeDeleted{background:var(--dsw-alias-state-error-secondary);color:var(--dsw-alias-state-error-primary)}.-cfc9G_workspaceChangeRenamed{background:var(--dsw-alias-state-business-tertiary,var(--dsw-alias-bg-module-platform));color:var(--dsw-alias-state-business-primary)}.-cfc9G_workspaceChangePath{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.-cfc9G_workspaceGitEmpty{text-align:center;flex-direction:column;flex:1;justify-content:center;align-items:center;min-height:180px;padding:24px 18px;display:flex}.-cfc9G_workspaceGitEmpty>span{background:var(--dsw-alias-bg-module-platform);width:36px;height:36px;color:var(--dsw-alias-label-tertiary);border-radius:10px;place-items:center;margin-bottom:10px;display:grid}.-cfc9G_workspaceGitEmpty strong{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:19px}.-cfc9G_workspaceGitEmpty p,.-cfc9G_workspaceChangesTruncated{color:var(--dsw-alias-label-caption);margin:4px 0 0;font-size:11px;line-height:17px}.-cfc9G_workspaceChangesTruncated{padding:10px 7px 0;display:block}.-cfc9G_workspaceDiffDialog{gap:0;width:min(1320px,100vw - 40px);height:min(900px,100vh - 40px);padding:0;overflow:hidden}.-cfc9G_workspaceDiffShell{flex-direction:column;flex:1;width:100%;height:100%;min-height:0;display:flex}.-cfc9G_workspaceDiffHeader{border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;justify-content:space-between;align-items:center;gap:20px;min-height:78px;padding:16px 18px 15px 22px;display:flex}.-cfc9G_workspaceDiffHeading{min-width:0}.-cfc9G_workspaceDiffTitleRow{align-items:center;gap:10px;min-width:0;display:flex}.-cfc9G_workspaceDiffTitleRow h2{min-width:0;color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;margin:0;font-size:18px;font-weight:600;line-height:26px;overflow:hidden}.-cfc9G_workspaceDiffTitleRow>span{background:var(--dsw-alias-bg-module-platform);height:24px;color:var(--dsw-alias-label-secondary);border-radius:12px;flex:none;align-items:center;padding:0 9px;font-size:12px;display:inline-flex}.-cfc9G_workspaceDiffHeading p{color:var(--dsw-alias-label-tertiary);margin:4px 0 0;font-size:13px;line-height:20px}.-cfc9G_workspaceDiffHeaderActions{flex:none;align-items:center;gap:10px;display:flex}.-cfc9G_workspaceDiffLayout{background:var(--dsw-alias-bg-module-platform);border-radius:8px;padding:2px;display:inline-flex}.-cfc9G_workspaceDiffLayout button{height:28px;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;border-radius:6px;padding:0 11px;font-size:12px}.-cfc9G_workspaceDiffLayout button:hover{color:var(--dsw-alias-label-primary)}.-cfc9G_workspaceDiffLayout .-cfc9G_workspaceDiffLayoutActive{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-alias-shadow-l1)}.-cfc9G_workspaceDiffClose{width:32px;height:32px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:0;border-radius:8px;justify-content:center;align-items:center;padding:0;display:inline-flex}.-cfc9G_workspaceDiffClose:hover{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary)}.-cfc9G_workspaceDiffBody{background:var(--dsw-alias-bg-layer-1);flex:1;min-height:0;display:flex;position:relative;overflow:hidden}.-cfc9G_workspaceDiffVirtualizer{width:100%;height:100%;min-height:0;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family-code,ui-monospace, SFMono-Regular, Menlo, monospace);--diffs-font-family:var(--dsw-font-family-code,ui-monospace, SFMono-Regular, Menlo, monospace);--diffs-font-size:12px;--diffs-line-height:19px;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);font-size:12px;line-height:19px;overflow:auto}.-cfc9G_workspaceDiffState,.-cfc9G_workspaceDiffError{color:var(--dsw-alias-label-tertiary);text-align:center;flex:1;place-items:center;padding:32px;font-size:13px;display:grid}.-cfc9G_workspaceDiffError{color:var(--dsw-alias-state-error-primary)}@media (width<=1440px){.-cfc9G_workspacePanel{width:220px}}@media (width<=760px){.-cfc9G_workspaceDiffDialog{width:calc(100vw - 20px);height:calc(100vh - 20px)}}";
		const tagId = "@limuyang2/dsh-agent-team/WorkspacePanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@limuyang2/dsh-agent-team";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var WorkspacePanel_module_css_default = {
			"workspaceDiffError": "-cfc9G_workspaceDiffError",
			"fileError": "-cfc9G_fileError",
			"workspaceRefreshButtonBusy": "-cfc9G_workspaceRefreshButtonBusy",
			"workspaceChangesTruncated": "-cfc9G_workspaceChangesTruncated",
			"workspaceChangeModified": "-cfc9G_workspaceChangeModified",
			"fileTree": "-cfc9G_fileTree",
			"workspaceDiffDialog": "-cfc9G_workspaceDiffDialog",
			"workspaceHeaderActions": "-cfc9G_workspaceHeaderActions",
			"workspaceChangeRenamed": "-cfc9G_workspaceChangeRenamed",
			"workspaceDiffClose": "-cfc9G_workspaceDiffClose",
			"workspaceDiffVirtualizer": "-cfc9G_workspaceDiffVirtualizer",
			"fileDisclosureOpen": "-cfc9G_fileDisclosureOpen",
			"workspaceRefreshButton": "-cfc9G_workspaceRefreshButton",
			"workspaceGitEmpty": "-cfc9G_workspaceGitEmpty",
			"workspaceChangeGroup": "-cfc9G_workspaceChangeGroup",
			"workspaceChangePath": "-cfc9G_workspaceChangePath",
			"workspaceHeader": "-cfc9G_workspaceHeader",
			"workspaceChangeAdded": "-cfc9G_workspaceChangeAdded",
			"workspaceContent": "-cfc9G_workspaceContent",
			"workspaceTabs": "-cfc9G_workspaceTabs",
			"fileDisclosure": "-cfc9G_fileDisclosure",
			"workspaceDiffTitleRow": "-cfc9G_workspaceDiffTitleRow",
			"workspaceDiffLayoutActive": "-cfc9G_workspaceDiffLayoutActive",
			"workspaceDiffBody": "-cfc9G_workspaceDiffBody",
			"workspaceDiffState": "-cfc9G_workspaceDiffState",
			"workspaceRefreshSpin": "-cfc9G_workspaceRefreshSpin",
			"fileRow": "-cfc9G_fileRow",
			"workspaceTabActive": "-cfc9G_workspaceTabActive",
			"fileEmpty": "-cfc9G_fileEmpty",
			"workspaceDiffLayout": "-cfc9G_workspaceDiffLayout",
			"workspaceChangeCode": "-cfc9G_workspaceChangeCode",
			"workspaceDiffHeaderActions": "-cfc9G_workspaceDiffHeaderActions",
			"workspaceDiffShell": "-cfc9G_workspaceDiffShell",
			"workspaceDiffHeading": "-cfc9G_workspaceDiffHeading",
			"workspaceChangeRow": "-cfc9G_workspaceChangeRow",
			"workspacePanel": "-cfc9G_workspacePanel",
			"fileKindIcon": "-cfc9G_fileKindIcon",
			"workspaceChangeDeleted": "-cfc9G_workspaceChangeDeleted",
			"workspaceChanges": "-cfc9G_workspaceChanges",
			"workspaceDiffHeader": "-cfc9G_workspaceDiffHeader"
		};
		//#endregion
		//#region src/client/workspace/WorkspacePanel.tsx
		function WorkspacePanel({ team, refreshSignal, onCollapse }) {
			const [activeTab, setActiveTab] = (0, react.useState)("files");
			const [entries, setEntries] = (0, react.useState)([]);
			const [gitStatus, setGitStatus] = (0, react.useState)();
			const [diffTarget, setDiffTarget] = (0, react.useState)();
			const [fileError, setFileError] = (0, react.useState)();
			const [gitError, setGitError] = (0, react.useState)();
			const [fileRefreshing, setFileRefreshing] = (0, react.useState)(false);
			const [gitRefreshing, setGitRefreshing] = (0, react.useState)(false);
			const [treeRefreshToken, setTreeRefreshToken] = (0, react.useState)(0);
			const fileLoadGeneration = (0, react.useRef)(0);
			const gitLoadGeneration = (0, react.useRef)(0);
			const loadFiles = (0, react.useCallback)(async () => {
				const generation = ++fileLoadGeneration.current;
				setFileRefreshing(true);
				try {
					const next = await callAgentTeam("team.workspace.list", { teamId: team.id });
					if (generation !== fileLoadGeneration.current) return;
					setEntries(next);
					setTreeRefreshToken((current) => current + 1);
					setFileError(void 0);
				} catch (cause) {
					if (generation !== fileLoadGeneration.current) return;
					setFileError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					if (generation === fileLoadGeneration.current) setFileRefreshing(false);
				}
			}, [team.id]);
			const loadChanges = (0, react.useCallback)(async () => {
				const generation = ++gitLoadGeneration.current;
				setGitRefreshing(true);
				try {
					const next = await callAgentTeam("team.workspace.changes", { teamId: team.id });
					if (generation !== gitLoadGeneration.current) return;
					setGitStatus(next);
					setGitError(void 0);
				} catch (cause) {
					if (generation !== gitLoadGeneration.current) return;
					setGitError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					if (generation === gitLoadGeneration.current) setGitRefreshing(false);
				}
			}, [team.id]);
			const load = (0, react.useCallback)(async () => {
				await Promise.allSettled([loadFiles(), loadChanges()]);
			}, [loadChanges, loadFiles]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			(0, react.useEffect)(() => {
				if (refreshSignal === 0) return;
				const timer = setTimeout(() => {
					load();
				}, 600);
				return () => {
					clearTimeout(timer);
				};
			}, [load, refreshSignal]);
			(0, react.useEffect)(() => {
				let timer;
				const unsubscribe = subscribeAgentTeamWorkspace(team.id, () => {
					if (timer !== void 0) clearTimeout(timer);
					timer = setTimeout(() => {
						load();
					}, 250);
				}, () => {});
				return () => {
					if (timer !== void 0) clearTimeout(timer);
					unsubscribe();
				};
			}, [load, team.id]);
			const refreshing = fileRefreshing || gitRefreshing;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
				className: WorkspacePanel_module_css_default.workspacePanel,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: WorkspacePanel_module_css_default.workspaceHeader,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "Workspace" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: team.workspacePath })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: WorkspacePanel_module_css_default.workspaceHeaderActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: refreshing ? "刷新中…" : "刷新 Workspace",
								side: "bottom",
								delayMs: 400,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: `${WorkspacePanel_module_css_default.workspaceRefreshButton} ${refreshing ? WorkspacePanel_module_css_default.workspaceRefreshButtonBusy : ""}`,
									disabled: refreshing,
									"aria-label": refreshing ? "正在刷新 Workspace" : "刷新 Workspace",
									onClick: () => {
										load();
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, { size: 16 })
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: "收起 Workspace",
								side: "bottom",
								delayMs: 400,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: WorkspacePanel_module_css_default.workspaceRefreshButton,
									"aria-label": "收起 Workspace",
									onClick: onCollapse,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, { size: 14 })
								})
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: WorkspacePanel_module_css_default.workspaceTabs,
						role: "tablist",
						"aria-label": "Workspace 视图",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							role: "tab",
							"aria-selected": activeTab === "files",
							className: activeTab === "files" ? WorkspacePanel_module_css_default.workspaceTabActive : "",
							onClick: () => {
								setActiveTab("files");
							},
							children: "文件"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "tab",
							"aria-selected": activeTab === "changes",
							className: activeTab === "changes" ? WorkspacePanel_module_css_default.workspaceTabActive : "",
							onClick: () => {
								setActiveTab("changes");
							},
							children: ["变更", gitStatus?.state === "repository" && gitStatus.changes.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: gitStatus.changes.length }) : null]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: WorkspacePanel_module_css_default.workspaceContent,
						children: activeTab === "files" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: WorkspacePanel_module_css_default.fileTree,
							children: [
								entries.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceTreeRow, {
									teamId: team.id,
									entry,
									depth: 0,
									refreshToken: treeRefreshToken
								}, entry.path)),
								entries.length === 0 && !fileError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: WorkspacePanel_module_css_default.fileEmpty,
									children: fileRefreshing ? "正在读取目录…" : "目录为空"
								}),
								fileError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: WorkspacePanel_module_css_default.fileError,
									children: fileError
								})
							]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceChanges, {
							status: gitStatus,
							error: gitError,
							refreshing: gitRefreshing,
							onOpenDiff: setDiffTarget
						})
					})
				]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceDiffDialog, {
				teamId: team.id,
				target: diffTarget,
				onClose: () => {
					setDiffTarget(void 0);
				}
			})] });
		}
		function WorkspaceChanges({ status, error, refreshing, onOpenDiff }) {
			if (error !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: WorkspacePanel_module_css_default.fileError,
				children: error
			});
			if (status === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: WorkspacePanel_module_css_default.fileEmpty,
				children: refreshing ? "正在读取 Git 状态…" : "暂无状态"
			});
			if (status.state === "not-repository") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: WorkspacePanel_module_css_default.workspaceGitEmpty,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutline16, { size: 20 }) }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "当前 Workspace 不是 Git 仓库" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "仍可在“文件”中浏览工作区内容。" })
				]
			});
			if (status.changes.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: WorkspacePanel_module_css_default.workspaceGitEmpty,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutline16, { size: 20 }) }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "没有未提交变更" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "Workspace 当前处于干净状态。" })
				]
			});
			const conflicted = status.changes.filter((change) => change.kind === "unmerged");
			const staged = status.changes.filter((change) => change.staged && change.kind !== "unmerged");
			const modified = status.changes.filter((change) => change.unstaged && !["unmerged", "untracked"].includes(change.kind));
			const untracked = status.changes.filter((change) => change.kind === "untracked");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: WorkspacePanel_module_css_default.workspaceChanges,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceChangeGroup, {
						title: "冲突",
						changes: conflicted,
						scope: "unstaged",
						onOpenDiff
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceChangeGroup, {
						title: "已暂存",
						changes: staged,
						scope: "staged",
						onOpenDiff
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceChangeGroup, {
						title: "已修改",
						changes: modified,
						scope: "unstaged",
						onOpenDiff
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceChangeGroup, {
						title: "未跟踪",
						changes: untracked,
						scope: "unstaged",
						onOpenDiff
					}),
					status.truncated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: WorkspacePanel_module_css_default.workspaceChangesTruncated,
						children: "变更过多，仅显示前 2000 项。"
					})
				]
			});
		}
		function WorkspaceChangeGroup({ title, changes, scope, onOpenDiff }) {
			if (changes.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: WorkspacePanel_module_css_default.workspaceChangeGroup,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: title }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: changes.length })] }), changes.map((change) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: WorkspacePanel_module_css_default.workspaceChangeRow,
					title: `预览 ${change.path}`,
					onClick: () => {
						onOpenDiff({
							change,
							scope
						});
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `${WorkspacePanel_module_css_default.workspaceChangeCode} ${workspaceChangeTone(change)}`,
						children: workspaceChangeCode(change)
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: WorkspacePanel_module_css_default.workspaceChangePath,
						children: change.originalPath === void 0 ? change.path : `${change.originalPath} → ${change.path}`
					})]
				}, `${title}:${change.path}`))]
			});
		}
		function WorkspaceDiffDialog({ teamId, target, onClose }) {
			const [diff, setDiff] = (0, react.useState)();
			const [layout, setLayout] = (0, react.useState)("unified");
			const [loading, setLoading] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)();
			const themeType = useHarnessThemeType();
			(0, react.useEffect)(() => {
				if (target === void 0) {
					setDiff(void 0);
					setError(void 0);
					return;
				}
				let active = true;
				setLoading(true);
				setDiff(void 0);
				setError(void 0);
				callAgentTeam("team.workspace.diff", {
					teamId,
					path: target.change.path,
					scope: target.scope,
					layout,
					theme: themeType
				}).then((next) => {
					if (active) setDiff(next);
				}).catch((cause) => {
					if (active) setError(cause instanceof Error ? cause.message : String(cause));
				}).finally(() => {
					if (active) setLoading(false);
				});
				return () => {
					active = false;
				};
			}, [
				layout,
				target,
				teamId,
				themeType
			]);
			const scopeLabel = target?.scope === "staged" ? "已暂存" : "工作区";
			const hasTextPatch = diff !== void 0 && !diff.binary && diff.html.length > 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnimatedModal, {
				open: target !== void 0,
				onClose,
				title: target?.change.path ?? "文件变更",
				closeLabel: "关闭变更预览",
				className: WorkspacePanel_module_css_default.workspaceDiffDialog ?? "",
				headless: true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: WorkspacePanel_module_css_default.workspaceDiffShell,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: WorkspacePanel_module_css_default.workspaceDiffHeader,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: WorkspacePanel_module_css_default.workspaceDiffHeading,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: WorkspacePanel_module_css_default.workspaceDiffTitleRow,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: target?.change.path ?? "文件变更" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: workspaceChangeLabel(target?.change.kind) })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [scopeLabel, "变更 · 只读预览"] })]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: WorkspacePanel_module_css_default.workspaceDiffHeaderActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: WorkspacePanel_module_css_default.workspaceDiffLayout,
								role: "group",
								"aria-label": "Diff 布局",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: layout === "unified" ? WorkspacePanel_module_css_default.workspaceDiffLayoutActive : "",
									onClick: () => {
										setLayout("unified");
									},
									children: "统一"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: layout === "split" ? WorkspacePanel_module_css_default.workspaceDiffLayoutActive : "",
									onClick: () => {
										setLayout("split");
									},
									children: "分栏"
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: WorkspacePanel_module_css_default.workspaceDiffClose,
								"aria-label": "关闭变更预览",
								onClick: onClose,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, { size: 16 })
							})]
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: WorkspacePanel_module_css_default.workspaceDiffBody,
						children: [
							loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: WorkspacePanel_module_css_default.workspaceDiffState,
								children: "正在读取文件变更…"
							}),
							error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								role: "alert",
								className: WorkspacePanel_module_css_default.workspaceDiffError,
								children: error
							}),
							diff?.binary && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: WorkspacePanel_module_css_default.workspaceDiffState,
								children: "二进制文件无法显示文本 Diff。"
							}),
							diff !== void 0 && !diff.binary && !hasTextPatch && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: WorkspacePanel_module_css_default.workspaceDiffState,
								children: "这个文件只有元数据变化，没有可显示的文本差异。"
							}),
							hasTextPatch && diff !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceDiffHtml, { html: diff.html })
						]
					})]
				})
			});
		}
		function WorkspaceDiffHtml({ html }) {
			const hostRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const host = hostRef.current;
				if (host === null) return;
				const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
				root.innerHTML = html;
				return () => {
					root.replaceChildren();
				};
			}, [html]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: hostRef,
				className: WorkspacePanel_module_css_default.workspaceDiffVirtualizer
			});
		}
		function useHarnessThemeType() {
			const readTheme = () => typeof document !== "undefined" && document.body.hasAttribute("data-ds-dark-theme") ? "dark" : "light";
			const [themeType, setThemeType] = (0, react.useState)(readTheme);
			(0, react.useEffect)(() => {
				const observer = new MutationObserver(() => {
					setThemeType(readTheme());
				});
				observer.observe(document.body, {
					attributes: true,
					attributeFilter: ["data-ds-dark-theme"]
				});
				return () => {
					observer.disconnect();
				};
			}, []);
			return themeType;
		}
		function workspaceChangeLabel(kind) {
			if (kind === "added") return "新增文件";
			if (kind === "deleted") return "删除文件";
			if (kind === "renamed") return "重命名";
			if (kind === "copied") return "复制文件";
			if (kind === "unmerged") return "冲突文件";
			if (kind === "untracked") return "未跟踪文件";
			if (kind === "type-changed") return "类型变化";
			return "修改文件";
		}
		function workspaceChangeCode(change) {
			if (change.kind === "untracked") return "U";
			if (change.kind === "unmerged") return "!";
			if (change.kind === "added") return "A";
			if (change.kind === "deleted") return "D";
			if (change.kind === "renamed") return "R";
			if (change.kind === "copied") return "C";
			if (change.kind === "type-changed") return "T";
			return "M";
		}
		function workspaceChangeTone(change) {
			if (change.kind === "added" || change.kind === "untracked") return WorkspacePanel_module_css_default.workspaceChangeAdded;
			if (change.kind === "deleted" || change.kind === "unmerged") return WorkspacePanel_module_css_default.workspaceChangeDeleted;
			if (change.kind === "renamed" || change.kind === "copied") return WorkspacePanel_module_css_default.workspaceChangeRenamed;
			return WorkspacePanel_module_css_default.workspaceChangeModified;
		}
		function WorkspaceTreeRow({ teamId, entry, depth, refreshToken }) {
			const [open, setOpen] = (0, react.useState)(false);
			const [children, setChildren] = (0, react.useState)();
			(0, react.useEffect)(() => {
				if (!open || entry.kind !== "directory") return;
				let active = true;
				callAgentTeam("team.workspace.list", {
					teamId,
					path: entry.path
				}).then((next) => {
					if (active) setChildren(next);
				}).catch(() => {
					if (active) setChildren([]);
				});
				return () => {
					active = false;
				};
			}, [
				entry.kind,
				entry.path,
				open,
				refreshToken,
				teamId
			]);
			function toggle() {
				if (entry.kind === "directory") setOpen((current) => !current);
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: WorkspacePanel_module_css_default.fileRow,
				style: { paddingLeft: 8 + depth * 14 },
				onClick: toggle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `${WorkspacePanel_module_css_default.fileDisclosure} ${open ? WorkspacePanel_module_css_default.fileDisclosureOpen : ""}`,
						children: entry.kind === "directory" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, { size: 12 }) : entry.kind === "symlink" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutline14, { size: 12 }) : null
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: WorkspacePanel_module_css_default.fileKindIcon,
						children: entry.kind === "directory" ? open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpen16, { size: 16 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderClose16, { size: 16 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FileOutlineIcon, { size: 16 })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: entry.name })
				]
			}), open && children?.map((child) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceTreeRow, {
				teamId,
				entry: child,
				depth: depth + 1,
				refreshToken
			}, child.path))] });
		}
		function FileOutlineIcon({ size }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M4 1.75h4.5L12 5.25v9H4v-12.5Z",
					stroke: "currentColor",
					strokeWidth: "1.3",
					strokeLinejoin: "round"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M8.5 1.75v3.5H12",
					stroke: "currentColor",
					strokeWidth: "1.3",
					strokeLinejoin: "round"
				})]
			});
		}
		//#endregion
		//#region src/client/teams/TeamPanel.tsx
		function TeamPanel({ catalog, assistants, teams, createRequest, selectedTeamId, pickWorkspace, onChanged }) {
			const [creating, setCreating] = (0, react.useState)(false);
			const [managingAssistants, setManagingAssistants] = (0, react.useState)(false);
			const selectedTeam = teams.find((team) => team.id === selectedTeamId);
			const visibleTeams = selectedTeamId === void 0 ? teams : teams.filter((team) => team.id === selectedTeamId);
			(0, react.useEffect)(() => {
				if (createRequest > 0) {
					setManagingAssistants(false);
					setCreating(true);
				}
			}, [createRequest]);
			(0, react.useEffect)(() => {
				if (selectedTeamId !== void 0) setManagingAssistants(false);
			}, [selectedTeamId]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: AgentTeam_module_css_default.section,
				children: [
					selectedTeam === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AgentTeam_module_css_default.sectionHeader,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h2", {
							className: AgentTeam_module_css_default.sectionHeading,
							children: ["团队 ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: AgentTeam_module_css_default.count,
								children: teams.length
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AgentTeam_module_css_default.sectionDescription,
							children: "选择 Leader 和成员，共享同一个 Workspace 协作。"
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: AgentTeam_module_css_default.sectionHeaderActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								onClick: () => {
									setManagingAssistants(true);
								},
								children: "管理助手"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								disabled: assistants.length === 0,
								onClick: () => {
									setCreating(true);
								},
								children: "组建团队"
							})]
						})]
					}),
					selectedTeam === void 0 ? visibleTeams.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
						text: "还没有团队",
						hint: "先通过右上角“管理助手”创建助手，再选择 Leader 和团队成员。"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: AgentTeam_module_css_default.cardList,
						children: visibleTeams.map((team) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TeamCard, {
							team,
							catalog,
							assistants,
							pickWorkspace,
							onChanged,
							onCloned: async (teamId) => {
								openTeam(teamId);
								await onChanged();
							}
						}, team.id))
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TeamWorkbench, {
						team: selectedTeam,
						catalog,
						assistants,
						permissionPresets: catalog?.permissionPresets ?? [],
						pickWorkspace,
						onChanged
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnimatedModal, {
						open: managingAssistants,
						onClose: () => {
							setManagingAssistants(false);
						},
						title: "管理助手",
						closeLabel: "关闭",
						description: "创建和维护可在不同团队间复用的助手模板。",
						className: AgentTeam_module_css_default.assistantManagementDialog ?? "",
						contentClassName: AgentTeam_module_css_default.assistantManagementDialogContent ?? "",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: AgentTeam_module_css_default.assistantManagementBody,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssistantPanel, {
								catalog,
								assistants,
								onChanged
							})
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnimatedModal, {
						open: creating,
						onClose: () => {
							setCreating(false);
						},
						title: "新建团队",
						closeLabel: "关闭",
						description: "让多个 AI 助手组队协作。一个团队必须有且只有一个 Leader。",
						className: AgentTeam_module_css_default.teamCreateDialog ?? "",
						contentClassName: AgentTeam_module_css_default.teamCreateContent ?? "",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TeamForm, {
							catalog,
							assistants,
							pickWorkspace,
							onCancel: () => {
								setCreating(false);
							},
							onCreated: async (teamId) => {
								setCreating(false);
								openTeam(teamId);
								await onChanged();
							}
						})
					})
				]
			});
		}
		function TeamWorkbench({ team, catalog, assistants, permissionPresets, pickWorkspace, onChanged }) {
			const members = Object.values(team.members);
			const memberIds = members.map((member) => member.id);
			const [snapshot, setSnapshot] = (0, react.useState)();
			const [visibleSlots, setVisibleSlots] = (0, react.useState)(() => initialVisibleMemberSlots(memberIds));
			const [error, setError] = (0, react.useState)();
			const [memberActionError, setMemberActionError] = (0, react.useState)();
			const [memberActionBusy, setMemberActionBusy] = (0, react.useState)(false);
			const [memberToRemove, setMemberToRemove] = (0, react.useState)();
			const [managementOpen, setManagementOpen] = (0, react.useState)(false);
			const [addMemberOpen, setAddMemberOpen] = (0, react.useState)(false);
			const [expandedSlotId, setExpandedSlotId] = (0, react.useState)();
			const [workspaceVisible, setWorkspaceVisible] = (0, react.useState)(true);
			const [workspaceRefreshSignal, setWorkspaceRefreshSignal] = (0, react.useState)(0);
			const refreshTimer = (0, react.useRef)();
			const loadGeneration = (0, react.useRef)(0);
			const previousMemberIds = (0, react.useRef)(memberIds);
			const load = (0, react.useCallback)(async () => {
				const generation = ++loadGeneration.current;
				try {
					const next = await callAgentTeam("team.workbench.get", { id: team.id });
					if (generation !== loadGeneration.current) return;
					setSnapshot(next);
					setError(void 0);
				} catch (cause) {
					if (generation !== loadGeneration.current) return;
					setError(cause instanceof Error ? cause.message : String(cause));
				}
			}, [team.id]);
			(0, react.useEffect)(() => {
				load();
			}, [load, team.revision]);
			(0, react.useEffect)(() => subscribeAgentTeamConversation(team.id, (conversation) => {
				if (conversation !== void 0) {
					loadGeneration.current += 1;
					setWorkspaceRefreshSignal((current) => current + 1);
					setSnapshot((current) => {
						if (current === void 0) return current;
						const conversations = current.conversations.filter((item) => item.slotId !== conversation.slotId);
						return {
							...current,
							conversations: [...conversations, conversation]
						};
					});
					setError(void 0);
					return;
				}
				if (refreshTimer.current !== void 0) return;
				refreshTimer.current = setTimeout(() => {
					refreshTimer.current = void 0;
					load();
				}, 50);
			}, () => {
				setError("实时连接已断开，正在等待重连");
			}, () => {
				setError(void 0);
				load();
			}), [load, team.id]);
			(0, react.useEffect)(() => () => {
				if (refreshTimer.current !== void 0) clearTimeout(refreshTimer.current);
			}, []);
			(0, react.useEffect)(() => {
				setVisibleSlots((current) => reconcileVisibleMemberSlots(current, previousMemberIds.current, memberIds));
				previousMemberIds.current = memberIds;
			}, [team.members]);
			(0, react.useEffect)(() => {
				if (expandedSlotId !== void 0 && team.members[expandedSlotId] === void 0) setExpandedSlotId(void 0);
			}, [expandedSlotId, team.members]);
			(0, react.useEffect)(() => {
				if (expandedSlotId === void 0) return;
				const closeOnEscape = (event) => {
					if (event.key === "Escape") setExpandedSlotId(void 0);
				};
				window.addEventListener("keydown", closeOnEscape);
				return () => {
					window.removeEventListener("keydown", closeOnEscape);
				};
			}, [expandedSlotId]);
			function toggleMember(slotId) {
				setVisibleSlots((current) => toggleVisibleMemberSlot(current, slotId));
			}
			async function removeMember() {
				if (memberToRemove === void 0) return;
				setMemberActionBusy(true);
				try {
					await callAgentTeam("team.removeMember", {
						teamId: team.id,
						slotId: memberToRemove.id
					}, team.revision);
					setMemberToRemove(void 0);
					setMemberActionError(void 0);
					await onChanged();
					await load();
				} catch (cause) {
					setMemberActionError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setMemberActionBusy(false);
				}
			}
			const conversations = new Map(snapshot?.conversations.map((item) => [item.slotId, item]) ?? []);
			const visibleMembers = visibleSlots.map((slotId) => team.members[slotId]).filter((value) => value !== void 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: AgentTeam_module_css_default.workbench,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AgentTeam_module_css_default.workbenchMainPane,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AgentTeam_module_css_default.memberTabs,
								"aria-label": "团队成员",
								children: [members.map((member) => {
									const conversation = conversations.get(member.id);
									const selected = visibleSlots.includes(member.id);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: AgentTeam_module_css_default.memberTabWrap,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: `${AgentTeam_module_css_default.memberTab} ${member.role === "leader" ? "" : AgentTeam_module_css_default.memberTabWithActions} ${selected ? AgentTeam_module_css_default.memberTabActive : ""}`,
											onClick: () => {
												toggleMember(member.id);
											},
											"aria-pressed": selected,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: AgentTeam_module_css_default.memberAvatar,
													children: member.displayName.slice(0, 1).toUpperCase()
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: AgentTeam_module_css_default.memberTabName,
													children: member.displayName
												}),
												member.role === "leader" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CrownIcon, {
													size: 15,
													className: AgentTeam_module_css_default.leaderCrown,
													title: "Leader"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: `${AgentTeam_module_css_default.statusDot} ${conversation?.status === "running" ? AgentTeam_module_css_default.statusRunning : AgentTeam_module_css_default.statusIdle}` })
											]
										}), member.role !== "leader" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: AgentTeam_module_css_default.memberTabActions,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: AgentTeam_module_css_default.memberTabRemoveAction,
												title: `移出成员 ${member.displayName}`,
												"aria-label": `移出成员 ${member.displayName}`,
												onClick: () => {
													setMemberActionError(void 0);
													setMemberToRemove(member);
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, { size: 12 })
											})
										})]
									}, member.id);
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: AgentTeam_module_css_default.manageButtonWrap,
									children: [
										!workspaceVisible && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "ghost",
											size: "sm",
											className: AgentTeam_module_css_default.manageButton,
											onClick: () => {
												setWorkspaceVisible(true);
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronLeftOutline14, { size: 14 }), "Workspace"]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "ghost",
											size: "sm",
											className: AgentTeam_module_css_default.manageButton,
											onClick: () => {
												setAddMemberOpen(true);
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 14 }), "添加助手"]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "ghost",
											size: "sm",
											className: AgentTeam_module_css_default.manageButton,
											onClick: () => {
												setManagementOpen((value) => !value);
											},
											children: managementOpen ? "收起管理" : "团队管理"
										})
									]
								})]
							}),
							error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								role: "alert",
								className: AgentTeam_module_css_default.workbenchError,
								children: error
							}),
							memberActionError && memberToRemove === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								role: "alert",
								className: AgentTeam_module_css_default.workbenchError,
								children: memberActionError
							}),
							expandedSlotId !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: AgentTeam_module_css_default.conversationFocusBackdrop,
								"aria-label": "关闭放大对话",
								onClick: () => {
									setExpandedSlotId(void 0);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: AgentTeam_module_css_default.workbenchBody,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: AgentTeam_module_css_default.conversationGrid,
									style: { "--member-columns": visibleMembers.length },
									children: visibleMembers.map((member) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConversationColumn, {
										team,
										member,
										conversation: conversations.get(member.id),
										permissionPresets,
										onSent: load,
										onTeamChanged: onChanged,
										expanded: expandedSlotId === member.id,
										onExpandedChange: (expanded) => {
											setExpandedSlotId(expanded ? member.id : void 0);
										}
									}, member.id))
								})
							})
						]
					}),
					workspaceVisible && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspacePanel, {
						team,
						refreshSignal: workspaceRefreshSignal,
						onCollapse: () => {
							setWorkspaceVisible(false);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnimatedModal, {
						open: managementOpen,
						onClose: () => {
							setManagementOpen(false);
						},
						title: "团队管理",
						description: "管理成员、Leader、上下文和团队生命周期。",
						closeLabel: "关闭",
						className: AgentTeam_module_css_default.managementDialog ?? "",
						contentClassName: AgentTeam_module_css_default.managementDialogContent ?? "",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: AgentTeam_module_css_default.managementDialogBody,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TeamCard, {
								team,
								catalog,
								assistants,
								pickWorkspace,
								onChanged: async () => {
									await onChanged();
									await load();
								},
								onCloned: async (teamId) => {
									setManagementOpen(false);
									openTeam(teamId);
									await onChanged();
								},
								compact: true
							})
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AddTeamMemberDialog, {
						open: addMemberOpen,
						team,
						catalog,
						assistants,
						onClose: () => {
							setAddMemberOpen(false);
						},
						onChanged: async () => {
							await onChanged();
							await load();
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnimatedModal, {
						open: memberToRemove !== void 0,
						onClose: () => {
							if (memberActionBusy) return;
							setMemberToRemove(void 0);
							setMemberActionError(void 0);
						},
						title: "移出团队成员",
						closeLabel: "关闭",
						description: "该成员将停止参与当前团队。",
						className: AgentTeam_module_css_default.memberRemoveDialog ?? "",
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: memberActionBusy,
							onClick: () => {
								setMemberToRemove(void 0);
								setMemberActionError(void 0);
							},
							children: "取消"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: `${AgentTeam_module_css_default.dangerButton} ${AgentTeam_module_css_default.confirmDangerButton}`,
							disabled: memberActionBusy,
							onClick: () => {
								removeMember();
							},
							children: memberActionBusy ? "移出中…" : "确认移出"
						})] }),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: AgentTeam_module_css_default.memberRemoveConfirm,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: AgentTeam_module_css_default.memberRemoveIcon,
									"aria-hidden": "true",
									children: "−"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
									"确定移出“",
									memberToRemove?.displayName,
									"”？"
								] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "该成员将停止参与团队；若仍有未完成任务，系统会阻止移出。助手模板和 Session 历史都会保留。" })] }),
								memberActionError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									role: "alert",
									className: AgentTeam_module_css_default.inlineError,
									children: memberActionError
								})
							]
						})
					})
				]
			});
		}
		function AddTeamMemberDialog({ open, team, catalog, assistants, onClose, onChanged }) {
			const [addingAssistantId, setAddingAssistantId] = (0, react.useState)();
			const [configuringAssistants, setConfiguringAssistants] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)();
			async function addMember(assistant) {
				setAddingAssistantId(assistant.id);
				try {
					await callAgentTeam("team.addMember", {
						teamId: team.id,
						value: { assistantId: assistant.id }
					}, team.revision);
					setError(void 0);
					onClose();
					await onChanged();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setAddingAssistantId(void 0);
				}
			}
			function close() {
				if (addingAssistantId !== void 0) return;
				setConfiguringAssistants(false);
				setError(void 0);
				onClose();
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(AnimatedModal, {
				open,
				onClose: close,
				title: "添加助手",
				description: `选择一个助手加入团队“${team.name}”。同一个助手可以多次加入。`,
				closeLabel: "关闭",
				className: AgentTeam_module_css_default.addMemberDialog ?? "",
				contentClassName: AgentTeam_module_css_default.addMemberDialogContent ?? "",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AgentTeam_module_css_default.addMemberDialogHeader,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "助手列表" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: AgentTeam_module_css_default.addMemberDialogHeaderActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [assistants.length, " 个助手"] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								size: "sm",
								disabled: addingAssistantId !== void 0,
								onClick: () => {
									setConfiguringAssistants(true);
								},
								children: "助手配置"
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AgentTeam_module_css_default.addMemberMenuList,
						children: [assistants.map((assistant) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: AgentTeam_module_css_default.addMemberOption,
							disabled: addingAssistantId !== void 0,
							onClick: () => {
								addMember(assistant);
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: AgentTeam_module_css_default.addMemberAvatar,
									children: assistant.name.slice(0, 1).toUpperCase()
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: AgentTeam_module_css_default.addMemberCopy,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: assistant.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
										assistant.provider,
										" / ",
										assistant.model
									] })]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: AgentTeam_module_css_default.addMemberOptionAction,
									children: addingAssistantId === assistant.id ? "添加中…" : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 14 })
								})
							]
						}, assistant.id)), assistants.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: AgentTeam_module_css_default.addMemberEmpty,
							children: "还没有可添加的助手模板"
						})]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						role: "alert",
						className: AgentTeam_module_css_default.inlineError,
						children: error
					})
				]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnimatedModal, {
				open: configuringAssistants,
				onClose: () => {
					setConfiguringAssistants(false);
				},
				title: "助手配置",
				closeLabel: "关闭",
				description: "创建和维护可在不同团队间复用的助手模板。",
				className: AgentTeam_module_css_default.assistantManagementDialog ?? "",
				contentClassName: AgentTeam_module_css_default.assistantManagementDialogContent ?? "",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: AgentTeam_module_css_default.assistantManagementBody,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssistantPanel, {
						catalog,
						assistants,
						onChanged
					})
				})
			})] });
		}
		function CloneTeamDialog({ open, team, catalog, pickWorkspace, onClose, onCreated }) {
			const catalogWorkspaces = catalog?.workspaces.filter((workspace) => workspace.status === "ok") ?? [];
			const [name, setName] = (0, react.useState)(`${team.name} 副本`);
			const [workspaceId, setWorkspaceId] = (0, react.useState)(team.workspaceId);
			const [pickedWorkspace, setPickedWorkspace] = (0, react.useState)();
			const [saving, setSaving] = (0, react.useState)(false);
			const [pickingWorkspace, setPickingWorkspace] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)();
			const members = Object.values(team.members);
			const workspaces = (0, react.useMemo)(() => {
				const items = [...catalogWorkspaces];
				const fallback = pickedWorkspace ?? {
					id: team.workspaceId,
					path: team.workspacePath,
					title: workspaceName(team.workspacePath)
				};
				if (!items.some((workspace) => workspace.id === fallback.id)) items.push({
					...fallback,
					status: "ok"
				});
				return items;
			}, [
				catalogWorkspaces,
				pickedWorkspace,
				team.workspaceId,
				team.workspacePath
			]);
			(0, react.useEffect)(() => {
				if (!open) return;
				setName(`${team.name} 副本`);
				setWorkspaceId(team.workspaceId);
				setPickedWorkspace(void 0);
				setSaving(false);
				setPickingWorkspace(false);
				setError(void 0);
			}, [
				open,
				team.id,
				team.name,
				team.workspaceId
			]);
			async function chooseWorkspace() {
				setPickingWorkspace(true);
				try {
					const workspace = await pickWorkspace();
					if (workspace === null) return;
					setPickedWorkspace(workspace);
					setWorkspaceId(workspace.id);
					setError(void 0);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setPickingWorkspace(false);
				}
			}
			async function submit(event) {
				event.preventDefault();
				if (!name.trim() || !workspaceId) return;
				setSaving(true);
				try {
					const draft = await callAgentTeam("team.clone", {
						teamId: team.id,
						name,
						workspaceId
					});
					await callAgentTeam("team.start", { id: draft.id }, draft.revision);
					setError(void 0);
					onClose();
					await onCreated(draft.id);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setSaving(false);
				}
			}
			function close() {
				if (saving || pickingWorkspace) return;
				onClose();
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnimatedModal, {
				open,
				onClose: close,
				title: "复制团队",
				closeLabel: "关闭",
				description: "复用当前团队配置，并为每位成员创建全新 Session。",
				className: AgentTeam_module_css_default.cloneTeamDialog ?? "",
				contentClassName: AgentTeam_module_css_default.cloneTeamDialogContent ?? "",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
					className: AgentTeam_module_css_default.cloneTeamForm,
					onSubmit: (event) => {
						submit(event);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: AgentTeam_module_css_default.cloneTeamFields,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "团队名称",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									required: true,
									value: name,
									onChange: (event) => {
										setName(event.target.value);
									},
									placeholder: "输入团队名称",
									className: AgentTeam_module_css_default.input,
									autoFocus: true
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "Workspace",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: AgentTeam_module_css_default.workspacePickerRow,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										required: true,
										value: workspaceId,
										onChange: (event) => {
											setWorkspaceId(event.target.value);
										},
										className: AgentTeam_module_css_default.input,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "",
											children: workspaces.length === 0 ? "暂无 Workspace" : "请选择 Workspace"
										}), workspaces.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
											value: item.id,
											children: [
												item.title,
												" — ",
												item.path
											]
										}, item.id))]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										type: "button",
										disabled: pickingWorkspace || saving,
										onClick: () => {
											chooseWorkspace();
										},
										className: AgentTeam_module_css_default.workspacePickButton,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutline16, { size: 16 }), pickingWorkspace ? "选择中…" : "选择文件夹"]
									})]
								})
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: AgentTeam_module_css_default.cloneTeamMembers,
							"aria-label": "复制的团队成员",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AgentTeam_module_css_default.cloneTeamSectionHeader,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "团队成员" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [members.length, " 人"] })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: AgentTeam_module_css_default.cloneTeamMemberGrid,
								children: members.map((member) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: `${AgentTeam_module_css_default.cloneTeamMember} ${member.role === "leader" ? AgentTeam_module_css_default.cloneTeamLeader : ""}`,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: AgentTeam_module_css_default.cloneTeamAvatar,
											children: member.displayName.slice(0, 1).toUpperCase()
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: AgentTeam_module_css_default.cloneTeamMemberCopy,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
												title: member.displayName,
												children: member.displayName
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
												member.assistantSnapshot.provider,
												" / ",
												member.assistantSnapshot.model
											] })]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: AgentTeam_module_css_default.cloneTeamRole,
											children: member.role === "leader" ? "Leader" : "成员"
										})
									]
								}, member.id))
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AgentTeam_module_css_default.cloneTeamNotice,
							children: "不会复制任务、对话上下文、消息历史或运行状态。"
						}),
						error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "alert",
							className: AgentTeam_module_css_default.inlineError,
							children: error
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: AgentTeam_module_css_default.cloneTeamActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								type: "button",
								disabled: saving || pickingWorkspace,
								onClick: close,
								children: "取消"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								type: "submit",
								disabled: saving || pickingWorkspace || !name.trim() || !workspaceId,
								children: saving ? "复制并启动中…" : "复制并启动"
							})]
						})
					]
				})
			});
		}
		function TeamCard({ team, catalog, assistants, pickWorkspace, onChanged, onCloned, compact = false }) {
			const [busy, setBusy] = (0, react.useState)(false);
			const [addingMember, setAddingMember] = (0, react.useState)(false);
			const [cloneOpen, setCloneOpen] = (0, react.useState)(false);
			const [dissolveOpen, setDissolveOpen] = (0, react.useState)(false);
			const [resetOpen, setResetOpen] = (0, react.useState)(false);
			const [memberToRemove, setMemberToRemove] = (0, react.useState)();
			const [error, setError] = (0, react.useState)();
			const members = Object.values(team.members);
			const tasks = Object.values(team.tasks);
			const executing = isTeamExecuting(team);
			async function dissolve() {
				setBusy(true);
				try {
					await callAgentTeam("team.dissolve", {
						teamId: team.id,
						confirmation: team.name
					});
					setDissolveOpen(false);
					setError(void 0);
					await onChanged();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			}
			async function resetTeam() {
				setBusy(true);
				try {
					await callAgentTeam("team.reset", {
						teamId: team.id,
						confirmation: team.name
					}, team.revision);
					setResetOpen(false);
					setError(void 0);
					await onChanged();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			}
			async function removeMember() {
				if (memberToRemove === void 0) return;
				setBusy(true);
				try {
					await callAgentTeam("team.removeMember", {
						teamId: team.id,
						slotId: memberToRemove.slotId
					}, team.revision);
					setMemberToRemove(void 0);
					setError(void 0);
					await onChanged();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			}
			async function changeLeader(successorSlotId) {
				if (successorSlotId === team.leaderSlotId) return;
				setBusy(true);
				try {
					await callAgentTeam("team.changeLeader", {
						teamId: team.id,
						successorSlotId
					}, team.revision);
					setError(void 0);
					await onChanged();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
					className: `${AgentTeam_module_css_default.card} ${compact ? AgentTeam_module_css_default.managementCard : ""}`,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: AgentTeam_module_css_default.teamCardHeader,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AgentTeam_module_css_default.teamCardIdentity,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
									className: AgentTeam_module_css_default.teamCardName,
									children: team.name
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: AgentTeam_module_css_default.teamCardWorkspace,
									children: team.workspacePath
								})]
							}), executing && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: `${AgentTeam_module_css_default.badge} ${AgentTeam_module_css_default.badgeSuccess ?? ""}`,
								children: "任务执行中"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: AgentTeam_module_css_default.teamMemberSection,
							"aria-label": "团队成员",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AgentTeam_module_css_default.teamSectionHeader,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "团队成员" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: AgentTeam_module_css_default.teamSectionActions,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [members.length, " 人"] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: AgentTeam_module_css_default.addMemberButton,
										disabled: busy,
										onClick: () => {
											setAddingMember(true);
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 14 }), "添加助手"]
									})]
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: AgentTeam_module_css_default.memberGrid,
								children: members.map((member) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: `${AgentTeam_module_css_default.memberTile} ${member.role === "leader" ? AgentTeam_module_css_default.memberTileLeader : ""}`,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: AgentTeam_module_css_default.memberTileAvatar,
											children: member.displayName.slice(0, 1).toUpperCase()
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: AgentTeam_module_css_default.memberTileCopy,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: AgentTeam_module_css_default.memberTileName,
												title: member.displayName,
												children: member.displayName
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: AgentTeam_module_css_default.memberRuntime,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: `${AgentTeam_module_css_default.statusDot} ${member.lastRuntimeState === "running" ? AgentTeam_module_css_default.statusRunning : AgentTeam_module_css_default.statusIdle}` }), memberStatusLabel(member.lastRuntimeState)]
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: AgentTeam_module_css_default.memberTileActions,
											children: [member.role === "leader" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: `${AgentTeam_module_css_default.memberRole} ${AgentTeam_module_css_default.memberRoleLeader}`,
												children: "Leader"
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: `${AgentTeam_module_css_default.memberRole} ${AgentTeam_module_css_default.memberRoleAction}`,
												disabled: busy,
												onClick: () => {
													changeLeader(member.id);
												},
												children: "设为 Leader"
											}), member.id !== team.leaderSlotId && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: AgentTeam_module_css_default.memberRemoveButton,
												disabled: busy,
												onClick: () => {
													setError(void 0);
													setMemberToRemove({
														slotId: member.id,
														displayName: member.displayName
													});
												},
												children: "移出"
											})]
										})
									]
								}, member.id))
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `${AgentTeam_module_css_default.contextResetPanel} ${AgentTeam_module_css_default.cloneTeamPanel ?? ""}`,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AgentTeam_module_css_default.contextResetCopy,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "复制团队" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "复用当前成员和配置，为所有成员创建全新 Session。" })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								disabled: busy,
								onClick: () => {
									setError(void 0);
									setCloneOpen(true);
								},
								children: "复制团队"
							})]
						}),
						tasks.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: AgentTeam_module_css_default.taskList,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
								className: AgentTeam_module_css_default.taskTitle,
								children: "任务板"
							}), tasks.map((task) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AgentTeam_module_css_default.memberRow,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: task.title }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: AgentTeam_module_css_default.muted,
									children: [TASK_STATE_LABELS[task.status] ?? task.status, task.ownerSlotId ? ` · ${team.members[task.ownerSlotId]?.displayName ?? "已移除成员"}` : ""]
								})]
							}, task.id))]
						}),
						team.state !== "deleting" && team.state !== "delete_blocked" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: AgentTeam_module_css_default.contextResetPanel,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AgentTeam_module_css_default.contextResetCopy,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "清空任务与上下文" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "停止所有成员并清空任务板，为每位成员换用全新 Session。Workspace 文件和团队配置不变。" })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: AgentTeam_module_css_default.dangerButton,
								disabled: busy,
								onClick: () => {
									setError(void 0);
									setResetOpen(true);
								},
								children: busy ? "处理中…" : "清空"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `${AgentTeam_module_css_default.contextResetPanel} ${AgentTeam_module_css_default.dissolvePanel}`,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AgentTeam_module_css_default.contextResetCopy,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "解散团队" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "永久删除团队、任务和团队消息；助手模板与 Workspace 文件保留，旧 Session 日志不再恢复。" })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: AgentTeam_module_css_default.dangerButton,
								disabled: busy || team.state === "deleting",
								onClick: () => {
									setError(void 0);
									setDissolveOpen(true);
								},
								children: team.state === "deleting" ? "解散中…" : team.state === "delete_blocked" ? "重试解散" : "解散团队"
							})]
						}),
						error && !dissolveOpen && !resetOpen && memberToRemove === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "alert",
							className: AgentTeam_module_css_default.inlineError,
							children: error
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AddTeamMemberDialog, {
					open: addingMember,
					team,
					catalog,
					assistants,
					onClose: () => {
						setAddingMember(false);
					},
					onChanged
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CloneTeamDialog, {
					open: cloneOpen,
					team,
					catalog,
					pickWorkspace,
					onClose: () => {
						setCloneOpen(false);
					},
					onCreated: onCloned
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnimatedModal, {
					open: memberToRemove !== void 0,
					onClose: () => {
						if (busy) return;
						setMemberToRemove(void 0);
						setError(void 0);
					},
					title: "移出团队成员",
					closeLabel: "关闭",
					description: "该成员将停止参与当前团队。",
					className: AgentTeam_module_css_default.memberRemoveDialog ?? "",
					footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						disabled: busy,
						onClick: () => {
							setMemberToRemove(void 0);
							setError(void 0);
						},
						children: "取消"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: `${AgentTeam_module_css_default.dangerButton} ${AgentTeam_module_css_default.confirmDangerButton}`,
						disabled: busy,
						onClick: () => {
							removeMember();
						},
						children: busy ? "移出中…" : "确认移出"
					})] }),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AgentTeam_module_css_default.memberRemoveConfirm,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: AgentTeam_module_css_default.memberRemoveIcon,
								"aria-hidden": "true",
								children: "−"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
								"确定移出“",
								memberToRemove?.displayName,
								"”？"
							] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "该成员将停止参与团队；若仍有未完成任务，系统会阻止移出。助手模板和 Session 历史都会保留。" })] }),
							error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								role: "alert",
								className: AgentTeam_module_css_default.inlineError,
								children: error
							})
						]
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnimatedModal, {
					open: resetOpen,
					onClose: () => {
						if (busy) return;
						setResetOpen(false);
						setError(void 0);
					},
					title: "清空任务与上下文",
					closeLabel: "关闭",
					description: "所有成员将换用全新的对话上下文。",
					className: AgentTeam_module_css_default.teamResetDialog ?? "",
					footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						disabled: busy,
						onClick: () => {
							setResetOpen(false);
							setError(void 0);
						},
						children: "取消"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: `${AgentTeam_module_css_default.dangerButton} ${AgentTeam_module_css_default.confirmDangerButton}`,
						disabled: busy,
						onClick: () => {
							resetTeam();
						},
						children: busy ? "清空中…" : "确认清空"
					})] }),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AgentTeam_module_css_default.teamResetConfirm,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: AgentTeam_module_css_default.teamResetIcon,
								"aria-hidden": "true",
								children: "↻"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
								"确定清空“",
								team.name,
								"”的任务与上下文？"
							] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "所有成员会停止，任务板和待处理消息会被清空，并换用全新 Session。Workspace 文件、团队配置和旧 Session 日志会保留。" })] }),
							error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								role: "alert",
								className: AgentTeam_module_css_default.inlineError,
								children: error
							})
						]
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnimatedModal, {
					open: dissolveOpen,
					onClose: () => {
						if (busy) return;
						setDissolveOpen(false);
						setError(void 0);
					},
					title: "解散团队",
					closeLabel: "关闭",
					description: "此操作无法撤销。",
					className: AgentTeam_module_css_default.teamDissolveDialog ?? "",
					footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						disabled: busy,
						onClick: () => {
							setDissolveOpen(false);
							setError(void 0);
						},
						children: "取消"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: `${AgentTeam_module_css_default.dangerButton} ${AgentTeam_module_css_default.confirmDangerButton}`,
						disabled: busy,
						onClick: () => {
							dissolve();
						},
						children: busy ? "解散中…" : "确认解散"
					})] }),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AgentTeam_module_css_default.teamDissolveConfirm,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: AgentTeam_module_css_default.teamDissolveIcon,
								"aria-hidden": "true",
								children: "!"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
								"确定解散“",
								team.name,
								"”？"
							] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "所有成员将停止，团队任务、消息和配置会被永久删除。助手模板与 Workspace 文件会保留。" })] }),
							error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								role: "alert",
								className: AgentTeam_module_css_default.inlineError,
								children: error
							})
						]
					})
				})
			] });
		}
		function workspaceName(path) {
			return path.replace(/[/\\]+$/, "").split(/[/\\]/).at(-1) || "Workspace";
		}
		function TeamForm({ catalog, assistants, pickWorkspace, onCancel, onCreated }) {
			const catalogWorkspaces = catalog?.workspaces.filter((workspace) => workspace.status === "ok") ?? [];
			const [name, setName] = (0, react.useState)("");
			const [workspaceId, setWorkspaceId] = (0, react.useState)(catalogWorkspaces[0]?.id ?? "");
			const [pickedWorkspace, setPickedWorkspace] = (0, react.useState)();
			const [query, setQuery] = (0, react.useState)("");
			const [members, setMembers] = (0, react.useState)([]);
			const [leaderKey, setLeaderKey] = (0, react.useState)();
			const [directMemberChat, setDirectMemberChat] = (0, react.useState)(true);
			const [saving, setSaving] = (0, react.useState)(false);
			const [pickingWorkspace, setPickingWorkspace] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)();
			const workspaces = (0, react.useMemo)(() => {
				if (pickedWorkspace === void 0 || catalogWorkspaces.some((workspace) => workspace.id === pickedWorkspace.id)) return catalogWorkspaces;
				return [...catalogWorkspaces, {
					...pickedWorkspace,
					status: "ok"
				}];
			}, [catalogWorkspaces, pickedWorkspace]);
			const byId = (0, react.useMemo)(() => new Map(assistants.map((assistant) => [assistant.id, assistant])), [assistants]);
			const filteredAssistants = (0, react.useMemo)(() => {
				const normalized = query.trim().toLocaleLowerCase();
				if (!normalized) return assistants;
				return assistants.filter((assistant) => [
					assistant.name,
					assistant.description,
					assistant.provider,
					assistant.model
				].some((value) => value?.toLocaleLowerCase().includes(normalized)));
			}, [assistants, query]);
			(0, react.useEffect)(() => {
				if (!workspaceId && workspaces[0]) setWorkspaceId(workspaces[0].id);
			}, [workspaceId, workspaces]);
			async function chooseWorkspace() {
				setPickingWorkspace(true);
				try {
					const workspace = await pickWorkspace();
					if (workspace === null) return;
					setPickedWorkspace(workspace);
					setWorkspaceId(workspace.id);
					setError(void 0);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setPickingWorkspace(false);
				}
			}
			function addAssistant(assistant) {
				const member = {
					key: crypto.randomUUID(),
					assistantId: assistant.id
				};
				setMembers((current) => [...current, member]);
				setLeaderKey((current) => current ?? member.key);
			}
			function removeMember(key) {
				const remaining = members.filter((member) => member.key !== key);
				setMembers(remaining);
				if (leaderKey === key) setLeaderKey(remaining[0]?.key);
			}
			async function submit(event) {
				event.preventDefault();
				if (leaderKey === void 0 || members.length === 0) return;
				setSaving(true);
				try {
					const draft = await callAgentTeam("team.createDraft", {
						name,
						workspaceId,
						directMemberChat,
						members: members.map((member) => ({
							assistantId: member.assistantId,
							role: member.key === leaderKey ? "leader" : "member"
						}))
					});
					await callAgentTeam("team.start", { id: draft.id }, draft.revision);
					await onCreated(draft.id);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setSaving(false);
				}
			}
			const canSubmit = name.trim().length > 0 && workspaceId.length > 0 && leaderKey !== void 0 && members.length > 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
				onSubmit: (event) => {
					submit(event);
				},
				className: AgentTeam_module_css_default.teamBuilderForm,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AgentTeam_module_css_default.teamBuilderGrid,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: AgentTeam_module_css_default.assistantPicker,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: AgentTeam_module_css_default.builderSectionHeading,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: ["所有助手 ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: AgentTeam_module_css_default.count,
										children: assistants.length
									})] })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "search",
									value: query,
									onChange: (event) => {
										setQuery(event.target.value);
									},
									placeholder: "搜索助手、Provider 或模型",
									"aria-label": "搜索助手",
									className: AgentTeam_module_css_default.builderSearch
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: AgentTeam_module_css_default.assistantPickList,
									children: [filteredAssistants.map((assistant) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: AgentTeam_module_css_default.assistantPickRow,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: AgentTeam_module_css_default.assistantPickAvatar,
												"aria-hidden": "true",
												children: assistant.name.slice(0, 1).toLocaleUpperCase()
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: AgentTeam_module_css_default.assistantPickCopy,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: assistant.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
													assistant.provider,
													" / ",
													assistant.model
												] })]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: AgentTeam_module_css_default.assistantAddButton,
												onClick: () => {
													addAssistant(assistant);
												},
												"aria-label": `添加 ${assistant.name}`,
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 16 })
											})
										]
									}, assistant.id)), filteredAssistants.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, { text: "没有匹配的助手" })]
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: AgentTeam_module_css_default.selectedMembers,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: AgentTeam_module_css_default.builderSectionHeading,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: ["已选成员 ", members.length] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "选择团队成员并指定一个 Leader。同一助手可多次选择。" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: AgentTeam_module_css_default.leaderLegend,
										children: "Leader"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: AgentTeam_module_css_default.selectedMemberList,
									children: members.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: AgentTeam_module_css_default.memberEmpty,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "至少选择一个助手当团队 Leader。" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "从左侧助手列表添加成员。" })]
									}) : members.map((member) => {
										const assistant = byId.get(member.assistantId);
										const leader = member.key === leaderKey;
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: `${AgentTeam_module_css_default.selectedMemberRow} ${leader ? AgentTeam_module_css_default.selectedLeader : ""}`,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: AgentTeam_module_css_default.assistantPickAvatar,
													"aria-hidden": "true",
													children: assistant?.name.slice(0, 1).toLocaleUpperCase() ?? "?"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: AgentTeam_module_css_default.selectedMemberCopy,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: assistant?.name ?? "助手" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
														assistant?.provider,
														" / ",
														assistant?.model
													] })]
												}),
												leader ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: AgentTeam_module_css_default.leaderBadge,
													children: "Leader"
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: AgentTeam_module_css_default.setLeaderButton,
													onClick: () => {
														setLeaderKey(member.key);
													},
													children: "设为 Leader"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: AgentTeam_module_css_default.removeDraftMember,
													onClick: () => {
														removeMember(member.key);
													},
													"aria-label": `移除 ${assistant?.name ?? "助手"}`,
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, { size: 14 })
												})
											]
										}, member.key);
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: AgentTeam_module_css_default.teamFields,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
											label: "团队名称",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												required: true,
												value: name,
												onChange: (event) => {
													setName(event.target.value);
												},
												placeholder: "输入团队名称",
												className: AgentTeam_module_css_default.input
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
											label: "Workspace",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: AgentTeam_module_css_default.workspacePickerRow,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
													required: true,
													value: workspaceId,
													onChange: (event) => {
														setWorkspaceId(event.target.value);
													},
													className: AgentTeam_module_css_default.input,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: "",
														children: workspaces.length === 0 ? "暂无 Workspace" : "请选择 Workspace"
													}), workspaces.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
														value: item.id,
														children: [
															item.title,
															" — ",
															item.path
														]
													}, item.id))]
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
													variant: "outline",
													type: "button",
													disabled: pickingWorkspace || saving,
													onClick: () => {
														chooseWorkspace();
													},
													className: AgentTeam_module_css_default.workspacePickButton,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutline16, { size: 16 }), pickingWorkspace ? "选择中…" : "选择文件夹"]
												})]
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: AgentTeam_module_css_default.checkboxRow,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: directMemberChat,
												onChange: (event) => {
													setDirectMemberChat(event.target.checked);
												}
											}), "允许用户和普通成员直接通信"]
										})
									]
								})
							]
						})]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						role: "alert",
						className: AgentTeam_module_css_default.inlineError,
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AgentTeam_module_css_default.teamBuilderActions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: onCancel,
							disabled: saving,
							children: "取消"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							type: "submit",
							disabled: saving || !canSubmit,
							children: saving ? "创建并启动中…" : "创建并启动"
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/components.tsx
		const floatingLauncherStorageKey = "dsh-agent-team:floating-launcher-position";
		const floatingLauncherMargin = 8;
		const floatingLauncherWidth = 42;
		const floatingLauncherExpandedWidth = 90;
		const floatingLauncherHeight = 42;
		const floatingLauncherDockThreshold = 8;
		function defaultFloatingLauncherPlacement() {
			return {
				position: {
					x: 16,
					y: Math.round(window.innerHeight * .62)
				},
				side: "left"
			};
		}
		function clampFloatingLauncherPosition(position) {
			return {
				x: Math.min(Math.max(floatingLauncherMargin, position.x), Math.max(floatingLauncherMargin, window.innerWidth - floatingLauncherWidth - floatingLauncherMargin)),
				y: Math.min(Math.max(floatingLauncherMargin, position.y), Math.max(floatingLauncherMargin, window.innerHeight - floatingLauncherHeight - floatingLauncherMargin))
			};
		}
		function clampFloatingLauncherDragPosition(position) {
			return {
				x: Math.min(Math.max(floatingLauncherMargin, position.x), Math.max(floatingLauncherMargin, window.innerWidth - floatingLauncherExpandedWidth - floatingLauncherMargin)),
				y: Math.min(Math.max(floatingLauncherMargin, position.y), Math.max(floatingLauncherMargin, window.innerHeight - floatingLauncherHeight - floatingLauncherMargin))
			};
		}
		function floatingLauncherSide(position) {
			return position.x + floatingLauncherWidth / 2 > window.innerWidth / 2 ? "right" : "left";
		}
		function isFloatingLauncherDocked(position) {
			const maxX = Math.max(floatingLauncherMargin, window.innerWidth - floatingLauncherWidth - floatingLauncherMargin);
			return position.x <= 16 || position.x >= maxX - floatingLauncherDockThreshold;
		}
		function readFloatingLauncherPlacement() {
			try {
				const stored = window.localStorage.getItem(floatingLauncherStorageKey);
				if (stored === null) return void 0;
				const parsed = JSON.parse(stored);
				if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return void 0;
				const position = {
					x: parsed.x,
					y: parsed.y
				};
				return {
					position,
					side: parsed.side === "left" || parsed.side === "right" ? parsed.side : floatingLauncherSide(position)
				};
			} catch {
				return;
			}
		}
		function storeFloatingLauncherPlacement(placement) {
			try {
				window.localStorage.setItem(floatingLauncherStorageKey, JSON.stringify({
					...placement.position,
					side: placement.side
				}));
			} catch {}
		}
		function FloatingTeamLauncher({ hasExecutingTeam }) {
			const [placement, setPlacement] = (0, react.useState)();
			const [dragPosition, setDragPosition] = (0, react.useState)();
			const [dragging, setDragging] = (0, react.useState)(false);
			const [dockSettled, setDockSettled] = (0, react.useState)(false);
			const [tooltipSuppressed, setTooltipSuppressed] = (0, react.useState)(false);
			const dragRef = (0, react.useRef)();
			const suppressClickRef = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				const stored = readFloatingLauncherPlacement() ?? defaultFloatingLauncherPlacement();
				const initialPosition = clampFloatingLauncherPosition(stored.position);
				setPlacement({
					position: initialPosition,
					side: isFloatingLauncherDocked(initialPosition) ? floatingLauncherSide(initialPosition) : stored.side
				});
				const handleResize = () => {
					setPlacement((current) => {
						const fallback = current ?? defaultFloatingLauncherPlacement();
						const position = clampFloatingLauncherPosition(fallback.position);
						return {
							position,
							side: isFloatingLauncherDocked(position) ? floatingLauncherSide(position) : fallback.side
						};
					});
				};
				window.addEventListener("resize", handleResize);
				return () => {
					window.removeEventListener("resize", handleResize);
				};
			}, []);
			const finishDrag = (event) => {
				const drag = dragRef.current;
				if (drag === void 0 || drag.pointerId !== event.pointerId) return;
				if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
				if (drag.moved) {
					const maxDragX = Math.max(floatingLauncherMargin, window.innerWidth - floatingLauncherExpandedWidth - floatingLauncherMargin);
					const dockedLeft = drag.position.x <= 16;
					const dockedRight = drag.position.x >= maxDragX - floatingLauncherDockThreshold;
					const docked = dockedLeft || dockedRight;
					const side = dockedLeft ? "left" : dockedRight ? "right" : drag.position.x + floatingLauncherExpandedWidth / 2 > window.innerWidth / 2 ? "right" : "left";
					const nextPlacement = {
						position: clampFloatingLauncherPosition({
							x: dockedLeft ? floatingLauncherMargin : dockedRight ? Math.max(floatingLauncherMargin, window.innerWidth - floatingLauncherWidth - floatingLauncherMargin) : side === "right" ? drag.position.x + floatingLauncherExpandedWidth - floatingLauncherWidth : drag.position.x,
							y: drag.position.y
						}),
						side
					};
					setPlacement(nextPlacement);
					storeFloatingLauncherPlacement(nextPlacement);
					setDockSettled(docked);
				}
				suppressClickRef.current = drag.moved;
				dragRef.current = void 0;
				setDragPosition(void 0);
				setDragging(false);
			};
			const style = dragPosition !== void 0 ? {
				left: dragPosition.x,
				right: "auto",
				top: dragPosition.y
			} : placement === void 0 ? void 0 : placement.side === "right" ? {
				left: "auto",
				right: Math.max(floatingLauncherMargin, window.innerWidth - placement.position.x - floatingLauncherWidth),
				top: placement.position.y
			} : {
				left: placement.position.x,
				top: placement.position.y
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: "打开团队工作台",
				delayMs: 400,
				disabled: dragging || tooltipSuppressed,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: `${AgentTeam_module_css_default.floatingTeamLauncher} ${dragging ? AgentTeam_module_css_default.floatingTeamLauncherDragging : ""} ${dockSettled ? AgentTeam_module_css_default.floatingTeamLauncherSettled : ""}`,
					style,
					onClick: () => {
						if (suppressClickRef.current) {
							suppressClickRef.current = false;
							return;
						}
						openTeams();
					},
					onPointerDown: (event) => {
						if (event.button !== 0) return;
						setTooltipSuppressed(true);
						const currentPlacement = placement ?? defaultFloatingLauncherPlacement();
						const current = clampFloatingLauncherPosition(currentPlacement.position);
						const currentDragPosition = clampFloatingLauncherDragPosition({
							x: currentPlacement.side === "right" ? current.x - 48 : current.x,
							y: current.y
						});
						dragRef.current = {
							pointerId: event.pointerId,
							pointerX: event.clientX,
							pointerY: event.clientY,
							startX: currentDragPosition.x,
							startY: currentDragPosition.y,
							position: currentDragPosition,
							moved: false
						};
						suppressClickRef.current = false;
						setDockSettled(false);
						setDragPosition(currentDragPosition);
						event.currentTarget.setPointerCapture(event.pointerId);
						setDragging(true);
					},
					onPointerMove: (event) => {
						const drag = dragRef.current;
						if (drag === void 0 || drag.pointerId !== event.pointerId) return;
						const deltaX = event.clientX - drag.pointerX;
						const deltaY = event.clientY - drag.pointerY;
						if (!drag.moved && Math.hypot(deltaX, deltaY) < 4) return;
						drag.moved = true;
						drag.position = clampFloatingLauncherDragPosition({
							x: drag.startX + deltaX,
							y: drag.startY + deltaY
						});
						setDragPosition(drag.position);
					},
					onPointerUp: finishDrag,
					onPointerCancel: (event) => {
						finishDrag(event);
						suppressClickRef.current = false;
						setDockSettled(false);
						setDragPosition(void 0);
					},
					onPointerLeave: () => {
						if (!dragging) setDockSettled(false);
					},
					onMouseLeave: () => {
						setTooltipSuppressed(false);
					},
					"aria-label": hasExecutingTeam ? "打开团队工作台，有团队正在执行任务" : "打开团队工作台",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: AgentTeam_module_css_default.floatingTeamLauncherIcon,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconAgentPresetOutline16, { size: 18 }), hasExecutingTeam && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: AgentTeam_module_css_default.floatingTeamLauncherState,
							"aria-hidden": "true"
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: AgentTeam_module_css_default.floatingTeamLauncherLabel,
						children: "团队"
					})]
				})
			});
		}
		function useAgentTeamData(includeTeams, active = true) {
			const [catalog, setCatalog] = (0, react.useState)();
			const [assistants, setAssistants] = (0, react.useState)([]);
			const [teams, setTeams] = (0, react.useState)([]);
			const [loading, setLoading] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)();
			const load = (0, react.useCallback)(async () => {
				setLoading(true);
				setError(void 0);
				try {
					callAgentTeam("catalog.get").then((value) => {
						setCatalog(value);
					}).catch((cause) => {
						const message = cause instanceof Error ? cause.message : String(cause);
						setError((current) => current === void 0 ? message : `${current}；${message}`);
					});
					const coreRequests = [callAgentTeam("assistant.list").then((value) => {
						setAssistants(value.items);
					}), includeTeams ? callAgentTeam("team.list").then((value) => {
						setTeams(value.items);
					}) : Promise.resolve().then(() => {
						setTeams([]);
					})];
					const failures = (await Promise.allSettled(coreRequests)).filter((result) => result.status === "rejected").map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
					if (failures.length > 0) setError(failures.join("；"));
				} finally {
					setLoading(false);
				}
			}, [includeTeams]);
			(0, react.useEffect)(() => {
				if (!active) return;
				load();
				return subscribeAgentTeam(() => {
					load();
				}, () => {
					setError("事件连接已断开，正在等待重连");
				});
			}, [active, load]);
			return {
				catalog,
				assistants,
				teams,
				loading,
				error,
				load
			};
		}
		function AgentTeamSettingsSection(_props) {
			const { catalog, assistants, loading, error, load } = useAgentTeamData(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: AgentTeam_module_css_default.settingsSection,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AgentTeam_module_css_default.settingsHeading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
							className: AgentTeam_module_css_default.settingsTitle,
							children: "Agent 团队"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: AgentTeam_module_css_default.settingsDescription,
							children: "管理可在不同团队间复用的助手、模型和权限配置。"
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							size: "sm",
							onClick: () => {
								load();
							},
							disabled: loading,
							children: loading ? "刷新中…" : "刷新"
						})]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						role: "alert",
						className: AgentTeam_module_css_default.error,
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AssistantPanel, {
						catalog,
						assistants,
						onChanged: load
					})
				]
			});
		}
		function AgentTeamOverlay({ pickWorkspace }) {
			const { visible, createTeamRequest, selectedTeamId } = useAgentTeamUi();
			const { catalog, assistants, teams, error, load } = useAgentTeamData(true);
			const selectedTeam = teams.find((team) => team.id === selectedTeamId);
			const hasExecutingTeam = teams.some(isTeamExecuting);
			const headerTitle = selectedTeam?.name ?? "Agent 团队";
			const headerSubtitle = selectedTeam === void 0 ? "多个平级 Agent，共享一个 Workspace" : `${Object.keys(selectedTeam.members).length} 名成员 · ${selectedTeam.workspacePath}`;
			if (!visible) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FloatingTeamLauncher, { hasExecutingTeam });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: AgentTeam_module_css_default.fullscreenWorkbench,
				"aria-label": "Agent 团队工作台",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
					className: AgentTeam_module_css_default.teamNavigator,
					"aria-label": "团队列表",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: AgentTeam_module_css_default.teamNavigatorHeader,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: AgentTeam_module_css_default.teamNavigatorTitle,
								onClick: openTeams,
								"aria-label": "查看全部团队",
								"aria-current": selectedTeamId === void 0 ? "page" : void 0,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconAgentPresetOutline16, { size: 18 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "团队" })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: "组建团队",
								delayMs: 400,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: AgentTeam_module_css_default.teamNavigatorAdd,
									onClick: openTeamCreator,
									"aria-label": "组建团队",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 16 })
								})
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: AgentTeam_module_css_default.teamNavigatorList,
							children: teams.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: AgentTeam_module_css_default.teamNavigatorEmpty,
								children: "还没有团队"
							}) : teams.map((team) => {
								const isSelected = team.id === selectedTeamId;
								const executing = isTeamExecuting(team);
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: `${AgentTeam_module_css_default.teamNavigatorItem} ${isSelected ? AgentTeam_module_css_default.teamNavigatorItemActive : ""}`,
									onClick: () => {
										openTeam(team.id);
									},
									"aria-current": isSelected ? "page" : void 0,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: AgentTeam_module_css_default.teamNavigatorItemTop,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: team.name }), executing && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `${AgentTeam_module_css_default.badge} ${AgentTeam_module_css_default.badgeSuccess}`,
											children: "任务执行中"
										})]
									})
								}, team.id);
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: AgentTeam_module_css_default.teamNavigatorFooter,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [teams.length, " 个团队"] })
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: AgentTeam_module_css_default.fullscreenWorkbenchMain,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: AgentTeam_module_css_default.shellHeader,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: AgentTeam_module_css_default.headerCopy,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: AgentTeam_module_css_default.shellTitleRow,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
										className: AgentTeam_module_css_default.title,
										title: headerTitle,
										children: headerTitle
									}), selectedTeam !== void 0 && isTeamExecuting(selectedTeam) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: `${AgentTeam_module_css_default.badge} ${AgentTeam_module_css_default.badgeSuccess ?? ""}`,
										children: "任务执行中"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: AgentTeam_module_css_default.subtitle,
									title: headerSubtitle,
									children: headerSubtitle
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: AgentTeam_module_css_default.iconButton,
								onClick: closeAgentTeam,
								"aria-label": "关闭工作台",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, { size: 16 })
							})]
						}),
						error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "alert",
							className: AgentTeam_module_css_default.error,
							children: error
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("main", {
							className: `${AgentTeam_module_css_default.content} ${selectedTeam === void 0 ? "" : AgentTeam_module_css_default.workbenchContent ?? ""}`,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TeamPanel, {
								catalog,
								assistants,
								teams,
								createRequest: createTeamRequest,
								selectedTeamId,
								pickWorkspace,
								onChanged: load
							})
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/index.tsx
		const name = "agent-team-client";
		const inject = ["slots", "workspaces"];
		function apply(ctx) {
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "agent-team",
				order: 40,
				label: "Agent 团队"
			}, AgentTeamSettingsSection));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "agent-team",
				order: 20,
				label: "团队",
				inject: () => ({ pickWorkspace: async () => {
					const path = await ctx.workspaces.pickDirectory();
					if (path === null) return null;
					const workspace = await ctx.workspaces.create({ path });
					return {
						id: workspace.workspaceId,
						path: workspace.path,
						title: workspace.title
					};
				} })
			}, AgentTeamOverlay));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map