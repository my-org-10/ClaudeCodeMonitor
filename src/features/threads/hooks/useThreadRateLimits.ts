import { useCallback } from "react";

/**
 * Stub: Rate limits are currently managed by useGlobalRateLimits.
 * This hook exists to match upstream's modular structure and can be
 * activated when rate limits are migrated into the thread system.
 */
export function useThreadRateLimits() {
  const refreshAccountRateLimits = useCallback(
    async (_workspaceId?: string) => {
      // No-op: rate limits handled by useGlobalRateLimits
    },
    [],
  );

  return { refreshAccountRateLimits };
}
