import { useEffect, useState, useCallback, useRef } from "react";
import { ShieldAlert } from "lucide-react";

// ─── Detection helpers ────────────────────────────────────────────────────────

/** Method 1 – window dimension delta (docked DevTools). */
function sizeDetect(): boolean {
  const THRESHOLD = 160;
  return (
    window.outerWidth - window.innerWidth > THRESHOLD ||
    window.outerHeight - window.innerHeight > THRESHOLD
  );
}

/**
 * Method 2 – console getter trick.
 * Chrome/Edge DevTools eagerly accesses enumerable properties of objects
 * passed to console.log. We exploit that by defining a getter on a dummy
 * object — the getter fires only when DevTools inspects the object.
 * Works for both docked AND detached DevTools windows.
 */
function consoleDetect(): boolean {
  let triggered = false;
  const dummy = new Image();
  Object.defineProperty(dummy, "id", {
    get() { triggered = true; },
    configurable: true,
  });
  // Call the *original* native console.log so DevTools evaluates the arg.
  // We grab it fresh each time so our main.tsx noop-override doesn't block it.
  try {
    const origLog = Function.prototype.bind.call(
      // eslint-disable-next-line no-console
      console.log,
      console,
    );
    origLog(dummy);
  } catch {
    // ignore
  }
  return triggered;
}

/**
 * Method 3 – debugger timing.
 * The `debugger` statement causes a measurable pause when DevTools is open
 * with breakpoints enabled.
 */
function debuggerDetect(): boolean {
  const t = performance.now();
  // eslint-disable-next-line no-debugger
  debugger;
  return performance.now() - t > 100;
}

function isDevToolsOpen(): boolean {
  return sizeDetect() || consoleDetect() || debuggerDetect();
}

// ─── Anti-debug loop ──────────────────────────────────────────────────────────
// When DevTools is detected we start a tight interval of `debugger` statements.
// This causes Chrome DevTools to pause execution every ~50ms, making it
// effectively unusable for inspection.
let antiDebugInterval: ReturnType<typeof setInterval> | null = null;

function startAntiDebug() {
  if (antiDebugInterval !== null) return;
  antiDebugInterval = setInterval(() => {
    // eslint-disable-next-line no-debugger
    debugger;
  }, 50);
}

function stopAntiDebug() {
  if (antiDebugInterval === null) return;
  clearInterval(antiDebugInterval);
  antiDebugInterval = null;
}

// ─── Blocked keyboard shortcuts ──────────────────────────────────────────────

const BLOCKED_KEYS = new Set(["F12", "F11"]);
const BLOCKED_CTRL_SHIFT = new Set(["I", "J", "C", "K", "i", "j", "c", "k"]);
const BLOCKED_CTRL = new Set(["U", "u", "S", "s"]);

function blockShortcut(e: KeyboardEvent) {
  if (BLOCKED_KEYS.has(e.key)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.shiftKey && BLOCKED_CTRL_SHIFT.has(e.key)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  if (ctrl && BLOCKED_CTRL.has(e.key)) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}

function blockContextMenu(e: MouseEvent) {
  e.preventDefault();
  e.stopImmediatePropagation();
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DevToolsGuardProps {
  children: React.ReactNode;
}

const IS_LOCALHOST =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

export function DevToolsGuard({ children }: DevToolsGuardProps) {
  // On localhost: skip all blocking so devtools work normally during development
  if (IS_LOCALHOST) return <>{children}</>;

  const [open, setOpen] = useState(false);
  const openRef = useRef(false); // track without re-render in the interval

  const check = useCallback(() => {
    const detected = isDevToolsOpen();
    if (detected !== openRef.current) {
      openRef.current = detected;
      setOpen(detected);
    }
    if (detected) {
      startAntiDebug();
    } else {
      stopAntiDebug();
    }
  }, []);

  useEffect(() => {
    // Disable text selection globally — prevents copy-paste of rendered content
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitUserSelect = "none";

    // Initial check
    check();

    // Continuous polling — catches the detached-window "switch-tab" loophole
    const interval = setInterval(check, 500);

    // Re-check on focus/resize (tab-switch, window resize)
    window.addEventListener("focus", check);
    window.addEventListener("resize", check);

    // Block DevTools keyboard shortcuts
    document.addEventListener("keydown", blockShortcut, true);
    // Block right-click → Inspect
    document.addEventListener("contextmenu", blockContextMenu, true);

    return () => {
      clearInterval(interval);
      stopAntiDebug();
      window.removeEventListener("focus", check);
      window.removeEventListener("resize", check);
      document.removeEventListener("keydown", blockShortcut, true);
      document.removeEventListener("contextmenu", blockContextMenu, true);
    };
  }, [check]);

  if (open) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 999999,
          background: "#0f172a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(239,68,68,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ShieldAlert size={40} color="#ef4444" />
        </div>
        <h1
          style={{
            color: "#f8fafc",
            fontSize: "1.75rem",
            fontWeight: 700,
            margin: 0,
            textAlign: "center",
          }}
        >
          Developer Tools Detected
        </h1>
        <p
          style={{
            color: "#94a3b8",
            fontSize: "1rem",
            margin: 0,
            textAlign: "center",
            maxWidth: 380,
            lineHeight: 1.6,
            padding: "0 16px",
          }}
        >
          Please close DevTools / Inspect to access the application. The app
          will resume automatically once DevTools is closed.
        </p>
        <div
          style={{
            marginTop: 8,
            padding: "10px 24px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5",
            fontSize: "0.85rem",
            textAlign: "center",
          }}
        >
          Close DevTools and this screen will disappear automatically.
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
