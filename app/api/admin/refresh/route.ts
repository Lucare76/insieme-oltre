import { NextResponse } from "next/server";
import { refreshAdminSession } from "../../../../lib/adminAuth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { refresh_token?: unknown } | null;
  const refreshToken = typeof body?.refresh_token === "string" ? body.refresh_token : "";

  // Rinnova la sessione solo se il refresh token appartiene ancora all'account autorizzato.
  const session = refreshToken ? await refreshAdminSession(refreshToken) : null;
  if (!session) {
    return NextResponse.json({ error: "Sessione scaduta" }, { status: 401 });
  }

  return NextResponse.json({ session }, { headers: { "Cache-Control": "no-store" } });
}
