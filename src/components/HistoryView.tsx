"use client";

import { useStore } from "@/lib/store";
import { getMethod } from "@/lib/methods";
import { DAY_SHORT, addDays, dayIndex, formatMinutes, toISODate } from "@/lib/dates";
import { sessionXp, streakInfo } from "@/lib/rewards";

export default function HistoryView() {
  const { data, removeSession } = useStore();
  const sessions = [...data.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const total = sessions.reduce((a, s) => a + s.focusMinutes, 0);
  const today = new Date();

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 6);
    const iso = toISODate(d);
    const minutes = sessions.filter((s) => toISODate(new Date(s.startedAt)) === iso).reduce((a, s) => a + s.focusMinutes, 0);
    return { iso, label: DAY_SHORT[dayIndex(d)], minutes, isToday: i === 6 };
  });
  const weekTotal = last7.reduce((a, d) => a + d.minutes, 0);
  const max = Math.max(60, ...last7.map((d) => d.minutes));

  const bySubject = new Map<string, number>();
  sessions.forEach((s) => bySubject.set(s.subject, (bySubject.get(s.subject) ?? 0) + s.focusMinutes));
  const subjects = [...bySubject.entries()].sort((a, b) => b[1] - a[1]);
  const subjMax = subjects[0]?.[1] ?? 1;

  const { streak } = streakInfo(data.sessions);

  if (!sessions.length) {
    return (
      <div className="card p-10 text-center">
        <p className="text-4xl">📈</p>
        <p className="mt-3 font-semibold">Ton historique est vide pour l&apos;instant</p>
        <p className="mt-1 text-sm text-muted">Termine ta première session et tes statistiques apparaîtront ici.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Temps total" value={formatMinutes(total)} />
        <Stat label="7 derniers jours" value={formatMinutes(weekTotal)} />
        <Stat label="Sessions terminées" value={String(sessions.filter((s) => s.completed).length)} />
        <Stat label="Série en cours" value={`${streak} j 🔥`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Les 7 derniers jours</h2>
          <div className="flex h-48 items-end gap-3">
            {last7.map((d) => (
              <div key={d.iso} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[11px] text-muted">{d.minutes ? formatMinutes(d.minutes) : ""}</span>
                <div
                  className={`w-full rounded-t-md ${d.isToday ? "bg-accent" : "bg-accent/50"}`}
                  style={{ height: `${(d.minutes / max) * 100}%`, minHeight: d.minutes ? 4 : 0 }}
                  title={`${d.label} : ${formatMinutes(d.minutes)}`}
                />
                <span className={`text-xs ${d.isToday ? "text-ink" : "text-muted"}`}>{d.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Par matière</h2>
          <ul className="space-y-3">
            {subjects.slice(0, 8).map(([name, min]) => (
              <li key={name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{name}</span>
                  <span className="text-muted">{formatMinutes(min)}</span>
                </div>
                <div className="h-2 rounded-full bg-card-2">
                  <div className="h-2 rounded-full bg-accent-2" style={{ width: `${(min / subjMax) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Sessions récentes</h2>
        <ul className="divide-y divide-line">
          {sessions.slice(0, 30).map((s) => {
            const d = new Date(s.startedAt);
            return (
              <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-28 shrink-0 text-muted">
                  {d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · {d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{s.subject}</span>
                <span className="hidden text-muted sm:inline">{getMethod(s.methodId, data.settings).name}</span>
                <span className="w-16 text-right">{formatMinutes(s.focusMinutes)}</span>
                <span className="w-16 text-right text-warm">+{sessionXp(s)} XP</span>
                <span title={s.completed ? "Terminée" : "Interrompue"}>{s.completed ? "✅" : "⏸"}</span>
                <button className="text-muted hover:text-danger" onClick={() => removeSession(s.id)} title="Supprimer">✕</button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
