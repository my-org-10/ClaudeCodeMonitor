import { useCallback } from "react";
import type { Dispatch, MutableRefObject } from "react";
import type { PermissionDenial } from "../../../types";
import {
  getApprovalCommandInfo,
  matchesCommandPrefix,
} from "../../../utils/approvalRules";
import type { ThreadAction } from "./useThreadsReducer";

type PermissionDeniedEvent = {
  workspaceId: string;
  threadId: string;
  turnId: string;
  denials: PermissionDenial[];
};

type UseThreadApprovalEventsOptions = {
  dispatch: Dispatch<ThreadAction>;
  approvalAllowlistRef: MutableRefObject<Record<string, string[][]>>;
};

export function useThreadApprovalEvents({
  dispatch,
  approvalAllowlistRef,
}: UseThreadApprovalEventsOptions): (event: PermissionDeniedEvent) => void {
  return useCallback(
    (event: PermissionDeniedEvent) => {
      const { workspaceId, threadId, denials } = event;
      const allowlist = approvalAllowlistRef.current[workspaceId] ?? [];

      const remaining: PermissionDenial[] = [];

      for (const denial of denials) {
        if (denial.tool_name === "AskUserQuestion") {
          dispatch({
            type: "clearUserInputRequestsForThread",
            threadId,
            workspaceId,
          });
        }

        const toolInput = denial.tool_input ?? {};
        const commandInfo = getApprovalCommandInfo(toolInput);

        if (commandInfo && matchesCommandPrefix(commandInfo.tokens, allowlist)) {
          continue;
        }

        remaining.push(denial);
      }

      if (remaining.length > 0) {
        dispatch({ type: "addPermissionDenials", denials: remaining });
      }
    },
    [approvalAllowlistRef, dispatch],
  );
}
