import { createHash, timingSafeEqual } from "node:crypto";

// Solo lato server: ADMIN_USERNAME e ADMIN_ALLOWED_EMAIL non devono mai arrivare al browser.

/** Sessione restituita al pannello: solo token, mai email o password. */
export type AdminSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

type SupabaseTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  user?: { email?: string };
};

function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

export function allowedAdminEmail() {
  return (process.env.ADMIN_ALLOWED_EMAIL ?? "luca_renna@hotmail.com").trim().toLowerCase();
}

export function adminUsername() {
  return process.env.ADMIN_USERNAME?.trim() || null;
}

export function isAuthConfigured() {
  return Boolean(supabaseEnv() && adminUsername());
}

/** Confronto a tempo costante: non rivela quanti caratteri dello username sono corretti. */
export function usernameMatches(candidate: string) {
  const expected = adminUsername();
  if (!expected) return false;
  const digest = (value: string) => createHash("sha256").update(value.trim()).digest();
  return timingSafeEqual(digest(candidate), digest(expected));
}

function toSession(payload: SupabaseTokenResponse): AdminSession | null {
  if (!payload.access_token || !payload.refresh_token) return null;
  // La sessione vale solo per l'account autorizzato, anche se Supabase ne ha accettato un altro.
  if (payload.user?.email?.toLowerCase() !== allowedAdminEmail()) return null;
  const expiresAt = payload.expires_at ?? Math.floor(Date.now() / 1000) + (payload.expires_in ?? 3600);
  return { access_token: payload.access_token, refresh_token: payload.refresh_token, expires_at: expiresAt };
}

async function tokenGrant(grantType: "password" | "refresh_token", body: Record<string, string>) {
  const env = supabaseEnv();
  if (!env) return null;

  // Login con la anon key, come farebbe il client Supabase: la service_role non serve e non va usata qui.
  const response = await fetch(`${env.url}/auth/v1/token?grant_type=${grantType}`, {
    method: "POST",
    headers: { apikey: env.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) return null;
  return toSession((await response.json()) as SupabaseTokenResponse);
}

export function signInAdmin(password: string) {
  return tokenGrant("password", { email: allowedAdminEmail(), password });
}

export function refreshAdminSession(refreshToken: string) {
  return tokenGrant("refresh_token", { refresh_token: refreshToken });
}

/** Revoca la sessione su Supabase: il refresh token smette di funzionare. */
export async function signOutAdmin(accessToken: string) {
  const env = supabaseEnv();
  if (!env) return;
  await fetch(`${env.url}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: env.anonKey, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  }).catch(() => undefined);
}

export function bearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
}

async function getAuthenticatedEmail(token: string) {
  const env = supabaseEnv();
  if (!env) return null;

  const response = await fetch(`${env.url}/auth/v1/user`, {
    headers: { apikey: env.anonKey, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const user = (await response.json()) as { email?: string };
  return user.email?.toLowerCase() ?? null;
}

/** Vero solo se il token è valido e appartiene esattamente ad ADMIN_ALLOWED_EMAIL. */
export async function requireAdmin(request: Request) {
  const token = bearerToken(request);
  if (!token) return false;
  return (await getAuthenticatedEmail(token)) === allowedAdminEmail();
}
