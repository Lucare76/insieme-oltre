import { csvCell } from "./accounting";

export type QuestionKind = "single" | "multiple" | "text";
export type QuestionnaireStatus = "draft" | "published" | "closed" | "archived";
export type QsOption = { id: string; label: string };
export type QsQuestion = {
  id: string;
  kind: QuestionKind;
  prompt: string;
  help: string;
  required: boolean;
  options: QsOption[];
};
export type Questionnaire = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  meeting_ref: string;
  status: QuestionnaireStatus;
  retention_months: number | null;
  version: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};
export type QsSession = {
  id: string;
  questionnaire_id: string;
  token: string;
  label: string;
  meeting_date: string | null;
  status: "open" | "closed";
  submission_count: number;
  created_at: string;
  closed_at: string | null;
};
export type QsAnswer = {
  question_id: string;
  option_ids: string[] | null;
  text_value: string | null;
};
export type QsSubmission = {
  id: string;
  seq: number;
  submitted_at: string;
  qs_answers: QsAnswer[];
};
/** Risposte inviate dal partecipante: chiave = id della domanda. */
export type AnswerInput = Record<string, { options?: string[]; text?: string }>;

export const statusLabels: Record<QuestionnaireStatus, string> = {
  draft: "Bozza",
  published: "Pubblicato",
  closed: "Chiuso",
  archived: "Archiviato",
};
export const kindLabels: Record<QuestionKind, string> = {
  single: "Scelta singola",
  multiple: "Scelta multipla",
  text: "Risposta libera",
};
export const retentionChoices = [
  { value: "", label: "Fino a cancellazione manuale" },
  { value: "3", label: "3 mesi" },
  { value: "6", label: "6 mesi" },
  { value: "12", label: "12 mesi" },
  { value: "24", label: "24 mesi" },
];

/** Numero di consultazione: progressivo nella sessione, non un identificativo personale. */
export const anonymousLabel = (seq: number) =>
  "Questionario anonimo " + String(seq).padStart(3, "0");

export function answerText(question: QsQuestion, answer?: QsAnswer) {
  if (!answer) return "";
  if (question.kind === "text") return answer.text_value ?? "";
  return question.options
    .filter((o) => answer.option_ids?.includes(o.id))
    .map((o) => o.label)
    .join(" | ");
}

export function retentionText(months: number | null) {
  return months
    ? `Le risposte vengono cancellate automaticamente ${months} mesi dopo l’invio.`
    : "Le risposte vengono conservate fino alla cancellazione decisa dall’associazione.";
}

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
export { dateTime as qsDateTime };

/** Una riga per compilazione, una colonna per domanda: testo integrale, nessun troncamento. */
export function submissionsCsv(questions: QsQuestion[], submissions: QsSubmission[]) {
  const header = [
    "Compilazione",
    "Inviata",
    ...questions.map((q, n) => `D${n + 1}. ${q.prompt}`),
  ];
  const rows = submissions.map((s) => [
    anonymousLabel(s.seq),
    dateTime(s.submitted_at),
    ...questions.map((q) =>
      answerText(q, s.qs_answers.find((a) => a.question_id === q.id)),
    ),
  ]);
  return (
    "﻿" +
    [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")
  );
}

export type DraftQuestion = {
  kind: QuestionKind;
  prompt: string;
  help: string;
  required: boolean;
  options: string[];
};
export type DraftQuestionnaire = {
  title: string;
  description: string;
  meeting_ref: string;
  retention_months: number | null;
  questions?: DraftQuestion[];
};

/** Validazione condivisa tra editor e server. Restituisce il messaggio d’errore o null. */
export function draftProblem(draft: DraftQuestionnaire): string | null {
  if (!draft.title.trim() || draft.title.length > 200)
    return "Inserisci un titolo (massimo 200 caratteri).";
  if (draft.description.length > 5000 || draft.meeting_ref.length > 200)
    return "Descrizione o riferimento dell’incontro troppo lunghi.";
  for (const [n, q] of (draft.questions ?? []).entries()) {
    if (!q.prompt.trim()) return `Scrivi il testo della domanda ${n + 1}.`;
    if (q.prompt.length > 2000 || q.help.length > 2000)
      return `Il testo della domanda ${n + 1} è troppo lungo.`;
    if (q.kind !== "text") {
      if (q.options.length < 2)
        return `La domanda ${n + 1} deve avere almeno due opzioni.`;
      if (q.options.some((o) => !o.trim() || o.length > 500))
        return `Completa le opzioni della domanda ${n + 1}.`;
      if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length)
        return `La domanda ${n + 1} contiene opzioni ripetute.`;
    }
  }
  return null;
}
