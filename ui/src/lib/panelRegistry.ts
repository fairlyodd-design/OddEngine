import React from "react";

export const panelRegistry: Record<string, React.ComponentType<any>> = {};

export function registerPanel(id: string, component: React.ComponentType<any>) {
  panelRegistry[id] = component;
}

export function getPanel(id: string) {
  return panelRegistry[id];
}