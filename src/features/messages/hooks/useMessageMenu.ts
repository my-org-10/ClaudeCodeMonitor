import type { MouseEvent } from "react";
import { useCallback } from "react";
import { Menu, MenuItem } from "@tauri-apps/api/menu";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";

type MessageMenuActions = {
  canRewind: boolean;
  onFork: () => void | Promise<void>;
  onRewind: () => void | Promise<void>;
  onForkAndRewind: () => void | Promise<void>;
};

export function useMessageMenu() {
  return useCallback(async (event: MouseEvent, actions: MessageMenuActions) => {
    event.preventDefault();
    event.stopPropagation();

    const items = [
      await MenuItem.new({
        text: "Fork conversation from here",
        action: async () => {
          await actions.onFork();
        },
      }),
      await MenuItem.new({
        text: "Rewind code to here",
        enabled: actions.canRewind,
        action: async () => {
          await actions.onRewind();
        },
      }),
      await MenuItem.new({
        text: "Fork conversation and rewind code",
        enabled: actions.canRewind,
        action: async () => {
          await actions.onForkAndRewind();
        },
      }),
    ];

    const menu = await Menu.new({ items });
    const window = getCurrentWindow();
    const position = new LogicalPosition(event.clientX, event.clientY);
    await menu.popup(position, window);
  }, []);
}
