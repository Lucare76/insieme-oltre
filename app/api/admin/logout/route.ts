import { NextResponse } from "next/server";
import { bearerToken, signOutAdmin } from "../../../../lib/adminAuth";

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (token) await signOutAdmin(token);
  return NextResponse.json({ ok: true });
}
