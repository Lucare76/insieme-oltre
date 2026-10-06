import { NextResponse } from "next/server";
import { childIssues, normalizeChildren, slugify } from "../../../../lib/children";
import { requireAdmin } from "../../../../lib/adminAuth";
import { defaultHomeContent, getHomeContent } from "../../../../lib/siteContent";

async function readContent() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { content: await getHomeContent(), configured: Boolean(supabaseUrl && serviceKey) };
}

export async function GET(request: Request) {
  const isAdmin = await requireAdmin(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const payload = await readContent();
  return NextResponse.json(payload);
}

export async function PUT(request: Request) {
  const isAdmin = await requireAdmin(request);

  if (!isAdmin) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase non configurato: mancano le variabili ambiente." },
      { status: 500 },
    );
  }

  const body = await request.json();
  const value = body?.value;

  if (!value || typeof value !== "object" || !value.hero || !value.footer) {
    return NextResponse.json({ error: "Contenuto non valido" }, { status: 400 });
  }

  const children = normalizeChildren(value.children)?.map((child) =>
    child.status === "in_arrivo" && !child.slug ? { ...child, slug: slugify(child.name) } : child);
  if (!children) {
    return NextResponse.json({ error: "Elenco bambini mancante o non valido." }, { status: 400 });
  }
  const errors = children.flatMap((child) =>
    childIssues(child, children).filter((issue) => issue.level === "error").map((issue) => `${child.name || "Bambino senza nome"}: ${issue.message}`));
  if (errors.length) {
    return NextResponse.json({ error: `Da correggere prima di salvare — ${errors.join(" ")}` }, { status: 400 });
  }
  value.children = children;

  value.hero.titleLine1 = defaultHomeContent.hero.titleLine1;
  value.hero.titleLine2 = defaultHomeContent.hero.titleLine2;
  value.footer.slogan = defaultHomeContent.footer.slogan;

  const payload = { key: "home", value, updated_at: new Date().toISOString() };

  // Aggiorna tutte le eventuali righe duplicate "home": in passato il POST poteva
  // accumularne più di una se la colonna key non aveva un vincolo UNIQUE.
  let response = await fetch(`${supabaseUrl}/rest/v1/site_content?key=eq.home`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ value: payload.value, updated_at: payload.updated_at }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: "Salvataggio non riuscito", detail }, { status: 500 });
  }

  const updatedRows = (await response.json().catch(() => [])) as unknown[];
  if (updatedRows.length === 0) {
    response = await fetch(`${supabaseUrl}/rest/v1/site_content`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: "Salvataggio non riuscito", detail }, { status: 500 });
    }
  }

  // Rilegge da Supabase la riga "home" più recente: il salvataggio è riuscito solo se è proprio quella appena scritta.
  const saved = await readLatestHome(supabaseUrl, serviceKey);
  if (!saved.ok) {
    return NextResponse.json({ error: "Salvataggio non verificato: rilettura da Supabase non riuscita", detail: saved.detail }, { status: 500 });
  }
  if (!sameInstant(saved.updatedAt, payload.updated_at)) {
    return NextResponse.json(
      { error: "Salvataggio non verificato: su Supabase la versione più recente non è quella appena salvata." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, verified: true, content: saved.value, updatedAt: saved.updatedAt });
}

async function readLatestHome(supabaseUrl: string, serviceKey: string) {
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/site_content?key=eq.home&select=value,updated_at&order=updated_at.desc&limit=1`,
      {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        cache: "no-store",
      },
    );
    if (!response.ok) return { ok: false as const, detail: await response.text() };

    const rows = (await response.json()) as { value?: unknown; updated_at?: string }[];
    const row = rows[0];
    if (!row?.value || typeof row.value !== "object" || typeof row.updated_at !== "string") {
      return { ok: false as const, detail: "Nessuna riga home trovata dopo il salvataggio." };
    }
    return { ok: true as const, value: row.value, updatedAt: row.updated_at };
  } catch (error) {
    return { ok: false as const, detail: error instanceof Error ? error.message : String(error) };
  }
}

/** Confronta due timestamp anche se Postgres li restituisce in un formato diverso da toISOString(). */
function sameInstant(stored: string, written: string) {
  const withZone = /(Z|[+-]\d{2}(:?\d{2})?)$/.test(stored) ? stored : `${stored}Z`;
  return Date.parse(withZone) === Date.parse(written);
}
