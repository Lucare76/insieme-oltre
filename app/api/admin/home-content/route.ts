import { NextResponse } from "next/server";
import { childIssues, normalizeChildren, slugify } from "../../../../lib/children";
import { defaultHomeContent, getHomeContent } from "../../../../lib/siteContent";

const allowedEmail = (process.env.ADMIN_ALLOWED_EMAIL ?? "luca_renna@hotmail.com").toLowerCase();

async function getAuthenticatedEmail(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");

  if (!supabaseUrl || !anonKey || !token) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const user = (await response.json()) as { email?: string };
  return user.email?.toLowerCase() ?? null;
}

async function requireAdmin(request: Request) {
  const email = await getAuthenticatedEmail(request);
  return email === allowedEmail;
}

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

  const response = await fetch(`${supabaseUrl}/rest/v1/site_content`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    // updated_at è obbligatoria nella tabella e non ha un valore predefinito: senza, Supabase rifiuta ogni salvataggio.
    body: JSON.stringify({ key: "home", value, updated_at: new Date().toISOString() }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: "Salvataggio non riuscito", detail }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
