import { accountingReport } from "../../lib/accountingReports";
import { kindLabels, type Movement } from "../../lib/accounting";
const money = (n: number) =>
  (n / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const months = [
  "Gen",
  "Feb",
  "Mar",
  "Apr",
  "Mag",
  "Giu",
  "Lug",
  "Ago",
  "Set",
  "Ott",
  "Nov",
  "Dic",
];
export function AccountingDashboard({
  items,
  loaded,
  year,
  onYear,
  onNew,
  busy,
}: {
  items: Movement[];
  loaded: boolean;
  year: string;
  onYear: (year: string) => void;
  onNew?: (kind: "income" | "expense") => void;
  busy: boolean;
}) {
  const report = accountingReport(items, year);
  const years = [
    ...new Set([
      year,
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Rome",
        year: "numeric",
      }).format(new Date()),
      ...items.map((x) => x.date.slice(0, 4)),
    ]),
  ]
    .sort()
    .reverse();
  const max = Math.max(
    1,
    ...report.monthly.flatMap((x) => [x.income, x.expense]),
  );
  return (
    <section
      className="accounting-dashboard"
      aria-label="Cruscotto contabilità"
    >
      <div className="accounting-heading">
        <div>
          <p className="soci-kicker">RISORSE DELL’ASSOCIAZIONE</p>
          <h2>Ogni risorsa, un passo insieme.</h2>
          <p>
            Cassa e banca sempre in vista. Entrate e spese dell’anno a
            confronto.
          </p>
        </div>
        <label>
          Anno del riepilogo
          <select value={year} onChange={(e) => onYear(e.target.value)}>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
      </div>
      {onNew && (
        <div className="accounting-quick-actions">
          <button
            className="primary"
            disabled={busy}
            onClick={() => onNew("income")}
          >
            + Registra entrata
          </button>
          <button disabled={busy} onClick={() => onNew("expense")}>
            − Registra uscita
          </button>
        </div>
      )}
      <div className="accounting-balances">
        <article className="accounting-total">
          <span>Disponibilità complessiva</span>
          <strong>
            {loaded ? money(report.totals.cash + report.totals.bank) : "—"}
          </strong>
          <small>Su tutti i movimenti attivi, di ogni anno</small>
        </article>
        <article>
          <span>Cassa contanti</span>
          <strong>{loaded ? money(report.totals.cash) : "—"}</strong>
          <small>Denaro disponibile in contanti</small>
        </article>
        <article>
          <span>Conto bancario</span>
          <strong>{loaded ? money(report.totals.bank) : "—"}</strong>
          <small>Saldo delle registrazioni bancarie</small>
        </article>
      </div>
      {loaded && (report.totals.cash < 0 || report.totals.bank < 0) && (
        <p className="soci-message">
          Un conto ha saldo negativo: verifica i saldi iniziali e i movimenti
          registrati.
        </p>
      )}
      <div className="accounting-period" aria-label={`Riepilogo ${year}`}>
        <div>
          <span>Entrate {year}</span>
          <strong className="accounting-income">
            {loaded ? money(report.period.income) : "—"}
          </strong>
        </div>
        <div>
          <span>Uscite {year}</span>
          <strong className="accounting-expense">
            {loaded ? money(report.period.expense) : "—"}
          </strong>
        </div>
        <div>
          <span>Differenza dell’anno</span>
          <strong>
            {loaded ? money(report.period.income - report.period.expense) : "—"}
          </strong>
        </div>
        <p>
          Trasferimenti e saldi iniziali non sono ricavi o spese. Il saldo
          disponibile deriva dalle registrazioni e non da una sincronizzazione
          con la banca.
        </p>
      </div>
      <div className="accounting-panels">
        <section className="soci-card">
          <h3>Il ritmo dell’anno · {year}</h3>
          <p className="accounting-muted">
            Entrate e uscite mese per mese, in euro.
          </p>
          {!loaded ? (
            <p>Caricamento riepilogo…</p>
          ) : !report.period.income && !report.period.expense ? (
            <p className="accounting-empty">
              Nessuna entrata o uscita registrata per questo anno.
            </p>
          ) : (
            <>
              <div className="accounting-legend">
                <span>● Entrate</span>
                <span>● Uscite</span>
              </div>
              <div className="accounting-chart" aria-hidden="true">
                {report.monthly.map((m) => (
                  <div className="accounting-month" key={m.month}>
                    <div className="accounting-bars">
                      <i style={{ height: `${(m.income / max) * 100}%` }} />
                      <i style={{ height: `${(m.expense / max) * 100}%` }} />
                    </div>
                    <span>{months[m.month]}</span>
                  </div>
                ))}
              </div>
              <details>
                <summary>Leggi gli importi mensili</summary>
                <div className="soci-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Mese</th>
                        <th>Entrate</th>
                        <th>Uscite</th>
                        <th>Differenza</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.monthly.map((m) => (
                        <tr key={m.month}>
                          <td>{months[m.month]}</td>
                          <td>{money(m.income)}</td>
                          <td>{money(m.expense)}</td>
                          <td>{money(m.income - m.expense)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </section>
        <section className="soci-card">
          <h3>Dove vanno le risorse</h3>
          <p className="accounting-muted">Spese per categoria · {year}</p>
          {!loaded ? (
            <p>Caricamento categorie…</p>
          ) : !report.expenses.length ? (
            <p className="accounting-empty">
              Le categorie compariranno dopo la prima uscita.
            </p>
          ) : (
            <ul className="accounting-categories">
              {report.expenses.map((c) => (
                <li key={c.name}>
                  <div>
                    <span>{c.name}</span>
                    <strong>{money(c.amount)}</strong>
                  </div>
                  <progress
                    max={report.period.expense}
                    value={c.amount}
                    aria-label={`${c.name}: ${money(c.amount)}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {loaded && report.recent.length > 0 && (
        <section className="soci-card accounting-recent">
          <h3>Ultime registrazioni per data</h3>
          <ul>
            {report.recent.map((m) => (
              <li key={m.id}>
                <span>
                  <strong>{m.description}</strong>
                  <small>
                    {m.date.split("-").reverse().join("/")} ·{" "}
                    {kindLabels[m.kind]} ·{" "}
                    {m.account === "cash" ? "Cassa" : "Banca"}
                    {m.kind === "transfer"
                      ? ` → ${m.account === "cash" ? "Banca" : "Cassa"}`
                      : ""}
                  </small>
                </span>
                <strong
                  className={m.kind === "expense" ? "accounting-expense" : ""}
                >
                  {m.kind === "expense"
                    ? "− "
                    : m.kind === "income"
                      ? "+ "
                      : ""}
                  {money(m.amount_cents)}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      )}
      {loaded && items.length === 0 && (
        <p className="accounting-empty">
          La contabilità è pronta. Inizia dai saldi iniziali di cassa e banca,
          poi registra entrate, uscite e trasferimenti.
        </p>
      )}
    </section>
  );
}
