"use client";

import { useEffect, useState } from "react";

// Explicit Rome offset: the countdown stays correct for visitors in other timezones.
const meetingAt = Date.parse("2026-10-17T17:00:00+02:00");
const hideAt = Date.parse("2026-10-18T00:00:00+02:00");

export function EventAnnouncement() {
  // Identical server/client first render; never freeze the countdown at build time.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const initial = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, []);

  if (now !== null && now >= hideAt) return null;
  const seconds = now === null ? null : Math.max(0, Math.ceil((meetingAt - now) / 1000));
  const started = seconds === 0;
  const units = [
    { label: "giorni", value: seconds === null ? null : Math.floor(seconds / 86400) },
    { label: "ore", value: seconds === null ? null : Math.floor(seconds / 3600) % 24 },
    { label: "minuti", value: seconds === null ? null : Math.floor(seconds / 60) % 60 },
    { label: "secondi", value: seconds === null ? null : seconds % 60 },
  ];

  return (
    <aside className="event-announcement" aria-labelledby="meeting-title" data-reveal="fade-up">
      <div className="event-copy">
        <p className="event-kicker"><span aria-hidden="true">✦</span> Save the date</p>
        <h2 id="meeting-title">Il nostro primo incontro.</h2>
        <p className="event-date"><time dateTime="2026-10-17T17:00:00+02:00">Sabato 17 ottobre 2026 · ore 17:00</time></p>
        <p className="event-place">Sala comunale di Forio</p>
        <p className="event-invitation">Conosciamoci, ascoltiamoci, cominciamo. Insieme.</p>
      </div>
      <div className="event-countdown-wrap">
        {started ? <p className="event-started" role="status">È il momento di incontrarci.</p> : <>
          <p className="event-countdown-label">Manca sempre meno al nostro primo passo</p>
          <div className="event-countdown" role="group" aria-label="Conto alla rovescia al primo incontro" aria-live="off">
            {units.map(({ label, value }) => <div className="event-unit" key={label}>
              <span className="event-unit-value">{value === null ? "—" : String(value).padStart(2, "0")}</span>
              <span className="event-unit-label">{label}</span>
            </div>)}
          </div>
        </>}
      </div>
    </aside>
  );
}
