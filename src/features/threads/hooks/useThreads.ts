import { useCallback, useReducer, useRef } from "react";
import * as Sentry from "@sentry/react";
import type {
  CustomPromptOption,
  DebugEntry,
  PermissionDenial,
  WorkspaceInfo,
} from "../../../types";
import {
  type ApprovalRuleInfo,
} from "../../../utils/approvalRules";
import {
  interruptTurn as interruptTurnService,
} from "../../../services/tauri";
import { useAppServerEvents } from "../../app/hooks/useAppServerEvents";
import { initialState, threadReducer } from "./useThreadsReducer";
import { useThreadStorage } from "./useThreadStorage";
import { useThreadLinking } from "./useThreadLinking";
import { useThreadEventHandlers } from "./useThreadEventHandlers";
import { useThreadActions } from "./useThreadActions";
import { useThreadMessaging } from "./useThreadMessaging";
import { useThreadApprovals } from "./useThreadApprovals";
import { useThreadSelectors } from "./useThreadSelectors";
import { useThreadStatus } from "./useThreadStatus";
import { useThreadUserInput } from "./useThreadUserInput";
import { makeCustomNameKey, saveCustomName } from "../utils/threadStorage";

type LastPrompt = { workspace: WorkspaceInfo; text: string; images: string[] };

type UseThreadsOptions = {
  activeWorkspace: WorkspaceInfo | null;
  onWorkspaceConnected: (id: string) => void;
  onDebug?: (entry: DebugEntry) => void;
  model?: string | null;
  effort?: string | null;
  collaborationMode?: Record<string, unknown> | null;
  accessMode?: "read-only" | "current" | "full-access";
  steerEnabled?: boolean;
  customPrompts?: CustomPromptOption[];
  onMessageActivity?: () => void;
};

export function useThreads({
  activeWorkspace,
  onWorkspaceConnected,
  onDebug,
  model,
  effort,
  collaborationMode,
  accessMode,
  steerEnabled = false,
  customPrompts = [],
  onMessageActivity,
}: UseThreadsOptions) {
  const [state, dispatch] = useReducer(threadReducer, initialState);
  const loadedThreadsRef = useRef<Record<string, boolean>>({});
  const replaceOnResumeRef = useRef<Record<string, boolean>>({});
  const pendingInterruptsRef = useRef<Set<string>>(new Set());
  const lastPromptByThreadRef = useRef<Record<string, LastPrompt>>({});

  const {
    approvalAllowlistRef,
    rememberApprovalPrefix,
    handlePermissionRemember,
    handlePermissionDismiss,
  } = useThreadApprovals({ dispatch, onDebug });

  const { handleUserInputSubmit } = useThreadUserInput({ dispatch });

  const {
    customNamesRef,
    threadActivityRef,
    pinnedThreadsVersion,
    getCustomName,
    recordThreadActivity,
    pinThread,
    unpinThread,
    isThreadPinned,
    getPinTimestamp,
  } = useThreadStorage();
  void pinnedThreadsVersion;

  const activeWorkspaceId = activeWorkspace?.id ?? null;

  const { activeThreadId, activeItems } = useThreadSelectors({
    activeWorkspaceId,
    activeThreadIdByWorkspace: state.activeThreadIdByWorkspace,
    itemsByThread: state.itemsByThread,
  });

  const { markProcessing, markReviewing, setActiveTurnId } = useThreadStatus({
    dispatch,
  });

  const pushThreadErrorMessage = useCallback(
    (threadId: string, message: string) => {
      dispatch({
        type: "addAssistantMessage",
        threadId,
        text: message,
      });
      if (threadId !== activeThreadId) {
        dispatch({ type: "markUnread", threadId, hasUnread: true });
      }
    },
    [activeThreadId],
  );

  const safeMessageActivity = useCallback(() => {
    try {
      void onMessageActivity?.();
    } catch {
      // Ignore refresh errors to avoid breaking the UI.
    }
  }, [onMessageActivity]);

  const { applyCollabThreadLinks, applyCollabThreadLinksFromThread } =
    useThreadLinking({
      dispatch,
      threadParentById: state.threadParentById,
    });

  const handlers = useThreadEventHandlers({
    activeThreadId,
    dispatch,
    getCustomName,
    markProcessing,
    markReviewing,
    setActiveTurnId,
    safeMessageActivity,
    recordThreadActivity,
    pushThreadErrorMessage,
    onDebug,
    onWorkspaceConnected,
    applyCollabThreadLinks,
    approvalAllowlistRef,
    pendingInterruptsRef,
  });

  useAppServerEvents(handlers);

  const {
    startThreadForWorkspace,
    resumeThreadForWorkspace,
    refreshThread,
    resetWorkspaceThreads,
    listThreadsForWorkspace,
    loadOlderThreadsForWorkspace,
    archiveThread,
  } = useThreadActions({
    dispatch,
    itemsByThread: state.itemsByThread,
    threadsByWorkspace: state.threadsByWorkspace,
    activeThreadIdByWorkspace: state.activeThreadIdByWorkspace,
    threadListCursorByWorkspace: state.threadListCursorByWorkspace,
    onDebug,
    getCustomName,
    threadActivityRef,
    loadedThreadsRef,
    replaceOnResumeRef,
    applyCollabThreadLinksFromThread,
  });

  const startThread = useCallback(async () => {
    if (!activeWorkspaceId) {
      return null;
    }
    return startThreadForWorkspace(activeWorkspaceId);
  }, [activeWorkspaceId, startThreadForWorkspace]);

  const ensureThreadForActiveWorkspace = useCallback(async () => {
    if (!activeWorkspace) {
      return null;
    }
    let threadId = activeThreadId;
    if (!threadId) {
      threadId = await startThreadForWorkspace(activeWorkspace.id);
      if (!threadId) {
        return null;
      }
    } else if (!loadedThreadsRef.current[threadId]) {
      await resumeThreadForWorkspace(activeWorkspace.id, threadId);
    }
    return threadId;
  }, [activeWorkspace, activeThreadId, resumeThreadForWorkspace, startThreadForWorkspace]);

  const {
    interruptTurn,
    sendUserMessage,
    sendUserMessageToThread,
    sendMessageToThread,
    startReview,
  } = useThreadMessaging({
    activeWorkspace,
    activeThreadId,
    accessMode,
    model,
    effort,
    collaborationMode,
    steerEnabled,
    customPrompts,
    threadStatusById: state.threadStatusById,
    activeTurnIdByThread: state.activeTurnIdByThread,
    pendingInterruptsRef,
    dispatch,
    getCustomName,
    markProcessing,
    markReviewing,
    setActiveTurnId,
    recordThreadActivity,
    safeMessageActivity,
    onDebug,
    pushThreadErrorMessage,
    ensureThreadForActiveWorkspace,
    lastPromptByThreadRef,
  });

  const handlePermissionRetry = useCallback(
    async (denial: PermissionDenial, ruleInfo: ApprovalRuleInfo) => {
      try {
        const { rememberApprovalRule } = await import("../../../services/tauri");
        await rememberApprovalRule(denial.workspace_id, ruleInfo.rule);
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-permission-retry-rule-error`,
          timestamp: Date.now(),
          source: "error",
          label: "permission retry rule error",
          payload: error instanceof Error ? error.message : String(error),
        });
      }

      if (ruleInfo.commandTokens) {
        rememberApprovalPrefix(denial.workspace_id, ruleInfo.commandTokens);
      }

      dispatch({ type: "removePermissionDenial", denialId: denial.id });

      const lastPrompt = lastPromptByThreadRef.current[denial.thread_id];
      if (!lastPrompt || lastPrompt.workspace.id !== denial.workspace_id) {
        pushThreadErrorMessage(
          denial.thread_id,
          "No recent prompt available to retry.",
        );
        return;
      }

      try {
        await interruptTurnService(
          denial.workspace_id,
          denial.thread_id,
          denial.turn_id || "pending",
        );
        await sendMessageToThread(
          lastPrompt.workspace,
          denial.thread_id,
          lastPrompt.text,
          lastPrompt.images,
          { skipPromptExpansion: true },
        );
      } catch (error) {
        pushThreadErrorMessage(
          denial.thread_id,
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    [
      onDebug,
      pushThreadErrorMessage,
      rememberApprovalPrefix,
      sendMessageToThread,
    ],
  );

  const setActiveThreadId = useCallback(
    (threadId: string | null, workspaceId?: string) => {
      const targetId = workspaceId ?? activeWorkspaceId;
      if (!targetId) {
        return;
      }
      dispatch({ type: "setActiveThreadId", workspaceId: targetId, threadId });
      if (threadId) {
        Sentry.metrics.count("thread_switched", 1, {
          attributes: {
            workspace_id: targetId,
            thread_id: threadId,
            reason: "select",
          },
        });
        void resumeThreadForWorkspace(targetId, threadId, true);
      }
    },
    [activeWorkspaceId, resumeThreadForWorkspace],
  );

  const removeThread = useCallback(
    (workspaceId: string, threadId: string) => {
      unpinThread(workspaceId, threadId);
      dispatch({ type: "removeThread", workspaceId, threadId });
      void archiveThread(workspaceId, threadId);
    },
    [archiveThread, unpinThread],
  );

  const renameThread = useCallback(
    (workspaceId: string, threadId: string, newName: string) => {
      saveCustomName(workspaceId, threadId, newName);
      const key = makeCustomNameKey(workspaceId, threadId);
      customNamesRef.current[key] = newName;
      dispatch({ type: "setThreadName", workspaceId, threadId, name: newName });
    },
    [customNamesRef],
  );

  return {
    activeThreadId,
    setActiveThreadId,
    activeItems,
    permissionDenials: state.permissionDenials,
    userInputRequests: state.userInputRequests,
    threadsByWorkspace: state.threadsByWorkspace,
    threadParentById: state.threadParentById,
    threadStatusById: state.threadStatusById,
    threadListLoadingByWorkspace: state.threadListLoadingByWorkspace,
    threadListPagingByWorkspace: state.threadListPagingByWorkspace,
    threadListCursorByWorkspace: state.threadListCursorByWorkspace,
    activeTurnIdByThread: state.activeTurnIdByThread,
    tokenUsageByThread: state.tokenUsageByThread,
    planByThread: state.planByThread,
    lastAgentMessageByThread: state.lastAgentMessageByThread,
    interruptTurn,
    removeThread,
    pinThread,
    unpinThread,
    isThreadPinned,
    getPinTimestamp,
    renameThread,
    startThread,
    startThreadForWorkspace,
    listThreadsForWorkspace,
    refreshThread,
    resetWorkspaceThreads,
    loadOlderThreadsForWorkspace,
    sendUserMessage,
    sendUserMessageToThread,
    startReview,
    handlePermissionRemember,
    handlePermissionRetry,
    handlePermissionDismiss,
    handleUserInputSubmit,
  };
}
