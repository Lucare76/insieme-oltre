import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const admin=readFileSync("app/admin/page.tsx","utf8");

test("il pannello permette di aggiornare esplicitamente l'elenco utenti",()=>{
 assert.ok(admin.includes("Aggiorna elenco utenti"));
 assert.ok(admin.includes('const response = await api("members")'));
 assert.ok(admin.includes("setMembers(result.items)"));
 assert.ok(admin.includes("Elenco utenti aggiornato."));
});

test("form invito manuale non fallisce silenziosamente per validazioni browser",()=>{
 assert.ok(admin.includes('<form noValidate className="receipt-form"'));
 assert.ok(admin.includes('if (fields.confirm !== "on")'));
 assert.ok(admin.includes("setManualInviteFeedback("));
 assert.ok(admin.includes('role="status" aria-live="polite">{manualInviteFeedback}'));
 assert.ok(admin.includes("if (adminFormSubmitting.current) return"));
 assert.ok(admin.includes('api("access/manual-request"'));
 assert.ok(admin.includes('setTab("requests")'));
 const emailPattern=String.raw`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`;
 assert.ok(admin.includes(emailPattern));
});

test("form permessi mostra i problemi vicino al pulsante e recupera da errore di refresh",()=>{
 assert.ok(admin.includes('key={memberEdit.user_id}\n                    noValidate'));
 assert.ok(admin.includes('setMembersFeedback("Nome utente non valido:'));
 assert.ok(admin.includes('setMembersFeedback("Permessi salvati, ma l\'elenco non è stato aggiornato.'));
 assert.ok(admin.includes('role="status" aria-live="polite">{membersFeedback}'));
 assert.ok(admin.includes("await post(\"members\""));
 assert.ok(admin.includes("user_id: memberEdit.user_id"));
});
