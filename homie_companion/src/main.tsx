import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppFallback } from "./components/AppFallback";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <ErrorBoundary
      resetKey="app-root"
      fallback={<AppFallback onReload={() => window.location.reload()} />}
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
