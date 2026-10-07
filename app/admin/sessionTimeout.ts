/** Logout dopo 60 minuti senza attività reale (click, tastiera, touch, modifiche nell'editor). */
export const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
/** Durata massima di una sessione dal login, anche se usata di continuo. */
export const MAX_SESSION_MS = 8 * 60 * 60 * 1000;
/** L'attività viene scritta nel browser al massimo ogni 15 secondi. */
export const ACTIVITY_WRITE_INTERVAL_MS = 15 * 1000;

export const SESSION_TIMES_KEY = "insieme_oltre_admin_session_times";

/** Solo timestamp (ms): nessun dato personale o credenziale. */
export type SessionTimes = { loginAt: number; lastActivityAt: number };

export function isSessionTimes(value: unknown): value is SessionTimes {
  const candidate = value as Partial<SessionTimes> | null;
  return Boolean(
    candidate &&
      Number.isFinite(candidate.loginAt) &&
      Number.isFinite(candidate.lastActivityAt) &&
      (candidate.lastActivityAt as number) >= (candidate.loginAt as number),
  );
}

/** Istante in cui la sessione scade: il primo tra inattività e durata massima. */
export function sessionDeadline(times: SessionTimes) {
  return Math.min(times.lastActivityAt + IDLE_TIMEOUT_MS, times.loginAt + MAX_SESSION_MS);
}

/** Senza timestamp (es. sessione salvata prima di questa versione) la sessione è considerata scaduta. */
export function isSessionExpired(times: SessionTimes | null, now = Date.now()) {
  return !times || now >= sessionDeadline(times);
}

export function parseSessionTimes(raw: string | null): SessionTimes | null {
  try {
    const parsed: unknown = JSON.parse(raw ?? "null");
    return isSessionTimes(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readSessionTimes(): SessionTimes | null {
  try {
    return parseSessionTimes(window.localStorage.getItem(SESSION_TIMES_KEY));
  } catch {
    return null;
  }
}

export function storeSessionTimes(times: SessionTimes | null) {
  try {
    if (times) window.localStorage.setItem(SESSION_TIMES_KEY, JSON.stringify(times));
    else window.localStorage.removeItem(SESSION_TIMES_KEY);
  } catch {
    // Senza localStorage i timeout valgono comunque per la pagina aperta (timesRef).
  }
}
