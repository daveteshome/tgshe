import React from "react";

type State = { err?: any };
export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { err: null };
  static getDerivedStateFromError(err: any) { return { err }; }
  componentDidCatch(err: any, info: any) { console.error("ErrorBoundary caught", err, info); }
  render() {
    if (this.state.err) {
      const msg = String(this.state.err?.message ?? this.state.err);
      return (
        <div style={{ padding: 16, color: "#900" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Something went wrong.</div>
          <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
