"use client";

import { AMBIANCES } from "@/lib/audio";
import { useStore } from "@/lib/store";
import { useTimer } from "@/lib/timer";
import type { AmbianceId } from "@/lib/types";

function Choice({ value, onPick, current }: { value: AmbianceId; onPick: (a: AmbianceId) => void; current: AmbianceId }) {
  const a = AMBIANCES.find((x) => x.id === value)!;
  const active = current === value;
  return (
    <button
      title={a.description}
      onClick={() => onPick(value)}
      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs transition ${active ? "border-accent bg-accent/15 text-ink" : "border-line bg-card-2/40 text-muted hover:text-ink"}`}
    >
      <span className="text-xl">{a.emoji}</span>
      {a.name}
    </button>
  );
}

export default function AmbiancePlayer() {
  const { data, updateSettings } = useStore();
  const timer = useTimer();
  const { workAmbiance, breakAmbiance, volume } = data.settings;
  const idle = timer.status === "idle";
  const audible = timer.musicOn && (!idle || timer.preview);
  const nowPlaying = timer.phase === "work" ? workAmbiance : breakAmbiance;

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Ambiance</h2>
        {idle ? (
          <button className="btn-ghost px-3 py-1.5" onClick={() => timer.setPreview(!timer.preview)}>
            {timer.preview ? "⏹ Arrêter l'écoute" : "🎧 Écouter"}
          </button>
        ) : (
          <button className="btn-ghost px-3 py-1.5" onClick={() => timer.setMusicOn(!timer.musicOn)}>
            {timer.musicOn ? "🔊 Son activé" : "🔇 Son coupé"}
          </button>
        )}
      </div>

      <span className="label">Pendant le travail</span>
      <div className="grid grid-cols-4 gap-2">
        {AMBIANCES.filter((a) => a.id !== "chill").map((a) => (
          <Choice key={a.id} value={a.id} current={workAmbiance} onPick={(id) => updateSettings({ workAmbiance: id })} />
        ))}
      </div>

      <span className="label mt-4">Pendant la pause</span>
      <div className="grid grid-cols-4 gap-2">
        {(["chill", "piano", "vagues", "none"] as AmbianceId[]).map((id) => (
          <Choice key={id} value={id} current={breakAmbiance} onPick={(v) => updateSettings({ breakAmbiance: v })} />
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-sm text-muted">Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
          className="flex-1 accent-[var(--color-accent)]"
          aria-label="Volume"
        />
      </div>
      <p className="mt-3 text-xs text-muted">
        {audible && nowPlaying !== "none"
          ? `En cours : ${AMBIANCES.find((a) => a.id === nowPlaying)?.name}. La musique passe automatiquement en mode pause.`
          : "Sons générés en direct par ton navigateur, sans pub ni droits d'auteur."}
      </p>
    </section>
  );
}
