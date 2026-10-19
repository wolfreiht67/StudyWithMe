"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useTimer } from "@/lib/timer";
import { METHODS, getMethod } from "@/lib/methods";
import { DAY_SHORT, addDays, formatMinutes, startOfWeek, toISODate, uid } from "@/lib/dates";
import type { MethodId, PlanBlock } from "@/lib/types";

const SUBJECT_COLORS = ["#8f7cff", "#5ed3c4", "#ffb86b", "#ff7a8a", "#7cc4ff", "#c3f07a", "#f59ee0"];

function colorFor(subject: string) {
  let h = 0;
  for (const c of subject.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SUBJECT_COLORS[h % SUBJECT_COLORS.length];
}

export default function PlannerView({ onStarted }: { onStarted: () => void }) {
  const { data, addBlocks, removeBlock, updateBlock } = useStore();
  const timer = useTimer();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [adding, setAdding] = useState<string | null>(null);
  const today = toISODate(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekBlocks = data.blocks.filter((b) => b.date >= toISODate(days[0]) && b.date <= toISODate(days[6]));
  const plannedMin = weekBlocks.reduce((a, b) => a + b.duration, 0);
  const doneMin = weekBlocks.filter((b) => b.done).reduce((a, b) => a + b.duration, 0);

  const range = `${days[0].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="flex items-center gap-2">
          <button className="btn-ghost px-3" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Semaine précédente">←</button>
          <button className="btn-ghost" onClick={() => setWeekStart(startOfWeek(new Date()))}>Cette semaine</button>
          <button className="btn-ghost px-3" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Semaine suivante">→</button>
        </div>
        <span className="font-semibold">{range}</span>
        <span className="ml-auto text-sm text-muted">
          {formatMinutes(doneMin)} faits sur {formatMinutes(plannedMin)} prévus
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-7">
        {days.map((d, i) => {
          const iso = toISODate(d);
          const blocks = data.blocks.filter((b) => b.date === iso).sort((a, b) => a.start.localeCompare(b.start));
          const isToday = iso === today;
          return (
            <div key={iso} className={`card flex min-h-[180px] flex-col p-3 ${isToday ? "ring-2 ring-accent/60" : ""}`}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className={`text-sm font-semibold ${isToday ? "text-accent" : ""}`}>{DAY_SHORT[i]}</span>
                <span className="text-xs text-muted">{d.getDate()}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {blocks.map((b) => (
                  <BlockCard
                    key={b.id}
                    block={b}
                    onStart={() => {
                      timer.start({ subject: b.subject, methodId: b.methodId, blockId: b.id });
                      onStarted();
                    }}
                    canStart={timer.status === "idle"}
                    onToggle={() => updateBlock(b.id, { done: !b.done })}
                    onDelete={() => removeBlock(b.id)}
                  />
                ))}
              </div>
              {adding === iso ? (
                <AddForm
                  date={iso}
                  onCancel={() => setAdding(null)}
                  onAdd={(b) => {
                    addBlocks([b]);
                    setAdding(null);
                  }}
                />
              ) : (
                <button className="mt-2 rounded-lg border border-dashed border-line py-1.5 text-xs text-muted hover:border-accent hover:text-ink" onClick={() => setAdding(iso)}>
                  + Ajouter
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BlockCard({ block, onStart, onToggle, onDelete, canStart }: { block: PlanBlock; onStart: () => void; onToggle: () => void; onDelete: () => void; canStart: boolean }) {
  const { data } = useStore();
  return (
    <div className={`group rounded-xl bg-card-2/70 p-2 text-sm ${block.done ? "opacity-50" : ""}`} style={{ borderLeft: `3px solid ${colorFor(block.subject)}` }}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted">{block.start}</span>
        <span className="text-[10px] text-muted">{getMethod(block.methodId, data.settings).short}</span>
      </div>
      <div className={`font-medium leading-tight ${block.done ? "line-through" : ""}`}>{block.subject}</div>
      {block.note && <div className="text-xs text-muted">{block.note}</div>}
      <div className="text-xs text-muted">{formatMinutes(block.duration)}</div>
      <div className="mt-1 flex gap-1">
        {!block.done && (
          <button disabled={!canStart} onClick={onStart} className="rounded-md bg-accent/20 px-2 py-0.5 text-xs text-accent hover:bg-accent/30 disabled:opacity-40" title="Lancer">▶</button>
        )}
        <button onClick={onToggle} className="rounded-md bg-card px-2 py-0.5 text-xs text-muted hover:text-ink" title={block.done ? "Marquer à faire" : "Marquer fait"}>✓</button>
        <button onClick={onDelete} className="ml-auto rounded-md px-2 py-0.5 text-xs text-muted hover:text-danger" title="Supprimer">✕</button>
      </div>
    </div>
  );
}

function AddForm({ date, onAdd, onCancel }: { date: string; onAdd: (b: PlanBlock) => void; onCancel: () => void }) {
  const [subject, setSubject] = useState("");
  const [start, setStart] = useState("18:00");
  const [duration, setDuration] = useState(50);
  const [methodId, setMethodId] = useState<MethodId>("pomodoro");
  return (
    <form
      className="mt-2 space-y-2 rounded-xl bg-night/50 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!subject.trim()) return;
        onAdd({ id: uid(), date, start, duration, subject: subject.trim(), methodId });
      }}
    >
      <input autoFocus className="input py-1.5" placeholder="Matière" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <div className="flex gap-1">
        <input type="time" className="input px-2 py-1.5" value={start} onChange={(e) => setStart(e.target.value)} />
        <input type="number" min={10} step={5} className="input px-2 py-1.5" value={duration} onChange={(e) => setDuration(Number(e.target.value))} aria-label="Durée en minutes" />
      </div>
      <select className="input py-1.5" value={methodId} onChange={(e) => setMethodId(e.target.value as MethodId)}>
        {METHODS.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      <div className="flex gap-1">
        <button type="submit" className="btn-primary flex-1 px-2 py-1">OK</button>
        <button type="button" className="btn-ghost px-2 py-1" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
