import {
  AssociationError,
  jsonBody,
  privateHeaders,
  service,
  uuid,
} from "../../../../lib/associationServer";
import {
  allSubmissions,
  authorizeQuestionnaires,
  ownedQuestionnaire,
  ownedSession,
  questionsOf,
  rpc,
  submissionPage,
} from "../../../../lib/questionnaireServer";
import {
  draftProblem,
  submissionsCsv,
  type DraftQuestion,
  type DraftQuestionnaire,
  type QsSession,
  type QsSubmission,
  type Questionnaire,
} from "../../../../lib/questionnaires";
import { submissionsPdf } from "../../../../lib/questionnairePdf";
import { validDate } from "../../../../lib/accounting";
export const runtime = "nodejs";

const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: privateHeaders });
const str = (value: unknown) => (typeof value === "string" ? value : "");
const fileName = (value: string) =>
  value.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "questionario";
function attachment(body: BodyInit, type: string, name: string) {
  return new Response(body, {
    headers: {
      ...privateHeaders,
      "Content-Type": type,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
function draft(body: Record<string, unknown>, withQuestions: boolean): DraftQuestionnaire {
  const retention = body.retention_months === null || body.retention_months === "" ? null : Number(body.retention_months);
  if (retention !== null && (!Number.isInteger(retention) || retention < 1 || retention > 120))
    throw new AssociationError("Periodo di conservazione non valido.");
  const value: DraftQuestionnaire = {
    title: str(body.title).trim(),
    description: str(body.description),
    meeting_ref: str(body.meeting_ref).trim(),
    retention_months: retention,
  };
  if (withQuestions) {
    if (!Array.isArray(body.questions)) throw new AssociationError("Domande non valide.");
    value.questions = body.questions.map((raw): DraftQuestion => {
      const q = (raw ?? {}) as Record<string, unknown>;
      if (!["single", "multiple", "text"].includes(str(q.kind)))
        throw new AssociationError("Tipo di domanda non valido.");
      return {
        kind: q.kind as DraftQuestion["kind"],
        prompt: str(q.prompt).trim(),
        help: str(q.help).trim(),
        required: q.required !== false,
        options: q.kind === "text" ? [] : (Array.isArray(q.options) ? q.options : []).map((o) => str(o).trim()),
      };
    });
  }
  const problem = draftProblem(value);
  if (problem) throw new AssociationError(problem);
  return value;
}

async function handle(request: Request, route: string) {
  const user = await authorizeQuestionnaires(request);
  const params = new URL(request.url).searchParams;
  if (request.method === "GET") {
    if (route === "list") {
      // Conservazione configurata: le compilazioni scadute vengono cancellate prima della consultazione.
      await rpc("qs_purge_expired", {});
      const items = await (
        await service(
          `/rest/v1/qs_questionnaires?select=*,qs_sessions(id,label,status,submission_count,meeting_date,created_at)${user.role === "owner" ? "" : `&owner_id=eq.${user.id}`}&order=updated_at.desc&limit=1000`,
        )
      ).json();
      return reply({ user, items });
    }
    if (route === "questionnaire") {
      const questionnaire = await ownedQuestionnaire(user, params.get("id"));
      const sessions = await (
        await service(`/rest/v1/qs_sessions?questionnaire_id=eq.${questionnaire.id}&select=*&order=created_at.desc`)
      ).json();
      return reply({ questionnaire, questions: await questionsOf(questionnaire.id), sessions });
    }
    const { session, questionnaire } = await ownedSession(user, params.get("session"));
    const questions = await questionsOf(questionnaire.id);
    if (route === "submissions") {
      const offset = Number(params.get("offset") || 0);
      if (!Number.isSafeInteger(offset) || offset < 0) throw new AssociationError("Pagina non valida.");
      const total = Number(
        (await service(`/rest/v1/qs_submissions?session_id=eq.${session.id}&select=id&limit=1`, { headers: { Prefer: "count=exact" } }))
          .headers.get("content-range")?.split("/")[1] ?? 0,
      );
      const items = await submissionPage(session.id, offset, 25);
      return reply({ session, questionnaire, questions, items, total });
    }
    if (route === "submission") {
      const seq = Number(params.get("seq"));
      if (!Number.isSafeInteger(seq) || seq < 1) throw new AssociationError("Compilazione non valida.");
      const base = `/rest/v1/qs_submissions?session_id=eq.${session.id}`;
      const [[submission], [prev], [next]] = await Promise.all([
        (await service(`${base}&seq=eq.${seq}&select=id,seq,submitted_at,qs_answers(question_id,option_ids,text_value)`)).json() as Promise<QsSubmission[]>,
        (await service(`${base}&seq=lt.${seq}&select=seq&order=seq.desc&limit=1`)).json() as Promise<{ seq: number }[]>,
        (await service(`${base}&seq=gt.${seq}&select=seq&order=seq&limit=1`)).json() as Promise<{ seq: number }[]>,
      ]);
      if (!submission) throw new AssociationError("Compilazione non trovata.", 404);
      return reply({ session, questionnaire, questions, submission, prev: prev?.seq ?? null, next: next?.seq ?? null });
    }
    if (route === "stats")
      return reply({ session, questionnaire, questions, stats: await rpc("qs_session_stats", { p_session: session.id }) });
    if (route === "texts") {
      const question = params.get("question");
      if (!uuid(question) || !questions.some((q) => q.id === question && q.kind === "text"))
        throw new AssociationError("Domanda non valida.");
      const items = (await allSubmissions(session.id)).flatMap((s) => {
        const answer = s.qs_answers.find((a) => a.question_id === question);
        return answer?.text_value ? [{ seq: s.seq, text: answer.text_value }] : [];
      });
      return reply({ items });
    }
    if (route === "export.csv")
      return attachment(
        submissionsCsv(questions, await allSubmissions(session.id)),
        "text/csv; charset=utf-8",
        `${fileName(questionnaire.title)}-${fileName(session.label)}.csv`,
      );
    if (route === "export.pdf") {
      const seq = params.get("seq");
      let submissions = await allSubmissions(session.id);
      if (seq) submissions = submissions.filter((s) => String(s.seq) === seq);
      if (seq && !submissions.length) throw new AssociationError("Compilazione non trovata.", 404);
      const pdf = await submissionsPdf({ title: questionnaire.title, sessionLabel: session.label, questions, submissions });
      return attachment(
        new Uint8Array(pdf),
        "application/pdf",
        `${fileName(questionnaire.title)}-${fileName(session.label)}${seq ? "-" + seq.padStart(3, "0") : ""}.pdf`,
      );
    }
    throw new AssociationError("Pagina non trovata.", 404);
  }
  if (request.method !== "POST") throw new AssociationError("Operazione non disponibile.", 405);
  // Editor: struttura completa del questionario, ben oltre il limite generico di 16 KB.
  const body = await jsonBody(request, 1_000_000);
  if (route === "save") {
    const existing = body.id ? await ownedQuestionnaire(user, body.id) : null;
    if (existing && (!Number.isInteger(body.version) || Number(body.version) < 1))
      throw new AssociationError("Versione non valida.");
    const value = draft(body, !existing || existing.status === "draft");
    const saved = await rpc<Questionnaire>("qs_save", {
      p_actor: user.id,
      p_id: existing?.id ?? null,
      p_version: existing ? body.version : null,
      p_data: value,
    });
    return reply({ ok: true, questionnaire: saved });
  }
  if (route === "status") {
    const q = await ownedQuestionnaire(user, body.id);
    if (!["publish", "close", "reopen", "archive", "restore", "draft"].includes(str(body.action)))
      throw new AssociationError("Operazione non valida.");
    return reply({ ok: true, questionnaire: await rpc<Questionnaire>("qs_set_status", { p_actor: user.id, p_id: q.id, p_action: body.action }) });
  }
  if (route === "duplicate") {
    const q = await ownedQuestionnaire(user, body.id);
    return reply({ ok: true, questionnaire: await rpc<Questionnaire>("qs_duplicate", { p_actor: user.id, p_id: q.id }) });
  }
  if (route === "delete") {
    const q = await ownedQuestionnaire(user, body.id);
    await rpc("qs_delete_draft", { p_actor: user.id, p_id: q.id });
    return reply({ ok: true });
  }
  if (route === "session") {
    const q = await ownedQuestionnaire(user, body.questionnaire_id);
    const label = str(body.label).trim();
    if (!label || label.length > 200) throw new AssociationError("Indica il nome della sessione (massimo 200 caratteri).");
    if (body.meeting_date && !validDate(body.meeting_date)) throw new AssociationError("Data dell’incontro non valida.");
    return reply({
      ok: true,
      session: await rpc<QsSession>("qs_new_session", { p_actor: user.id, p_questionnaire: q.id, p_label: label, p_date: body.meeting_date || null }),
    });
  }
  if (route === "session-status") {
    const { session } = await ownedSession(user, body.id);
    if (typeof body.open !== "boolean") throw new AssociationError("Operazione non valida.");
    return reply({ ok: true, session: await rpc<QsSession>("qs_session_status", { p_actor: user.id, p_session: session.id, p_open: body.open }) });
  }
  if (route === "delete-results") {
    const { session } = await ownedSession(user, body.id);
    if (body.confirm !== session.label) throw new AssociationError("Conferma non valida: scrivi il nome esatto della sessione.");
    return reply({ ok: true, deleted: await rpc<number>("qs_delete_results", { p_actor: user.id, p_session: session.id }) });
  }
  throw new AssociationError("Operazione non disponibile.", 404);
}

async function dispatch(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    return await handle(request, (await context.params).path.join("/"));
  } catch (error) {
    return reply(
      { error: error instanceof AssociationError ? error.message : "Servizio temporaneamente non disponibile." },
      error instanceof AssociationError ? error.status : 503,
    );
  }
}
export { dispatch as GET, dispatch as POST };
