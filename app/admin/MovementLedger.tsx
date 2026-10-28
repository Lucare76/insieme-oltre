import { useEffect, useId, useRef, useState } from "react";
import { balances, kindLabels, type Movement } from "../../lib/accounting";
import {
  activeExtraFilters,
  defaultMovementFilters,
  hasActiveFilters,
  movementsLabel,
  type MovementFilters,
} from "../../lib/movementFilters";
import "./ledger.css";
const money = (n: number) =>
  (n / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const dateLabel = (v: string) => v.split("-").reverse().join("/");
const accountLabel = (m: Movement) =>
  (m.account === "bank" ? "Banca" : "Cassa") +
  (m.kind === "transfer" ? (m.account === "bank" ? " → Cassa" : " → Banca") : "");
const amountLabel = (m: Movement) =>
  (m.kind === "expense" ? "− " : m.kind === "income" ? "+ " : "") +
  money(m.amount_cents);
const accountOptions = { cash: "Cassa contanti", bank: "Conto bancario" };

// Chiude con clic o tocco fuori dagli elementi indicati.
function useOutside(
  open: boolean,
  setOpen: (open: boolean) => void,
  a: React.RefObject<HTMLElement | null>,
  b: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!a.current?.contains(target) && !b.current?.contains(target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open, setOpen, a, b]);
}

function ActionMenu({
  label,
  disabled,
  actions,
}: {
  label: string;
  disabled: boolean;
  actions: { label: string; onSelect: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useOutside(open, setOpen, button, menu);
  useEffect(() => {
    if (open)
      menu.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
  }, [open]);
  const close = (focus = true) => {
    setOpen(false);
    if (focus) button.current?.focus();
  };
  const keys = (e: React.KeyboardEvent) => {
    const items = [
      ...(menu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? []),
    ];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") close(false);
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      items[
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? items.length - 1
            : (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length
      ]?.focus();
    }
  };
  return (
    <div className="ledger-menu">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        Azioni <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div ref={menu} id={id} role="menu" aria-label={label} onKeyDown={keys}>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                close();
                a.onSelect();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  useOutside(open, setOpen, button, box);
  return (
    <span
      className="ledger-info"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        i
      </button>
      <span ref={box} id={id} role="note" hidden={!open}>
        {children}
      </span>
    </span>
  );
}

type Actions<T> = {
  busy: boolean;
  onEdit: (item: T) => void;
  onCancel: (item: T) => void;
  onDocuments: (item: T) => void;
};

function RowActions<T extends Movement>({
  item,
  busy,
  onEdit,
  onCancel,
  onDocuments,
}: Actions<T> & { item: T }) {
  return (
    <div className="ledger-actions">
      <button
        type="button"
        aria-label={`Documenti: ${item.description}`}
        onClick={() => onDocuments(item)}
      >
        Documenti
      </button>
      {!item.cancelled && (
        <ActionMenu
          label={`Azioni: ${item.description}, ${dateLabel(item.date)}`}
          disabled={busy}
          actions={[
            { label: "Correggi", onSelect: () => onEdit(item) },
            { label: "Annulla movimento…", onSelect: () => onCancel(item) },
          ]}
        />
      )}
    </div>
  );
}

const CancelledNote = ({ item }: { item: Movement }) =>
  item.cancelled ? (
    <small className="ledger-cancel-reason">
      Escluso dai totali · Motivo: {item.cancellation_reason}
    </small>
  ) : null;

export function MovementLedger<T extends Movement>({
  items,
  filtered,
  loaded,
  write,
  years,
  projects,
  filters,
  onFilters,
  onExport,
  ...actions
}: Actions<T> & {
  items: T[];
  filtered: T[];
  loaded: boolean;
  write: boolean;
  years: string[];
  projects: string[];
  filters: MovementFilters;
  onFilters: (filters: MovementFilters) => void;
  onExport: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const panelId = useId();
  const moreButton = useRef<HTMLButtonElement>(null);
  const totals = balances(filtered);
  const extra = activeExtraFilters(filters);
  const filteredAny = hasActiveFilters(filters);
  const set = (patch: Partial<MovementFilters>) =>
    onFilters({ ...filters, ...patch });
  const chipLabels = {
    project: `Iniziativa: ${filters.project}`,
    kind: `Tipo: ${kindLabels[filters.kind as keyof typeof kindLabels] ?? filters.kind}`,
    category: `Categoria: ${filters.category}`,
    showCancelled: "Annullati visibili",
  };
  const reset = () => {
    onFilters(defaultMovementFilters);
    moreButton.current?.focus();
  };
  const visible = filtered.slice(0, 500);
  return (
    <section className="soci-card ledger" aria-label="Registro movimenti">
      <div className="ledger-filters" role="search" aria-label="Filtri del registro">
        <div className="ledger-filters-main">
          <label>
            Anno
            <select value={filters.year} onChange={(e) => set({ year: e.target.value })}>
              <option value="">Tutti gli anni</option>
              {years.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Conto
            <select
              value={filters.account}
              onChange={(e) => set({ account: e.target.value })}
            >
              <option value="">Cassa e banca</option>
              {Object.entries(accountOptions).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="ledger-search">
            Cerca
            <input
              type="search"
              value={filters.search}
              onChange={(e) => set({ search: e.target.value })}
              placeholder="Causale, categoria o iniziativa"
            />
          </label>
        </div>
        <div className="ledger-filters-bar">
          <button
            ref={moreButton}
            type="button"
            className="ledger-more"
            aria-expanded={moreOpen}
            aria-controls={panelId}
            onClick={() => setMoreOpen(!moreOpen)}
          >
            Altri filtri
            {extra.length > 0 && (
              <>
                <span className="ledger-count" aria-hidden="true">
                  {extra.length}
                </span>
                <span className="ledger-sr">
                  {` (${extra.length} ${extra.length === 1 ? "attivo" : "attivi"})`}
                </span>
              </>
            )}
            <span className="ledger-chevron" aria-hidden="true">
              {moreOpen ? "▴" : "▾"}
            </span>
          </button>
          {!moreOpen && extra.length > 0 && (
            <ul className="ledger-chips" aria-label="Altri filtri attivi">
              {extra.map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    aria-label={`Rimuovi filtro ${chipLabels[k]}`}
                    onClick={() => {
                      set({ [k]: defaultMovementFilters[k] });
                      moreButton.current?.focus();
                    }}
                  >
                    {chipLabels[k]} <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {filteredAny && (
            <button type="button" className="ledger-reset" onClick={reset}>
              Azzera filtri
            </button>
          )}
        </div>
        <div
          id={panelId}
          className="ledger-filters-more"
          hidden={!moreOpen}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setMoreOpen(false);
              moreButton.current?.focus();
            }
          }}
        >
          <label>
            Iniziativa
            <select
              value={filters.project}
              onChange={(e) => set({ project: e.target.value })}
            >
              <option value="">Tutte le iniziative</option>
              {projects.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select value={filters.kind} onChange={(e) => set({ kind: e.target.value })}>
              <option value="">Tutti i tipi</option>
              {Object.entries(kindLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Categoria
            <select
              value={filters.category}
              onChange={(e) => set({ category: e.target.value })}
            >
              <option value="">Tutte le categorie</option>
              {[...new Set(items.map((x) => x.category))].sort().map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="soci-check">
            <input
              type="checkbox"
              checked={filters.showCancelled}
              onChange={(e) => set({ showCancelled: e.target.checked })}
            />
            Mostra annullati
          </label>
        </div>
      </div>

      <section className="ledger-totals" aria-labelledby={panelId + "-totals"}>
        <h3 id={panelId + "-totals"}>
          Totali dei movimenti filtrati
          <small>Gli annullati sono esclusi dai totali</small>
        </h3>
        <div>
          <article>
            <span>
              <i aria-hidden="true">↑</i> Entrate
            </span>
            <strong className="accounting-income">
              {loaded ? money(totals.income) : "—"}
            </strong>
          </article>
          <article>
            <span>
              <i aria-hidden="true">↓</i> Uscite
            </span>
            <strong className="accounting-expense">
              {loaded ? money(totals.expense) : "—"}
            </strong>
          </article>
          <article>
            <span>
              <i aria-hidden="true">=</i> Saldo dei movimenti
            </span>
            <strong>{loaded ? money(totals.income - totals.expense) : "—"}</strong>
          </article>
        </div>
      </section>

      <div className="ledger-results">
        <p className="ledger-results-count" role="status">
          <strong>{loaded ? movementsLabel(filtered.length) : "—"}</strong>
        </p>
        <button type="button" onClick={onExport}>
          Esporta CSV
        </button>
        <p className="ledger-note">
          I filtri si applicano al registro e al CSV. I saldi del cruscotto
          restano complessivi.
          <InfoTip label="Come sono trattati i trasferimenti">
            I trasferimenti compaiono in entrambi i conti: restano visibili con
            qualunque conto selezionato e non rientrano né nelle entrate né
            nelle uscite.
          </InfoTip>
        </p>
      </div>

      {!loaded ? (
        <p className="ledger-state" role="status">
          {actions.busy
            ? "Caricamento movimenti…"
            : "Movimenti non disponibili. Usa «Aggiorna» per riprovare."}
        </p>
      ) : !filtered.length ? (
        <div className="ledger-state">
          <p>
            {items.length
              ? "Nessun movimento corrisponde ai filtri selezionati."
              : "Nessun movimento registrato."}
          </p>
          {filteredAny && (
            <button type="button" onClick={reset}>
              Azzera filtri
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <caption className="ledger-sr">
                Registro: {movementsLabel(filtered.length)}. Gli annullati sono
                esclusi dai totali.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Causale</th>
                  <th scope="col">Categoria / iniziativa</th>
                  <th scope="col">Conto</th>
                  <th scope="col" className="ledger-num">
                    Importo
                  </th>
                  {write && <th scope="col">Operazioni</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id} className={item.cancelled ? "is-cancelled" : ""}>
                    <td>{dateLabel(item.date)}</td>
                    <td>
                      <strong className="ledger-desc">{item.description}</strong>
                      <small>
                        {kindLabels[item.kind]}
                        {item.cancelled && <span className="ledger-badge">Annullato</span>}
                      </small>
                      <CancelledNote item={item} />
                    </td>
                    <td>
                      <span className="ledger-category">{item.category}</span>
                      {item.project && (
                        <span className="ledger-project">
                          <span className="ledger-sr">Iniziativa: </span>
                          {item.project}
                        </span>
                      )}
                    </td>
                    <td>{accountLabel(item)}</td>
                    <td
                      className={
                        "ledger-num ledger-amount" +
                        (item.kind === "expense" ? " accounting-expense" : "")
                      }
                    >
                      {amountLabel(item)}
                    </td>
                    {write && (
                      <td>
                        <RowActions item={item} {...actions} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="ledger-cards" aria-label={`Registro: ${movementsLabel(filtered.length)}`}>
            {visible.map((item) => (
              <li key={item.id} className={item.cancelled ? "is-cancelled" : ""}>
                <div className="ledger-card-top">
                  <div>
                    <span className="ledger-card-date">{dateLabel(item.date)}</span>
                    <strong className="ledger-desc">{item.description}</strong>
                  </div>
                  <strong
                    className={
                      "ledger-amount" +
                      (item.kind === "expense" ? " accounting-expense" : "")
                    }
                  >
                    {amountLabel(item)}
                  </strong>
                </div>
                <small>
                  {kindLabels[item.kind]}
                  {item.cancelled && <span className="ledger-badge">Annullato</span>}
                </small>
                <CancelledNote item={item} />
                <dl>
                  <div>
                    <dt>Conto</dt>
                    <dd>{accountLabel(item)}</dd>
                  </div>
                  <div>
                    <dt>Categoria</dt>
                    <dd>{item.category}</dd>
                  </div>
                  {item.project && (
                    <div>
                      <dt>Iniziativa</dt>
                      <dd>
                        <span className="ledger-project">{item.project}</span>
                      </dd>
                    </div>
                  )}
                </dl>
                {write && <RowActions item={item} {...actions} />}
              </li>
            ))}
          </ul>
          {filtered.length > 500 && (
            <p className="ledger-state">
              Mostrati i primi 500: restringi i filtri o esporta l’elenco
              completo.
            </p>
          )}
        </>
      )}
    </section>
  );
}
