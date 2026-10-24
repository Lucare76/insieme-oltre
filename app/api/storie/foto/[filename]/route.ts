import { NextResponse } from "next/server";

type Props = { params: Promise<{ filename: string }> };
export async function GET(_request: Request, { params }: Props) {
  const { filename } = await params;
  if (!/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(filename)) return new Response(null, { status: 404 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Response(null, { status: 503 });
  const response = await fetch(`${url}/storage/v1/object/story-photos/${filename}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    next: { revalidate: 3600 },
  });
  if (!response.ok) return new Response(null, { status: 404 });
  const ext = filename.split(".").pop();
  return new NextResponse(response.body, {
    headers: {
      "Content-Type": ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
