import type { ReactNode } from "react";
import { Component } from "react";

type Props = {
  children: ReactNode;
  fallback: ReactNode;
  resetKey?: string | number;
};

type State = {
  hasError: boolean;
  message?: string;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error || "Unknown error")
    };
  }

  componentDidCatch(error: unknown) {
    console.error("[Homie Companion] Boundary caught an error", error);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: undefined });
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
