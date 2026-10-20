import { allowedAdminEmail, bearerToken } from "./adminAuth";
import type { AssociationRole } from "./accounting";

export class AssociationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function service(path: string, init: RequestInit = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new AssociationError("Servizio non configurato.", 503);
  const response = await fetch(url + path, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (body.code === "40001")
      throw new AssociationError(
        "Il movimento è stato modificato da un'altra persona. Ricarica i dati.",
        409,
      );
    throw new AssociationError(
      "Operazione non riuscita. Verifica la configurazione dell'area soci.",
      503,
    );
  }
  return response;
}
export async function identity(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new AssociationError("Accesso non configurato.", 503);
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new AssociationError("Sessione scaduta. Accedi nuovamente.", 401);
  const user = (await response.json()) as { id: string; email?: string };
  if (user.email?.toLowerCase() === allowedAdminEmail())
    return { id: user.id, name: "Luca", role: "owner" as AssociationRole };
  const responseRole = await service(
    `/rest/v1/association_members?user_id=eq.${encodeURIComponent(user.id)}&select=user_id,name,role,active`,
  );
  const [member] = (await responseRole.json()) as {
    name: string;
    role: AssociationRole;
    active: boolean;
  }[];
  if (!member?.active || !["accountant", "member"].includes(member.role))
    throw new AssociationError("Accesso all'associazione non abilitato.", 403);
  return { id: user.id, name: member.name, role: member.role };
}
export async function authorize(
  request: Request,
  write = false,
  owner = false,
) {
  const token = bearerToken(request);
  if (!token) throw new AssociationError("Accedi all'area riservata.", 401);
  const user = await identity(token);
  if ((write && user.role === "member") || (owner && user.role !== "owner"))
    throw new AssociationError(
      "Non hai i permessi per questa operazione.",
      403,
    );
  return user;
}
export async function jsonBody(request: Request) {
  const text = await request.text();
  if (text.length > 16000)
    throw new AssociationError("Richiesta troppo grande.", 413);
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new AssociationError("Dati non validi.");
  }
}
export const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
