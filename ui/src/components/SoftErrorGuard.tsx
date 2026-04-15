import React from "react";

type Props = {
  label: string;
  children: React.ReactNode;
  resetKey?: string | number | null;
};

type State = {
  hasError: boolean;
  message: string;
  lastResetKey: string | number | null;
};

export default class SoftErrorGuard extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    message: "",
    lastResetKey: this.props.resetKey ?? null,
  };

  static getDerivedStateFromError(error: any): Partial<State> {
    return {
      hasError: true,
      message: String(error?.message || error || "Unknown render failure"),
    };
  }

  static getDerivedStateFromProps(nextProps: Props, prevState: State): Partial<State> | null {
    const nextKey = nextProps.resetKey ?? null;
    if (nextKey !== prevState.lastResetKey) {
      return {
        hasError: false,
        message: "",
        lastResetKey: nextKey,
      };
    }
    return null;
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="card softCard" style={{ borderColor: "rgba(251,191,36,0.28)", background: "rgba(15,22,34,0.42)" }}>
        <div className="small shellEyebrow">SOFT RECOVERY</div>
        <div style={{ fontWeight: 900, fontSize: 16, marginTop: 6 }}>{this.props.label} hit a render snag</div>
        <div className="small mt-3" style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{this.state.message}</div>
        <div className="row wrap mt-4">
          <button className="tabBtn" onClick={() => this.setState({ hasError: false, message: "" })}>Retry section</button>
        </div>
      </div>
    );
  }
}
