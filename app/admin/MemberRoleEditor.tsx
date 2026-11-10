"use client";

import { useEffect, useState } from "react";

export type MemberAccessRole = "member" | "president" | "accountant" | "none";

const descriptions: Record<MemberAccessRole, string> = {
  member: "Socio — può consultare la contabilità",
  president: "Presidente — può gestire Libri sociali e consultare la contabilità",
  accountant: "Tesoriere — può gestire contabilità e Libri sociali",
  none: "Solo Psicologa — accesso ai questionari",
};

export function MemberRoleEditor({
  member,
  busy,
  onSave,
}: {
  member: { user_id: string; name: string; role: MemberAccessRole; username: string | null; psychologist: boolean };
  busy: boolean;
  onSave: (role: MemberAccessRole) => Promise<void>;
}) {
  const [role, setRole] = useState<MemberAccessRole>(member.role);

  useEffect(() => {
    setRole(member.role);
  }, [member.role, member.user_id]);

  const canSubmit = !busy && role !== member.role && Boolean(member.username?.trim())
    && (role !== "none" || member.psychologist);
  const confirm = () => {
    if (!canSubmit) return;
    if (!window.confirm(
      "Confermi il cambio di ruolo per " + member.name + "?\n\n"
      + "Da: " + descriptions[member.role] + "\n"
      + "A: " + descriptions[role] + "\n\n"
      + "Il cambio modifica i permessi di accesso al gestionale, non la nomina statutaria."
    )) return;
    void onSave(role);
  };
  return <div className="admin-member-role">
    <label htmlFor={"role-" + member.user_id}>Ruolo nel gestionale
      <select
        id={"role-" + member.user_id}
        value={role}
        disabled={busy}
        onChange={event => setRole(event.target.value as MemberAccessRole)}
      >
        <option value="member">Socio</option>
        <option value="president">Presidente</option>
        <option value="accountant">Tesoriere</option>
        {(member.psychologist || member.role === "none") && <option value="none" disabled={!member.psychologist}>Solo Psicologa</option>}
      </select>
    </label>
    <button type="button" className="admin-member-role-save" disabled={!canSubmit} onClick={confirm}>
      {busy ? "Salvataggio…" : "Salva ruolo"}
    </button>
    {!member.username && <small>Assegna prima un nome utente tramite Gestisci.</small>}
  </div>;
}
