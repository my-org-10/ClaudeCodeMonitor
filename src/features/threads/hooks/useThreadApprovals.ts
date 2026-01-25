import { useCallback, useRef } from "react";
import type { Dispatch } from "react";
import type { DebugEntry, PermissionDenial } from "../../../types";
import type { ApprovalRuleInfo } from "../../../utils/approvalRules";
import { normalizeCommandTokens } from "../../../utils/approvalRules";
import { rememberApprovalRule } from "../../../services/tauri";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadApprovalsOptions = {
  dispatch: Dispatch<ThreadAction>;
  onDebug?: (entry: DebugEntry) => void;
};

export function useThreadApprovals({ dispatch, onDebug }: UseThreadApprovalsOptions) {
  const approvalAllowlistRef = useRef<Record<string, string[][]>>({});

  const rememberApprovalPrefix = useCallback((workspaceId: string, command: string[]) => {
    const normalized = normalizeCommandTokens(command);
    if (!normalized.length) {
      return;
    }
    const allowlist = approvalAllowlistRef.current[workspaceId] ?? [];
    const exists = allowlist.some(
      (entry) =>
        entry.length === normalized.length &&
        entry.every((token, index) => token === normalized[index]),
    );
    if (!exists) {
      approvalAllowlistRef.current = {
        ...approvalAllowlistRef.current,
        [workspaceId]: [...allowlist, normalized],
      };
    }
  }, []);

  const handlePermissionRemember = useCallback(
    async (denial: PermissionDenial, ruleInfo: ApprovalRuleInfo) => {
      try {
        await rememberApprovalRule(denial.workspace_id, ruleInfo.rule);
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-permission-rule-error`,
          timestamp: Date.now(),
          source: "error",
          label: "permission rule error",
          payload: error instanceof Error ? error.message : String(error),
        });
      }

      if (ruleInfo.commandTokens) {
        rememberApprovalPrefix(denial.workspace_id, ruleInfo.commandTokens);
      }

      dispatch({ type: "removePermissionDenial", denialId: denial.id });
    },
    [dispatch, onDebug, rememberApprovalPrefix],
  );

  const handlePermissionDismiss = useCallback(
    (denial: PermissionDenial) => {
      dispatch({ type: "removePermissionDenial", denialId: denial.id });
    },
    [dispatch],
  );

  return {
    approvalAllowlistRef,
    rememberApprovalPrefix,
    handlePermissionRemember,
    handlePermissionDismiss,
  };
}
