import { NextResponse } from "next/server";
import { isAuthConfigured, signInAdmin, usernameMatches } from "../../../../lib/adminAuth";

const INVALID = { error: "Credenziali non valide" };
/** Ogni tentativo fallito dura almeno così: i tempi non rivelano se era sbagliato lo username o la password. */
const MIN_FAILURE_MS = 700;

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "Accesso non configurato" }, { status: 503 });
  }

  const startedAt = Date.now();
  const fail = async () => {
    const wait = MIN_FAILURE_MS - (Date.now() - startedAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    return NextResponse.json(INVALID, { status: 401 });
  };

  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password || username.length > 200 || password.length > 200) return fail();
  if (!usernameMatches(username)) return fail();

  const session = await signInAdmin(password);
  if (!session) return fail();

  return NextResponse.json({ session }, { headers: { "Cache-Control": "no-store" } });
}
