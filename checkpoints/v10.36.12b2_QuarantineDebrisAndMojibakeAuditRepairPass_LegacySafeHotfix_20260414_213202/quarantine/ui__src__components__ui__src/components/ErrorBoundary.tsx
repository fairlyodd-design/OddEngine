import React from "react";
import { addBrainMemory, logActivity } from "../lib/brain";
import { pushNotif } from "../lib/notifs";

type Props = {
  panelId?: string;
  label?: string;
  onNavigate?: (panelId: string) => void;
  children: React.ReactNode;
};

type State = { hasError: boolean; message: string };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, message: error?.message || String(error || "Unknown error") };
  }

  componentDidCatch(error: any, info: any) {
    const panelId = this.props.panelId || "OddBrain";
    const label = this.props.label || panelId;
    const body = `${error?.message || String(error || "Unknown error")}

${String(info?.componentStack || "").slice(0, 1200)}`;
    try {
      addBrainMemory({ panelId, kind: "error", title: `${label} crashed`, body, tags: [label, "error"] });
      logActivity({ kind: "system", panelId, title: `${label} error boundary`, body: error?.message || String(error || "Unknown error"), tags: ["error", label] });
      pushNotif({ title: `${label} recovered`, body: "OddEngine caught a panel error and kept the rest of the OS alive.", tags: [label, "ErrorBoundary"], level: "error" });
    } catch {}
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const panelId = this.props.panelId || "Brain";
    return (
      <div className="card softCard" style={{ borderColor: "rgba(244,63,94,0.35)" }}>
        <div className="h">⚠️ {this.props.label || panelId} hit a runtime error</div>
        <div className="small" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{this.state.message}</div>
        <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={() => this.setState({ hasError: false, message: "" })}>Retry render</button>
          {!!this.props.onNavigate && <button className="tabBtn" onClick={() => this.props.onNavigate?.("Brain")}>Open Brain</button>}
          <button className="tabBtn" onClick={() => window.location.reload()}>Reload app</button>
        </div>
      </div>
    );
  }
}
