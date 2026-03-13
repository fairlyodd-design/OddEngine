export type HomiePanelState =
  | "idle"
  | "listening"
  | "speaking"
  | "thinking"
  | "happy"
  | "concerned";

export function inferHomieState(input: {
  panelId?: string;
  renderBusy?: boolean;
  hasErrors?: boolean;
  micActive?: boolean;
  speaking?: boolean;
  celebrating?: boolean;
}): HomiePanelState {
  if (input.hasErrors) return "concerned";
  if (input.speaking) return "speaking";
  if (input.micActive) return "listening";
  if (input.renderBusy) return "thinking";
  if (input.celebrating) return "happy";
  return "idle";
}

export function getHomieStatusLine(state: HomiePanelState) {
  switch (state) {
    case "listening":
      return "Homie is listening for your next move.";
    case "speaking":
      return "Homie is talking through the plan.";
    case "thinking":
      return "Homie is thinking through the workflow.";
    case "happy":
      return "Homie is celebrating a clean win.";
    case "concerned":
      return "Homie sees something that needs attention.";
    default:
      return "Homie is ready.";
  }
}
