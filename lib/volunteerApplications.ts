import { service } from "./associationServer";
import type { ContactMessage } from "./contact";

// Solo le richieste esplicitamente selezionate come volontari.
// Il messaggio libero rimane nell'email: non archiviamo possibili dati sensibili.
export async function recordVolunteerApplication(message: ContactMessage) {
  if (message.role !== "Un volontario") return;
  const existingResponse = await service(
    "/rest/v1/association_volunteer_applications?email=eq." + encodeURIComponent(message.email.toLowerCase()) + "&select=id&limit=1",
  );
  const existing = await existingResponse.json() as { id: string }[];
  if (existing.length) return; // Non sovrascrivere note, stato e disponibilità già gestiti.
  await service("/rest/v1/association_volunteer_applications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify({ name: message.name, email: message.email.toLowerCase(), phone: message.phone, source: "site" }),
  });
}
