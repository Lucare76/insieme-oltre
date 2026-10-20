import {
  authorize,
  identity,
  service,
  privateHeaders,
  jsonBody,
  uuid,
  AssociationError,
} from "../../../../lib/associationServer";
import { bearerToken, signOutAdmin } from "../../../../lib/adminAuth";
import {
  loginByUsername,
  normalizeUsername,
  validUsername,
} from "../../../../lib/accessServer";
import { adminUsername } from "../../../../lib/adminAuth";
import { parseCents, validDate } from "../../../../lib/accounting";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: privateHeaders });
const fields =
  "id,date,kind,amount_cents,account,category,project,description,version,cancelled,cancellation_reason";
function text(value: unknown, max: number, required = false) {
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    throw new AssociationError("Compila correttamente i campi richiesti.");
  return value.trim();
}
async function handle(request: Request, path: string[]) {
  const route = path.join("/");
  if (route === "login" && request.method === "POST")
    return reply(await loginByUsername(request));
  if (["login", "refresh"].includes(route) && request.method === "POST") {
    const body = await jsonBody(request);
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const refresh =
      typeof body.refresh_token === "string" ? body.refresh_token : "";
    if (
      (route === "login" &&
        (!email || !password || email.length > 254 || password.length > 200)) ||
      (route === "refresh" && (!refresh || refresh.length > 4096))
    )
      throw new AssociationError("Credenziali non valide.", 401);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key)
      throw new AssociationError("Accesso non configurato.", 503);
    const res = await fetch(
      `${url}/auth/v1/token?grant_type=${route === "login" ? "password" : "refresh_token"}`,
      {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify(
          route === "login" ? { email, password } : { refresh_token: refresh },
        ),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!res.ok)
      throw new AssociationError(
        "Credenziali non valide o sessione scaduta.",
        401,
      );
    const session = await res.json();
    let user;
    try {
      user = await identity(session.access_token);
    } catch (error) {
      await signOutAdmin(session.access_token);
      throw error;
    }
    return reply({
      user,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      },
    });
  }
  if (route === "logout" && request.method === "POST") {
    const token = bearerToken(request);
    if (token) await signOutAdmin(token);
    return reply({ ok: true });
  }
  const write = request.method !== "GET";
  const user = await authorize(
    request,
    write,
    route === "members" || route === "audit",
  );
  if (route === "me" && !write) return reply({ user });
  if (route === "movements" && request.method === "GET") {
    const items: Record<string, unknown>[] = [];
    // Paginazione esplicita: nessun totale calcolato su liste troncate da PostgREST.
    for (let offset = 0; ; offset += 500) {
      const res = await service(
        `/rest/v1/association_movements?select=${fields}${user.role === "member" ? "" : ",private_note"}&order=date.desc,id&offset=${offset}&limit=500`,
      );
      const page = await res.json();
      items.push(...page);
      if (page.length < 500) break;
    }
    return reply({ items });
  }
  if (route === "movements" && request.method === "POST") {
    const body = await jsonBody(request);
    if (body.id !== undefined && !uuid(body.id))
      throw new AssociationError("Movimento non valido.");
    if (
      body.id &&
      (!Number.isInteger(body.version) || Number(body.version) < 1)
    )
      throw new AssociationError("Versione non valida.");
    let data = null;
    let reason = null;
    if (body.cancel_reason !== undefined) {
      if (!body.id) throw new AssociationError("Movimento obbligatorio.");
      reason = text(body.cancel_reason, 500, true);
      if (reason.length < 10)
        throw new AssociationError(
          "Indica una motivazione di almeno 10 caratteri.",
        );
    } else {
      const cents = parseCents(body.amount);
      if (
        !validDate(body.date) ||
        !cents ||
        !["income", "expense", "transfer", "opening"].includes(
          String(body.kind),
        ) ||
        !["cash", "bank"].includes(String(body.account))
      )
        throw new AssociationError("Verifica data, importo e conto.");
      data = {
        date: body.date,
        amount_cents: cents,
        kind: body.kind,
        account: body.account,
        category: text(body.category, 100, true),
        project: text(body.project ?? "", 120),
        description: text(body.description, 500, true),
        private_note: text(body.private_note ?? "", 1000),
      };
    }
    const saved = await service("/rest/v1/rpc/association_save_movement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        p_id: body.id ?? null,
        p_version: body.version ?? null,
        p_actor: user.id,
        p_data: data,
        p_cancel_reason: reason,
      }),
    });
    const payload = await saved.json();
    const result = Array.isArray(payload) ? payload[0] : payload;
    return reply({ ok: true, id: result?.id });
  }
  if (route === "members" && request.method === "GET") {
    const res = await service(
      "/rest/v1/association_members?select=user_id,name,email,username,role,active,activated_at&order=name&limit=1000",
    );
    return reply({ items: await res.json() });
  }
  if (route === "members" && request.method === "POST") {
    const b = await jsonBody(request);
    if (!["member", "accountant"].includes(String(b.role)))
      throw new AssociationError("Ruolo non valido.");
    const name = text(b.name, 120, true);
    const email = text(b.email, 254, true).toLowerCase();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof b.active !== "boolean"
    )
      throw new AssociationError("Email o stato non valido.");
    if (!uuid(b.user_id))
      throw new AssociationError("Approva prima una richiesta di accesso.");
    const username = normalizeUsername(b.username);
    if (
      !validUsername(username) ||
      username === normalizeUsername(adminUsername()) ||
      ["admin", "administrator", "superadmin", "system"].includes(username)
    )
      throw new AssociationError("Nome utente non valido o riservato.");
    const [existing] = await (
      await service(
        `/rest/v1/association_members?user_id=eq.${b.user_id}&select=email`,
      )
    ).json();
    if (!existing || existing.email.toLowerCase() !== email)
      throw new AssociationError("Account non corrispondente.");
    await service("/rest/v1/rpc/association_save_member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        p_actor: user.id,
        p_member: {
          user_id: b.user_id,
          name,
          email,
          username,
          role: b.role,
          active: b.active,
        },
      }),
    });
    return reply({ ok: true });
  }
  if (route === "audit" && request.method === "GET") {
    const params = new URL(request.url).searchParams;
    const offset = Math.max(0, Number(params.get("offset")) || 0);
    const res = await service(
      `/rest/v1/association_audit?select=*&order=id.desc&limit=100&offset=${offset}`,
    );
    return reply({ items: await res.json() });
  }
  if (route === "documents") {
    if (user.role === "member")
      throw new AssociationError(
        "Documenti riservati agli amministratori.",
        403,
      );
    if (request.method === "GET") {
      const id = new URL(request.url).searchParams.get("movement_id");
      if (!uuid(id)) throw new AssociationError("Movimento non valido.");
      const res = await service(
        `/rest/v1/association_documents?movement_id=eq.${id}&select=id,filename,created_at&order=created_at`,
      );
      return reply({ items: await res.json() });
    }
    if (request.method === "POST") {
      const form = await request.formData();
      const movementId = form.get("movement_id");
      const file = form.get("file");
      if (
        !uuid(movementId) ||
        !(file instanceof File) ||
        file.size === 0 ||
        file.size > 3145728
      )
        throw new AssociationError("Scegli un PDF, JPG o PNG fino a 3 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const type =
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46
          ? "application/pdf"
          : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
            ? "image/jpeg"
            : bytes[0] === 0x89 &&
                bytes[1] === 0x50 &&
                bytes[2] === 0x4e &&
                bytes[3] === 0x47
              ? "image/png"
              : null;
      if (!type || type !== file.type)
        throw new AssociationError("Formato del documento non valido.");
      const res = await service(
        `/rest/v1/association_movements?id=eq.${movementId}&select=id`,
      );
      if (!(await res.json()).length)
        throw new AssociationError("Movimento inesistente.", 404);
      const object = `${movementId}/${crypto.randomUUID()}`;
      await service(`/storage/v1/object/association-documents/${object}`, {
        method: "POST",
        headers: { "Content-Type": type },
        body: bytes,
      });
      try {
        await service("/rest/v1/association_documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            movement_id: movementId,
            filename: file.name.slice(0, 180),
            content_type: type,
            object_path: object,
            created_by: user.id,
          }),
        });
      } catch (error) {
        await service(`/storage/v1/object/association-documents/${object}`, {
          method: "DELETE",
        }).catch(() => undefined);
        throw error;
      }
      return reply({ ok: true });
    }
  }
  if (path[0] === "document" && request.method === "GET" && uuid(path[1])) {
    if (user.role === "member")
      throw new AssociationError("Documenti riservati.", 403);
    const res = await service(
      `/rest/v1/association_documents?id=eq.${path[1]}&select=object_path,filename,content_type`,
    );
    const [doc] = await res.json();
    if (!doc) throw new AssociationError("Documento non trovato.", 404);
    const object = await service(
      `/storage/v1/object/association-documents/${doc.object_path}`,
    );
    return new Response(await object.arrayBuffer(), {
      headers: {
        ...privateHeaders,
        "Content-Type": doc.content_type,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      },
    });
  }
  throw new AssociationError("Pagina non trovata.", 404);
}
async function dispatch(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    return await handle(request, (await context.params).path);
  } catch (error) {
    return reply(
      {
        error:
          error instanceof AssociationError
            ? error.message
            : "Servizio temporaneamente non disponibile.",
      },
      error instanceof AssociationError ? error.status : 503,
    );
  }
}
export { dispatch as GET, dispatch as POST };
