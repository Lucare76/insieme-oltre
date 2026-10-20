import { createHmac } from "node:crypto";
import { adminUsername, allowedAdminEmail, signOutAdmin } from "./adminAuth";
import {
  AssociationError,
  authorize,
  identity,
  jsonBody,
  service,
  uuid,
} from "./associationServer";
import {
  accessMailReady,
  notifyAccessRequest,
  sendAccessLink,
} from "./associationMail";

export const normalizeUsername = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";
export function validUsername(value: string) {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
}
function reserved(value: string) {
  return (
    value === normalizeUsername(adminUsername()) ||
    ["admin", "administrator", "superadmin", "system"].includes(value)
  );
}
function emailValue(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AssociationError("Inserisci un’email valida.");
  return email;
}
const asOne = <T>(value: T | T[]) => (Array.isArray(value) ? value[0] : value);
async function rpc<T>(name: string, body: unknown): Promise<T> {
  return (
    await service(`/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ).json();
}
async function limit(request: Request, kind: string) {
  const ip =
    process.env.VERCEL === "1"
      ? request.headers.get("x-vercel-forwarded-for")
      : "local";
  const key = createHmac(
    "sha256",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "unconfigured",
  )
    .update(ip || "unknown")
    .digest("hex");
  if (
    !(await rpc<boolean>("association_access_limit", {
      p_key: key,
      p_kind: kind,
    }))
  )
    throw new AssociationError("Troppi tentativi. Riprova tra 15 minuti.", 429);
}
async function auth(
  path: string,
  body: unknown,
  method = "POST",
  token?: string,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new AssociationError("Accesso non configurato.", 503);
  const res = await fetch(`${url}/auth/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok)
    throw new AssociationError(
      path === "verify"
        ? "Collegamento scaduto o già utilizzato. Richiedine uno nuovo."
        : "Operazione non riuscita. Verifica le credenziali o richiedi un nuovo collegamento.",
      400,
    );
  return res.json();
}
export async function loginByUsername(request: Request) {
  await limit(request, "login");
  const b = await jsonBody(request);
  const username = normalizeUsername(b.username);
  const password = typeof b.password === "string" ? b.password : "";
  if (!username || username.length > 200 || !password || password.length > 200)
    throw new AssociationError("Credenziali non valide.", 401);
  let email = "invalid-access@invalid.example";
  if (username === normalizeUsername(adminUsername()))
    email = allowedAdminEmail();
  else if (validUsername(username)) {
    const [m] = await (
      await service(
        `/rest/v1/association_members?username=eq.${encodeURIComponent(username)}&active=eq.true&activated_at=not.is.null&select=email&limit=1`,
      )
    ).json();
    if (m) email = m.email;
  }
  let payload;
  try {
    payload = await auth("token?grant_type=password", { email, password });
  } catch {
    throw new AssociationError("Credenziali non valide.", 401);
  }
  try {
    const user = await identity(payload.access_token);
    return {
      user,
      session: {
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
        expires_at:
          payload.expires_at ??
          Math.floor(Date.now() / 1000) + payload.expires_in,
      },
    };
  } catch (error) {
    await signOutAdmin(payload.access_token);
    throw error;
  }
}
type AccessRequest = {
  id: string;
  name: string;
  email: string;
  username: string;
  status: string;
  user_id: string | null;
};
export async function generateAccessLink(email: string, newUser = false) {
  let result;
  if (newUser) {
    try {
      result = await (
        await service("/auth/v1/admin/generate_link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "invite", email }),
        })
      ).json();
    } catch {
      /* An earlier attempt may already have created the unprivileged Auth account. */
    }
  }
  if (!result)
    result = await (
      await service("/auth/v1/admin/generate_link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "recovery", email }),
      })
    ).json();
  const id = result.id ?? result.user?.id;
  const hash = result.hashed_token ?? result.properties?.hashed_token;
  const type = result.verification_type ?? result.properties?.verification_type;
  if (
    !uuid(id) ||
    typeof hash !== "string" ||
    !["invite", "recovery"].includes(type)
  )
    throw new AssociationError(
      "Impossibile generare il collegamento di attivazione.",
      503,
    );
  return { id, hash, type: type as "invite" | "recovery" };
}
async function memberById(id: string) {
  const [m] = await (
    await service(
      `/rest/v1/association_members?user_id=eq.${id}&select=user_id,name,email,username,active,activated_at`,
    )
  ).json();
  return m;
}
export async function handleAccess(
  request: Request,
  route: string,
): Promise<unknown> {
  if (
    ["request", "recover", "password"].includes(route) &&
    request.method === "POST"
  ) {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new AssociationError("Richiesta non consentita.", 403);
    await limit(request, route);
    const b = await jsonBody(request);
    if (route === "request") {
      if (b.website) return { ok: true };
      const name = typeof b.name === "string" ? b.name.trim() : "";
      const email = emailValue(b.email);
      const username = normalizeUsername(b.username);
      if (
        name.length < 2 ||
        name.length > 120 ||
        /[\r\n]/.test(name) ||
        !validUsername(username) ||
        reserved(username) ||
        email === allowedAdminEmail() ||
        b.privacy !== true
      )
        throw new AssociationError(
          "Verifica nome, email, nome utente e informativa privacy.",
        );
      const id = await rpc<string | null>("association_submit_access", {
        p_name: name,
        p_email: email,
        p_username: username,
      });
      if (id) {
        try {
          await notifyAccessRequest(name, email, username);
          await service(`/rest/v1/association_access_requests?id=eq.${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              notification_sent_at: new Date().toISOString(),
            }),
          });
        } catch {
          /* The panel remains the source of truth when notification delivery fails. */
        }
      }
      return {
        ok: true,
        message:
          "Richiesta ricevuta. Se i dati sono disponibili, l’admin potrà approvarla e inviarti il collegamento per la password.",
      };
    }
    if (route === "recover") {
      const email = emailValue(b.email);
      try {
        let person;
        if (email === allowedAdminEmail())
          person = { name: "Luca", username: adminUsername() };
        else {
          const [m] = await (
            await service(
              `/rest/v1/association_members?email=eq.${encodeURIComponent(email)}&active=eq.true&select=name,username&limit=1`,
            )
          ).json();
          person = m;
        }
        if (person?.username && accessMailReady()) {
          const link = await generateAccessLink(email);
          await sendAccessLink(
            email,
            person.name,
            person.username,
            link.hash,
            link.type,
          );
        }
      } catch {
        /* Identical public response for known and unknown email addresses. */
      }
      return {
        ok: true,
        message:
          "Se l’email appartiene a un account abilitato, riceverai un collegamento per impostare la password.",
      };
    }
    const password = typeof b.password === "string" ? b.password : "";
    if (
      password.length < 12 ||
      password.length > 200 ||
      typeof b.token_hash !== "string" ||
      b.token_hash.length > 256 ||
      !b.token_hash ||
      !["invite", "recovery"].includes(String(b.type))
    )
      throw new AssociationError(
        "Inserisci una password di almeno 12 caratteri e usa il collegamento ricevuto via email.",
      );
    const verified = await auth("verify", {
      token_hash: b.token_hash,
      type: b.type,
    });
    const token = verified.access_token;
    const person = verified.user;
    if (!token || !uuid(person?.id)) {
      if (token) await signOutAdmin(token);
      throw new AssociationError("Collegamento non valido.", 401);
    }
    try {
      const owner = person.email?.toLowerCase() === allowedAdminEmail();
      const member = owner ? null : await memberById(person.id);
      if (!owner && !member?.active)
        throw new AssociationError(
          "Questo accesso non è abilitato. Contatta l’admin.",
          403,
        );
      await auth("user", { password }, "PUT", token);
      if (
        !owner &&
        !(await rpc<boolean>("association_activate_member", {
          p_user: person.id,
        }))
      )
        throw new AssociationError(
          "Accesso disattivato. Contatta l’admin.",
          403,
        );
      return {
        ok: true,
        message:
          "Password salvata. Ora puoi accedere con nome utente e password.",
      };
    } finally {
      await signOutAdmin(token);
    }
  }
  const owner = await authorize(request, true, true);
  if (route === "requests" && request.method === "GET") {
    const offset = Number(new URL(request.url).searchParams.get("offset") || 0);
    if (!Number.isSafeInteger(offset) || offset < 0)
      throw new AssociationError("Pagina non valida.");
    return {
      items: await (
        await service(
          `/rest/v1/association_access_requests?select=id,name,email,username,status,created_at,reviewed_at,notification_sent_at,invitation_sent_at&order=created_at.desc&limit=100&offset=${offset}`,
        )
      ).json(),
      emailReady: accessMailReady(),
    };
  }
  if (route === "review" && request.method === "POST") {
    const b = await jsonBody(request);
    if (!uuid(b.id) || !["approve", "reject"].includes(String(b.action)))
      throw new AssociationError("Richiesta non valida.");
    if (b.action === "reject") {
      await rpc("association_review_access", {
        p_id: b.id,
        p_actor: owner.id,
        p_action: "reject",
      });
      return { ok: true };
    }
    if (!["accountant", "member"].includes(String(b.role)))
      throw new AssociationError("Scegli un ruolo valido.");
    if (!accessMailReady())
      throw new AssociationError(
        "Configura l’invio email prima di approvare.",
        503,
      );
    const req = asOne(
      await rpc<AccessRequest | AccessRequest[]>("association_review_access", {
        p_id: b.id,
        p_actor: owner.id,
        p_action: "claim",
      }),
    );
    let committed = false;
    try {
      if (reserved(req.username) || req.email === allowedAdminEmail())
        throw new AssociationError("Nome utente riservato all’admin.");
      const link = await generateAccessLink(req.email, true);
      await rpc("association_review_access", {
        p_id: b.id,
        p_actor: owner.id,
        p_action: "approve",
        p_user: link.id,
        p_role: b.role,
      });
      committed = true;
      try {
        await sendAccessLink(
          req.email,
          req.name,
          req.username,
          link.hash,
          link.type,
        );
        await service(`/rest/v1/association_access_requests?id=eq.${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invitation_sent_at: new Date().toISOString(),
          }),
        });
      } catch {
        return {
          ok: true,
          warning:
            "Richiesta approvata, ma invio email non riuscito. Usa Reinvia invito in Utenti e permessi.",
        };
      }
      return { ok: true };
    } finally {
      if (!committed)
        await rpc("association_review_access", {
          p_id: b.id,
          p_actor: owner.id,
          p_action: "release",
        }).catch(() => undefined);
    }
  }
  if (route === "resend" && request.method === "POST") {
    const b = await jsonBody(request);
    if (!uuid(b.user_id)) throw new AssociationError("Utente non valido.");
    const m = await memberById(b.user_id);
    if (!m?.active || !m.username)
      throw new AssociationError(
        "Abilita l’utente e assegna un nome utente prima di inviare l’invito.",
      );
    const link = await generateAccessLink(m.email, !m.activated_at);
    if (link.id !== m.user_id)
      throw new AssociationError("Account non corrispondente.", 409);
    await sendAccessLink(m.email, m.name, m.username, link.hash, link.type);
    await service(
      `/rest/v1/association_access_requests?user_id=eq.${m.user_id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_sent_at: new Date().toISOString() }),
      },
    );
    return { ok: true };
  }
  throw new AssociationError("Operazione non disponibile.", 404);
}
