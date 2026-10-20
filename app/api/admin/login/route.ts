import { loginByUsername } from "../../../../lib/accessServer";
import {
  AssociationError,
  privateHeaders,
} from "../../../../lib/associationServer";
export async function POST(request: Request) {
  const started = Date.now();
  try {
    return Response.json(await loginByUsername(request), {
      headers: privateHeaders,
    });
  } catch (error) {
    const wait = 700 - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return Response.json(
      {
        error:
          error instanceof AssociationError
            ? error.message
            : "Accesso temporaneamente non disponibile.",
      },
      {
        status: error instanceof AssociationError ? error.status : 503,
        headers: privateHeaders,
      },
    );
  }
}
