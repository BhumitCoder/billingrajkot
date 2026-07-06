import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// ── Kill all console output in production ──────────────────────────────────
if (import.meta.env.PROD) {
  const noop = () => undefined;
  (
    [
      "log", "warn", "error", "info", "debug",
      "dir", "dirxml", "table", "trace",
      "group", "groupCollapsed", "groupEnd",
      "count", "countReset", "time", "timeEnd", "timeLog",
      "assert", "clear", "profile", "profileEnd",
    ] as const
  ).forEach((m) => {
    // @ts-ignore
    console[m] = noop;
  });
}

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);
