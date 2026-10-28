// PRD section 9: prompt to install after the third logging session.
// A "session" is a run of saves with less than 30 minutes between them.

const KEY = "bl-log-sessions";
const SESSION_GAP_MS = 30 * 60_000;

interface SessionState {
  count: number;
  last: number;
}

function read(): SessionState {
  try {
    return { count: 0, last: 0, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { count: 0, last: 0 };
  }
}

export function nextSessionState(state: SessionState, now: number): SessionState {
  const isNew = state.last === 0 || now - state.last > SESSION_GAP_MS;
  return { count: isNew ? state.count + 1 : state.count, last: now };
}

export function recordLoggingSession(now = Date.now()): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(nextSessionState(read(), now)));
  } catch {
    /* storage unavailable */
  }
}

export function loggingSessions(): number {
  return read().count;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iP(hone|ad|od)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}
