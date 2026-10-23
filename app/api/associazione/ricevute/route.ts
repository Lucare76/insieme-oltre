import {
  authorize,
  AssociationError,
  jsonBody,
  privateHeaders,
  service,
  uuid,
} from "../../../../lib/associationServer";
import {
  receiptData,
  receiptIncome,
  receiptTitle,
  type Issuer,
  type Receipt,
  type ReceiptIncome,
} from "../../../../lib/receipts";
import { receiptPdf } from "../../../../lib/receiptPdf";
import { contactMailConfig } from "../../../../lib/contactMail";
import type { Movement } from "../../../../lib/accounting";

export const runtime = "nodejs";
const fields =
  "id,number,issued_on,movement_id,data,issuer,amount_cents,payment_date,cancelled,cancellation_reason,mail_status,sent_at";
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: privateHeaders });
const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(
    new Date(),
  );
function issuerConfig(): Issuer {
  const issuer = {
    name: process.env.RECEIPT_ISSUER_NAME?.trim() ?? "",
    tax_code: process.env.RECEIPT_ISSUER_TAX_CODE?.trim() ?? "",
    address: process.env.RECEIPT_ISSUER_ADDRESS?.trim() ?? "",
    representative: process.env.RECEIPT_ISSUER_REPRESENTATIVE?.trim() ?? "",
  };
  if (
    Object.values(issuer).some(
      (x) => !x || x.length > 240 || /[\u0000-\u001f]/.test(x),
    ) ||
    !/^\d{11}$/.test(issuer.tax_code)
  )
    throw new AssociationError(
      "Completa i dati dell’associazione nelle variabili RECEIPT_ISSUER_* prima di emettere ricevute.",
      503,
    );
  return issuer;
}
async function getReceipt(id: unknown) {
  if (!uuid(id)) throw new AssociationError("Ricevuta non valida.");
  const [r] = await (
    await service(`/rest/v1/association_receipts?id=eq.${id}&select=*`)
  ).json();
  if (!r) throw new AssociationError("Ricevuta non trovata.", 404);
  return r as Receipt & { pdf_base64: string | null };
}
async function pdfBytes(
  r: Receipt & { pdf_base64?: string | null },
  actor: string,
) {
  if (r.pdf_base64) return Buffer.from(r.pdf_base64, "base64");
  const pdf = await receiptPdf(r);
  await service(
    `/rest/v1/association_receipts?id=eq.${r.id}&pdf_base64=is.null`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdf_base64: pdf.toString("base64"),
        updated_by: actor,
      }),
    },
  );
  // Another request may have won the race: always use the archived bytes.
  const saved = await getReceipt(r.id);
  if (!saved.pdf_base64)
    throw new AssociationError("PDF non archiviato. Riprova il download.", 503);
  return Buffer.from(saved.pdf_base64, "base64");
}
async function handle(request: Request) {
  const user = await authorize(request, true);
  if (request.method === "GET") {
    const params = new URL(request.url).searchParams;
    if (params.has("id")) {
      const r = await getReceipt(params.get("id"));
      const pdf = r.cancelled
        ? await receiptPdf(r)
        : await pdfBytes(r, user.id);
      return new Response(new Uint8Array(pdf), {
        headers: {
          ...privateHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="ricevuta-${r.number}-${r.issued_on.slice(0, 4)}${r.cancelled ? "-annullata" : ""}.pdf"`,
        },
      });
    }
    const offset = Math.max(
      0,
      Math.min(1000000, Math.floor(Number(params.get("offset")) || 0)),
    );
    const items = await (
      await service(
        `/rest/v1/association_receipts?select=${fields}&order=number.desc&offset=${offset}&limit=50`,
      )
    ).json();
    let configured = true;
    try {
      issuerConfig();
    } catch {
      configured = false;
    }
    return reply({
      items,
      configured,
      mail_ready: Boolean(contactMailConfig()),
    });
  }
  const body = await jsonBody(request);
  if (body.action === "preview" || body.action === "issue") {
    const source = body.source ?? "existing";
    if (source !== "new" && source !== "existing")
      throw new AssociationError("Scegli come registrare l’incasso.");
    let income: ReceiptIncome | undefined;
    let movement: Movement;
    if (source === "new") {
      try {
        income = receiptIncome({ ...body, project: body.project ?? "" });
      } catch (error) {
        throw new AssociationError((error as Error).message);
      }
      movement = {
        ...income,
        id: "",
        version: 1,
        cancelled: false,
        cancellation_reason: null,
      };
    } else {
      if (!uuid(body.movement_id))
        throw new AssociationError("Seleziona un incasso.");
      const [existing] = (await (
        await service(
          `/rest/v1/association_movements?id=eq.${body.movement_id}&select=*`,
        )
      ).json()) as Movement[];
      if (!existing)
        throw new AssociationError("Seleziona un’entrata già incassata.");
      movement = existing;
      if (body.version !== movement.version)
        throw new AssociationError(
          "Movimento cambiato. Aggiorna la contabilità.",
          409,
        );
    }
    if (movement.date > today())
      throw new AssociationError("Seleziona un’entrata già incassata.");
    const issuer = issuerConfig();
    let data;
    try {
      data = receiptData(body, movement);
    } catch (e) {
      throw new AssociationError((e as Error).message);
    }
    if (body.confirmed !== true)
      throw new AssociationError(
        "Conferma che l’incasso e il tipo di ricevuta sono corretti.",
      );
    let pdf: Buffer;
    try {
      pdf = await receiptPdf(
        {
          id: "",
          number: 0,
          issued_on: today(),
          movement_id: movement.id,
          data,
          issuer,
          amount_cents: movement.amount_cents,
          payment_date: movement.date,
          cancelled: false,
          cancellation_reason: null,
          mail_status: "pending",
          sent_at: null,
        },
        true,
      );
    } catch (error) {
      throw new AssociationError(
        error instanceof Error ? error.message : "PDF non generabile.",
      );
    }
    if (body.action === "preview") {
      return new Response(new Uint8Array(pdf), {
        headers: {
          ...privateHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="anteprima-ricevuta.pdf"',
        },
      });
    }
    if (!uuid(body.id))
      throw new AssociationError("Identificativo richiesta mancante.");
    const result = await (
      await service(
        source === "new"
          ? "/rest/v1/rpc/association_issue_receipt_with_income"
          : "/rest/v1/rpc/association_issue_receipt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            p_id: body.id,
            ...(source === "new"
              ? { p_income: income }
              : { p_movement: movement.id, p_version: movement.version }),
            p_actor: user.id,
            p_data: data,
            p_issuer: issuer,
          }),
        },
      )
    ).json();
    const r = (Array.isArray(result) ? result[0] : result) as Receipt;
    // Issuance succeeds independently of PDF/network failures; the download can resume later.
    return reply({
      ok: true,
      id: r.id,
      number: r.number,
      movement_id: r.movement_id,
    });
  }
  const r = await getReceipt(body.id);
  if (body.action === "cancel") {
    if (
      typeof body.reason !== "string" ||
      body.reason.trim().length < 10 ||
      body.reason.length > 500
    )
      throw new AssociationError("Indica una motivazione di 10–500 caratteri.");
    const changed = await (
      await service(
        `/rest/v1/association_receipts?id=eq.${r.id}&cancelled=eq.false&mail_status=neq.sending`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            cancelled: true,
            cancellation_reason: body.reason.trim(),
            updated_by: user.id,
          }),
        },
      )
    ).json();
    if (!changed.length)
      throw new AssociationError(
        "Ricevuta già annullata o invio in corso.",
        409,
      );
    return reply({ ok: true });
  }
  if (body.action !== "send")
    throw new AssociationError("Operazione non valida.");
  if (r.cancelled || !r.data.email || body.confirm_email !== r.data.email)
    throw new AssociationError("Conferma l’indirizzo della ricevuta attiva.");
  const config = contactMailConfig();
  if (!config) throw new AssociationError("Invio email non configurato.", 503);
  const pdf = await pdfBytes(r, user.id);
  const claimed = await (
    await service(
      `/rest/v1/association_receipts?id=eq.${r.id}&cancelled=eq.false&mail_status=eq.pending`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ mail_status: "sending", updated_by: user.id }),
      },
    )
  ).json();
  if (!claimed.length)
    throw new AssociationError(
      "Email già accettata dal servizio, invio in corso o esito da verificare. Nessun nuovo invio eseguito.",
      409,
    );
  let response: Response;
  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      cache: "no-store",
      headers: { "api-key": config.apiKey, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        sender: { name: "Insieme Oltre", email: config.from },
        to: [{ email: r.data.email, name: r.data.name }],
        subject: `Ricevuta ${r.number}/${r.issued_on.slice(0, 4)} - Insieme Oltre`,
        textContent: `Gentile ${r.data.name},\n\nin allegato trovi la ${receiptTitle(r.data.type).toLowerCase()} n. ${r.number}/${r.issued_on.slice(0, 4)}.\n\nGrazie per il tuo sostegno.\n${r.issuer.name}`,
        attachment: [
          {
            name: `ricevuta-${r.number}-${r.issued_on.slice(0, 4)}.pdf`,
            content: pdf.toString("base64"),
          },
        ],
      }),
    });
  } catch {
    await service(`/rest/v1/association_receipts?id=eq.${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mail_status: "unknown", updated_by: user.id }),
    });
    throw new AssociationError(
      "Esito email incerto. Verifica su Brevo prima di qualsiasi nuovo invio; la ricevuta è salvata.",
      503,
    );
  }
  if (!response.ok) {
    await service(`/rest/v1/association_receipts?id=eq.${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mail_status: response.status >= 500 ? "unknown" : "pending",
        updated_by: user.id,
      }),
    });
    throw new AssociationError(
      "Brevo non ha confermato l’invio. La ricevuta è salvata. Verifica la configurazione e lo stato su Brevo.",
      503,
    );
  }
  const result = await response.json().catch(() => ({}));
  await service(`/rest/v1/association_receipts?id=eq.${r.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mail_status: "sent",
      sent_at: new Date().toISOString(),
      provider_id: result.messageId ?? null,
      updated_by: user.id,
    }),
  });
  return reply({ ok: true });
}
async function dispatch(request: Request) {
  try {
    return await handle(request);
  } catch (e) {
    return reply(
      {
        error:
          e instanceof AssociationError
            ? e.message
            : "Operazione non riuscita. La ricevuta eventualmente emessa resta nell’archivio.",
      },
      e instanceof AssociationError ? e.status : 503,
    );
  }
}
export { dispatch as GET, dispatch as POST };
