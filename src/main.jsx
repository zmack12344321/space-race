import { insertCoin } from "./multiplayer/party";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("App crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: "sans-serif",
            color: "#fff",
            background: "#111",
            minHeight: "100vh",
          }}
        >
          <h1>Something went wrong.</h1>
          <pre style={{ whiteSpace: "pre-wrap", color: "#f88" }}>
            {String(this.state.error?.stack || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

insertCoin({
  skipLobby: true,
  offline: window.location.pathname.startsWith("/test") || window.location.pathname.startsWith("/shader"),
}).catch((error) => {
  console.error("Failed to initialize multiplayer:", error);
});
