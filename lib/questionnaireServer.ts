import { createHmac } from "node:crypto";
import { bearerToken } from "./adminAuth";
import { AssociationError, identity, service, uuid } from "./associationServer";
import type {
  QsQuestion,
  QsSession,
  QsSubmission,
  Questionnaire,
} from "./questionnaires";

export type QsUser = Awaited<ReturnType<typeof identity>>;

export async function rpc<T>(name: string, body: unknown): Promise<T> {
  const payload = await (
    await service(`/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ).json();
  return (Array.isArray(payload) ? payload[0] : payload) as T;
}
const rows = async <T>(path: string) => (await service(path)).json() as Promise<T[]>;

/** Super admin o ruolo Psicologa: gli altri ruoli non vedono i questionari. */
export async function authorizeQuestionnaires(request: Request) {
  const token = bearerToken(request);
  if (!token) throw new AssociationError("Accedi all'area riservata.", 401);
  const user = await identity(token);
  if (user.role !== "owner" && !user.psychologist)
    throw new AssociationError("Area riservata ai questionari.", 403);
  return user;
}

/** Ogni professionista vede solo i propri questionari; il super admin li vede tutti. */
export async function ownedQuestionnaire(user: QsUser, id: unknown) {
  if (!uuid(id)) throw new AssociationError("Questionario non valido.");
  const [q] = await rows<Questionnaire>(
    `/rest/v1/qs_questionnaires?id=eq.${id}&select=*`,
  );
  // Stessa risposta per inesistente e non autorizzato: nessuna enumerazione.
  if (!q || (user.role !== "owner" && q.owner_id !== user.id))
    throw new AssociationError("Questionario non trovato.", 404);
  return q;
}
export async function ownedSession(user: QsUser, id: unknown) {
  if (!uuid(id)) throw new AssociationError("Sessione non valida.");
  const [session] = await rows<QsSession>(
    `/rest/v1/qs_sessions?id=eq.${id}&select=*`,
  );
  if (!session) throw new AssociationError("Sessione non trovata.", 404);
  return { session, questionnaire: await ownedQuestionnaire(user, session.questionnaire_id) };
}

type QuestionRow = Omit<QsQuestion, "options"> & {
  qs_options: { id: string; label: string; position: number }[];
};
export async function questionsOf(questionnaireId: string): Promise<QsQuestion[]> {
  const items = await rows<QuestionRow>(
    `/rest/v1/qs_questions?questionnaire_id=eq.${questionnaireId}&select=id,kind,prompt,help,required,qs_options(id,label,position)&order=position`,
  );
  return items.map(({ qs_options, ...q }) => ({
    ...q,
    options: [...qs_options]
      .sort((a, b) => a.position - b.position)
      .map(({ id, label }) => ({ id, label })),
  }));
}

/** Tutte le compilazioni della sessione, a pagine: nessun limite al numero di partecipanti. */
export async function allSubmissions(sessionId: string) {
  const items: QsSubmission[] = [];
  for (let offset = 0; ; offset += 200) {
    const page = await submissionPage(sessionId, offset, 200);
    items.push(...page);
    if (page.length < 200) return items;
  }
}
export function submissionPage(sessionId: string, offset: number, limit: number) {
  return rows<QsSubmission>(
    `/rest/v1/qs_submissions?session_id=eq.${sessionId}&select=id,seq,submitted_at,qs_answers(question_id,option_ids,text_value)&order=seq&offset=${offset}&limit=${limit}`,
  );
}

export type PublicQuestionnaire = {
  title: string;
  description: string;
  sessionLabel: string;
  open: boolean;
  retention_months: number | null;
  questions: QsQuestion[];
};
/** Struttura pubblica: nessun dato su risposte, proprietario o altre sessioni. */
export async function publicQuestionnaire(token: string): Promise<PublicQuestionnaire | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const [session] = await rows<
    QsSession & { qs_questionnaires: Questionnaire }
  >(
    `/rest/v1/qs_sessions?token=eq.${token}&select=label,status,questionnaire_id,qs_questionnaires(title,description,status,retention_months)`,
  );
  const q = session?.qs_questionnaires;
  if (!q || q.status === "draft") return null;
  return {
    title: q.title,
    description: q.description,
    sessionLabel: session.label,
    open: session.status === "open" && q.status === "published",
    retention_months: q.retention_months,
    questions: await questionsOf(session.questionnaire_id),
  };
}

/** Hash dell’IP solo per il limite anti-abuso: nessun indirizzo salvato in chiaro. */
export async function submitLimit(request: Request) {
  const ip =
    process.env.VERCEL === "1"
      ? request.headers.get("x-vercel-forwarded-for")
      : "local";
  const key = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "unconfigured")
    .update("qs:" + (ip || "unknown"))
    .digest("hex");
  if (!(await rpc<boolean>("qs_submit_limit", { p_key: key })))
    throw new AssociationError("Troppi invii dalla stessa rete. Riprova tra qualche minuto.", 429);
}
