"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useTimer } from "@/lib/timer";
import { ACTIVE_BREAKS, METHODS, getMethod } from "@/lib/methods";
import { formatClock, formatMinutes, toISODate } from "@/lib/dates";
import AmbiancePlayer from "./AmbiancePlayer";

export default function SessionView() {
  const { data } = useStore();
  const timer = useTimer();
  const method = getMethod(timer.methodId, data.settings);
  const isIdle = timer.status === "idle";
  const isWork = timer.phase === "work";
  const isFlow = method.work === 0 && isWork;
  const [tip] = useState(() => Math.floor(Math.random() * ACTIVE_BREAKS.length));

  const today = toISODate(new Date());
  const todayBlocks = data.blocks
    .filter((b) => b.date === today)
    .sort((a, b) => a.start.localeCompare(b.start));

  const recentSubjects = useMemo(() => {
    const seen = new Set<string>();
    [...data.blocks.map((b) => b.subject), ...[...data.sessions].reverse().map((s) => s.subject)].forEach((s) => {
      if (s && s !== "Sans matière") seen.add(s);
    });
    return [...seen].slice(0, 6);
  }, [data.blocks, data.sessions]);

  const progress = isFlow || !Number.isFinite(timer.phaseTotalMs) ? null : Math.min(1, timer.elapsedMs / timer.phaseTotalMs);
  const display = isFlow ? formatClock(timer.elapsedMs / 1000) : formatClock((isIdle ? timer.phaseTotalMs : timer.remainingMs) / 1000);
  const phaseLabel = isIdle ? "Prêt ?" : isWork ? "Concentration" : timer.phase === "longBreak" ? "Grande pause" : "Pause";
  const ringColor = isWork ? "var(--color-accent)" : "var(--color-accent-2)";

  const R = 120;
  const C = 2 * Math.PI * R;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section className="card flex flex-col items-center p-6 sm:p-8">
        {/* Minuteur */}
        <div className="relative my-2 h-[280px] w-[280px]">
          <svg viewBox="0 0 280 280" className="h-full w-full -rotate-90">
            <circle cx="140" cy="140" r={R} fill="none" stroke="var(--color-card-2)" strokeWidth="14" />
            <circle
              cx="140"
              cy="140"
              r={R}
              fill="none"
              stroke={ringColor}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={progress === null ? (isIdle ? C : 0) : C * (1 - progress)}
              className="transition-[stroke-dashoffset] duration-300"
              style={isFlow && !isIdle ? { opacity: 0.35 + 0.25 * Math.sin(timer.elapsedMs / 800) } : undefined}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className={`text-sm font-medium uppercase tracking-widest ${isWork ? "text-accent" : "text-accent-2"}`}>{phaseLabel}</span>
            <span className="font-mono text-6xl font-semibold tabular-nums">{display}</span>
            <span className="mt-1 max-w-[200px] truncate text-sm text-muted">
              {timer.subject || "Choisis une matière"} · {method.name}
            </span>
            {!isIdle && timer.cycle > 0 && <span className="mt-1 text-xs text-muted">🍅 × {timer.cycle}</span>}
          </div>
        </div>

        {/* Contrôles */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {isIdle ? (
            <button
              className="btn-primary px-8 py-3 text-base"
              onClick={() => timer.start({ subject: timer.subject, methodId: timer.methodId })}
            >
              ▶ Commencer
            </button>
          ) : (
            <>
              {timer.status === "running" ? (
                <button className="btn-primary px-6 py-3" onClick={timer.pause}>⏸ Pause</button>
              ) : (
                <button className="btn-primary px-6 py-3" onClick={timer.resume}>▶ Reprendre</button>
              )}
              <button className="btn-ghost py-3" onClick={timer.finishPhase}>
                {isFlow ? "☕ Je fais une pause" : isWork ? "⏭ Terminer la période" : "⏭ Passer la pause"}
              </button>
              <button className="btn-ghost py-3 text-danger" onClick={timer.stop}>■ Arrêter</button>
            </>
          )}
        </div>

        {!isWork && !isIdle && (
          <div className="mt-6 w-full rounded-xl border border-accent-2/30 bg-accent-2/10 p-4 text-sm">
            <p className="font-medium text-accent-2">Pause active</p>
            <p className="mt-1 text-ink/90">{ACTIVE_BREAKS[(tip + timer.cycle) % ACTIVE_BREAKS.length]}</p>
          </div>
        )}

        {/* Réglages de la session */}
        {isIdle && (
          <div className="mt-8 w-full space-y-5">
            <div>
              <label className="label" htmlFor="subject">Matière ou tâche</label>
              <input
                id="subject"
                className="input"
                placeholder="Ex. Maths, chapitre 3"
                value={timer.subject}
                onChange={(e) => timer.setSubject(e.target.value)}
              />
              {recentSubjects.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {recentSubjects.map((s) => (
                    <button key={s} className="rounded-full bg-card-2 px-3 py-1 text-xs text-muted hover:text-ink" onClick={() => timer.setSubject(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <span className="label">Méthode</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {METHODS.map((m) => {
                  const mm = getMethod(m.id, data.settings);
                  const active = m.id === timer.methodId;
                  return (
                    <button
                      key={m.id}
                      onClick={() => timer.setMethod(m.id)}
                      className={`rounded-xl border p-3 text-left transition ${active ? "border-accent bg-accent/15" : "border-line bg-card-2/40 hover:border-accent/50"}`}
                    >
                      <div className="text-sm font-semibold">{m.name}</div>
                      <div className="text-xs text-muted">{mm.short}</div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-sm text-muted">{method.description}</p>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-6">
        <AmbiancePlayer />

        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Aujourd&apos;hui</h2>
          {todayBlocks.length === 0 ? (
            <p className="text-sm text-muted">Rien de prévu. Demande à l&apos;assistant de te préparer un planning en une phrase.</p>
          ) : (
            <ul className="space-y-2">
              {todayBlocks.map((b) => (
                <li key={b.id} className={`flex items-center gap-3 rounded-xl bg-card-2/50 p-3 ${b.done ? "opacity-50" : ""}`}>
                  <span className="font-mono text-sm text-muted">{b.start}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{b.done ? "✓ " : ""}{b.subject}</div>
                    <div className="text-xs text-muted">{formatMinutes(b.duration)} · {getMethod(b.methodId, data.settings).name}</div>
                  </div>
                  {!b.done && (
                    <button
                      className="btn-ghost px-3 py-1.5"
                      disabled={!isIdle}
                      onClick={() => timer.start({ subject: b.subject, methodId: b.methodId, blockId: b.id })}
                    >
                      ▶
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
