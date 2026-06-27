import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 99999 }}>
          <img src="/error.jpg" alt="Error" style={{ maxWidth: "90vw", maxHeight: "80vh", objectFit: "contain" }} />
          <button onClick={() => window.location.reload()} style={{ marginTop: "1rem", padding: "0.6rem 2rem", background: "#fff", color: "#000", border: "none", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem" }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}