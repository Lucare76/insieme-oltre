"use client";
import { useCallback, useEffect, useRef } from "react";
import {
  ACTIVITY_WRITE_INTERVAL_MS,
  isSessionExpired,
  readSessionTimes,
  storeSessionTimes,
  SESSION_TIMES_KEY,
} from "../sessionTimeout";

/** Stessa sessione dell’area riservata /admin: stesse scadenze (60 minuti di inattività, 8 ore massimo). */
export const SESSION_KEY = "insieme_oltre_admin_session";

export function clearAdminSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_TIMES_KEY);
}

export type QsApi = (path: string, init?: RequestInit) => Promise<Response>;

export function useQsApi(onExpired: (message: string) => void): QsApi {
  const renewing = useRef<Promise<void> | null>(null);
  const expired = useRef(onExpired);
  useEffect(() => {
    expired.current = onExpired;
  }, [onExpired]);

  useEffect(() => {
    let last = 0;
    const activity = () => {
      const times = readSessionTimes();
      if (!times || Date.now() - last < ACTIVITY_WRITE_INTERVAL_MS) return;
      if (isSessionExpired(times)) return;
      last = Date.now();
      storeSessionTimes({ ...times, lastActivityAt: last });
    };
    const timer = setInterval(() => {
      if (localStorage.getItem(SESSION_KEY) && isSessionExpired(readSessionTimes())) {
        clearAdminSession();
        expired.current("Sessione terminata per sicurezza. Accedi di nuovo.");
      }
    }, 30000);
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
    };
  }, []);

  return useCallback(async (path: string, init: RequestInit = {}) => {
    const fail = (message: string): never => {
      clearAdminSession();
      expired.current(message);
      throw new Error(message);
    };
    let session: { access_token: string; refresh_token?: string; expires_at: number };
    try {
      session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return fail("Accedi nuovamente.");
    }
    if (!session?.access_token || isSessionExpired(readSessionTimes()))
      return fail("Sessione scaduta. Accedi nuovamente.");
    if (session.expires_at * 1000 < Date.now() + 60000 && session.refresh_token) {
      renewing.current ??= (async () => {
        const r = await fetch("/api/associazione/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        });
        const b = await r.json();
        if (!r.ok) fail(b.error || "Sessione scaduta.");
        localStorage.setItem(SESSION_KEY, JSON.stringify(b.session));
      })().finally(() => {
        renewing.current = null;
      });
      await renewing.current;
      session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    }
    const res = await fetch("/api/questionari/" + path, {
      ...init,
      headers: { ...init.headers, Authorization: "Bearer " + session.access_token },
      cache: "no-store",
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      if (res.status === 401) fail(b.error || "Sessione scaduta.");
      throw new Error(b.error || "Operazione non riuscita.");
    }
    return res;
  }, []);
}

export async function downloadResponse(res: Response, fallback: string) {
  const name =
    decodeURIComponent(res.headers.get("content-disposition")?.match(/filename\*=UTF-8''([^;]+)/)?.[1] ?? "") || fallback;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
