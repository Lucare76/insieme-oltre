import { handleAccess } from "../../../../lib/accessServer";
import {
  AssociationError,
  privateHeaders,
} from "../../../../lib/associationServer";
export const runtime = "nodejs";
async function dispatch(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    return Response.json(
      await handleAccess(request, (await context.params).path.join("/")),
      { headers: privateHeaders },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof AssociationError
            ? error.message
            : "Servizio temporaneamente non disponibile.",
      },
      {
        status: error instanceof AssociationError ? error.status : 503,
        headers: privateHeaders,
      },
    );
  }
}
export { dispatch as GET, dispatch as POST };
