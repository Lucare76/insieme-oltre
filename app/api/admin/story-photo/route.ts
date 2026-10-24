import { requireAdmin } from "../../../../lib/adminAuth";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

const BUCKET = "story-photos";
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Archivio non configurato" }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) return NextResponse.json({ error: "Seleziona un'immagine" }, { status: 400 });
  const ext = TYPES.get(file.type);
  if (!ext || file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Usa JPG, PNG o WEBP fino a 5 MB." }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!(ext === "jpg" && jpeg || ext === "png" && png || ext === "webp" && webp))
    return NextResponse.json({ error: "Formato immagine non valido." }, { status: 400 });

  const filename = randomUUID() + "." + ext;
  let response = await fetch(`${url}/storage/v1/object/${BUCKET}/${filename}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": file.type, "x-upsert": "false" },
    body: bytes,
  });
  if (!response.ok && response.status === 404) {
    const create = await fetch(`${url}/storage/v1/bucket`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: MAX_BYTES, allowed_mime_types: [...TYPES.keys()] }),
    });
    if (create.ok || create.status === 409) {
      response = await fetch(`${url}/storage/v1/object/${BUCKET}/${filename}`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": file.type, "x-upsert": "false" },
        body: bytes,
      });
    }
  }
  if (!response.ok) return NextResponse.json({ error: "Caricamento non riuscito. Controlla la configurazione di Supabase Storage." }, { status: 502 });
  return NextResponse.json({ path: `/api/storie/foto/${filename}` });
}
