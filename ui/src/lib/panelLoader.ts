import { registerPanel } from "./panelRegistry";

export function registerCorePanels(panels: Record<string, any>) {
  Object.entries(panels).forEach(([id, component]) => {
    registerPanel(id, component);
  });
}