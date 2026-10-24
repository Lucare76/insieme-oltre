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

  // Il bucket viene verificato prima dell'upload: Storage può rispondere 400
  // (non solo 404) quando un bucket non esiste.
  const storageHeaders = { apikey: key, Authorization: `Bearer ${key}` };
  const bucketCheck = await fetch(`${url}/storage/v1/bucket/${BUCKET}`, {
    headers: storageHeaders,
    cache: "no-store",
  });
  if (bucketCheck.status === 404 || bucketCheck.status === 400) {
    const created = await fetch(`${url}/storage/v1/bucket`, {
      method: "POST",
      headers: { ...storageHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: BUCKET,
        name: BUCKET,
        public: false,
        file_size_limit: MAX_BYTES,
        allowed_mime_types: [...TYPES.keys()],
      }),
    });
    if (!created.ok && created.status !== 409) {
      const details = await created.json().catch(() => null);
      console.error("story-photo: bucket creation failed", created.status, details?.error ?? details?.message ?? "");
      return NextResponse.json({ error: "Archivio foto non disponibile. Controllare i permessi Storage della chiave Supabase.", code: "bucket_create_failed" }, { status: 502 });
    }
  } else if (!bucketCheck.ok) {
    console.error("story-photo: bucket check failed", bucketCheck.status);
    return NextResponse.json({ error: "Impossibile verificare l'archivio foto su Supabase.", code: "bucket_check_failed" }, { status: 502 });
  }

  const filename = randomUUID() + "." + ext;
  const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${filename}`, {
    method: "POST",
    headers: { ...storageHeaders, "Content-Type": file.type, "x-upsert": "false" },
    body: bytes,
  });
  if (!response.ok) {
    const details = await response.json().catch(() => null);
    console.error("story-photo: upload failed", response.status, details?.error ?? details?.message ?? "");
    return NextResponse.json({ error: "Caricamento fallito nell'archivio foto.", code: "storage_upload_failed" }, { status: 502 });
  }
  return NextResponse.json({ path: `/api/storie/foto/${filename}` });
}
