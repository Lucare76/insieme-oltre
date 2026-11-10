"use client";

import Link from "next/link";
import type { AssociationRole } from "../../lib/accounting";

type Section = "home" | "register" | "fundraising" | "receipts" | "whatsapp" | "requests" | "contents" | "stories" | "members" | "audit";
type IconName = "home" | "wallet" | "heart" | "receipt" | "users" | "clipboard" | "chat" | "file" | "book" | "usercheck" | "shield" | "history" | "ideas" | "external";

function NavIcon({ name }: { name: IconName }) {
 const shared = { stroke: "currentColor", strokeWidth: 1.85, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
 const shapes: Record<IconName, React.ReactNode> = {
  home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9"/><path d="M9 21v-7h6v7"/></>,
  wallet: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 9h18"/><path d="M16 15h2"/></>,
  heart: <><path d="M20.7 9.1c0 4.7-8.7 10.3-8.7 10.3S3.3 13.8 3.3 9.1a4.6 4.6 0 0 1 8.7-2 4.6 4.6 0 0 1 8.7 2Z"/></>,
  receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2"/><path d="M17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1"/></>,
  clipboard: <><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h6"/></>,
  chat: <><path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 10h8M8 13h5"/></>,
  file: <><path d="M6 2h9l4 4v16H6Z"/><path d="M15 2v5h4M9 12h7M9 16h7"/></>,
  book: <><path d="M12 6c-2.5-1.5-5-1.5-9-1v14c4-.5 6.5-.5 9 1 2.5-1.5 5-1.5 9-1V5c-4-.5-6.5-.5-9 1Z"/><path d="M12 6v14"/></>,
  usercheck: <><circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 10-4.5"/><path d="m15 18 2 2 4-5"/></>,
  shield: <><path d="m12 2 8 4v6c0 5-4 8-8 10-4-2-8-5-8-10V6Z"/><path d="M9 12h6M12 9v6"/></>,
  history: <><path d="M3 11a9 9 0 1 1 3 7"/><path d="M3 4v7h7M12 7v5l3 2"/></>,
  ideas: <><path d="M9 18h6M10 22h4M8 14c-2-1.5-3-3-3-5a7 7 0 1 1 14 0c0 2-1 3.5-3 5l-1 2H9l-1-2Z"/></>,
  external: <><path d="M14 4h6v6M20 4l-9 9"/><path d="M20 14v6H4V4h6"/></>,
 };
 return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" {...shared} aria-hidden="true">{shapes[name]}</svg>;
}

export function AdminSidebar({
 tab, onNavigate, role, psychologist, canWrite, whatsappAllowed, pending, mobileOpen, onDismiss,
}: {
 tab: string;
 onNavigate: (next: Section) => void;
 role: AssociationRole;
 psychologist: boolean;
 canWrite: boolean;
 whatsappAllowed: boolean;
 pending: number;
 mobileOpen: boolean;
 onDismiss: () => void;
}) {
 const owner = role === "owner";
 const canManageBooks = owner || role === "president" || role === "accountant";
 const select = (name: Section) => { onDismiss(); onNavigate(name); };
 const ButtonItem = ({ id, label, icon, badge }: { id: Section; label: string; icon: IconName; badge?: number }) =>
  <button type="button" className="admin-side-item" aria-current={tab === id ? "page" : undefined} onClick={() => select(id)}>
   <span className="admin-side-icon"><NavIcon name={icon}/></span>
   <span className="admin-side-label">{label}</span>
   {badge !== undefined && badge > 0 && <span className="admin-side-count" aria-label={badge + " richieste in attesa"}>{badge}</span>}
  </button>;
 const LinkItem = ({ href, label, icon }: { href: string; label: string; icon: IconName }) =>
  <Link className="admin-side-item" href={href} onClick={onDismiss}>
   <span className="admin-side-icon"><NavIcon name={icon}/></span><span className="admin-side-label">{label}</span>
   <span className="admin-side-link-mark" aria-hidden="true">↗</span>
  </Link>;
 return <>
  {mobileOpen && <button type="button" className="admin-side-backdrop" aria-label="Chiudi menu di navigazione" onClick={onDismiss}/>}
  <aside className={"admin-sidebar" + (mobileOpen ? " is-open" : "")} id="admin-site-navigation" aria-label="Navigazione area riservata">
   <div className="admin-sidebar-head">
    <div><span className="admin-sidebar-eyebrow">INSIEME OLTRE</span><strong>Workspace</strong></div>
    <button type="button" className="admin-sidebar-close" onClick={onDismiss} aria-label="Chiudi menu">×</button>
   </div>
   <nav aria-label="Sezioni dell'amministrazione" className="admin-sidebar-navigation">
    <div className="admin-side-group">
     <p className="admin-side-group-label">PANORAMICA</p>
     <ButtonItem id="home" label="Dashboard" icon="home"/>
    </div>
    <div className="admin-side-group">
     <p className="admin-side-group-label">GESTIONE ECONOMICA</p>
     <ButtonItem id="register" label="Contabilità" icon="wallet"/>
     <ButtonItem id="fundraising" label="Raccolte fondi" icon="heart"/>
     {canWrite && <ButtonItem id="receipts" label="Ricevute" icon="receipt"/>}
    </div>
    <div className="admin-side-group">
     <p className="admin-side-group-label">VITA ASSOCIATIVA</p>
     {canManageBooks && <LinkItem href="/admin/libri-sociali" label="Libri sociali" icon="book"/>}
     {(owner || psychologist) && <LinkItem href="/admin/questionari" label="Questionari" icon="clipboard"/>}
     {owner && <LinkItem href="/admin/partecipazioni" label="Idee delle famiglie" icon="ideas"/>}
    </div>
    {(whatsappAllowed || owner) && <div className="admin-side-group">
     <p className="admin-side-group-label">COMUNICAZIONE</p>
     {whatsappAllowed && <ButtonItem id="whatsapp" label="WhatsApp" icon="chat"/>}
     {owner && <ButtonItem id="contents" label="Contenuti del sito" icon="file"/>}
     {owner && <ButtonItem id="stories" label="Storie delle famiglie" icon="heart"/>}
    </div>}
    {owner && <div className="admin-side-group">
     <p className="admin-side-group-label">AMMINISTRAZIONE</p>
     <ButtonItem id="requests" label="Richieste di accesso" icon="usercheck" badge={pending}/>
     <ButtonItem id="members" label="Utenti e permessi" icon="shield"/>
     <ButtonItem id="audit" label="Storico operazioni" icon="history"/>
    </div>}
   </nav>
   <div className="admin-sidebar-footer">
    <Link href="/" className="admin-sidebar-website" onClick={onDismiss}><NavIcon name="external"/> Vai al sito</Link>
    <span>Insieme Oltre ODV · Ischia</span>
   </div>
  </aside>
 </>;
}
