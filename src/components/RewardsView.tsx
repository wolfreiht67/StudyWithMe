"use client";

import { useStore } from "@/lib/store";
import { PLANT_STAGES, computeBadges, levelInfo, levelTitle, plantStage, streakInfo, totalXp } from "@/lib/rewards";

export default function RewardsView() {
  const { data, updateSettings } = useStore();
  const xp = totalXp(data.sessions);
  const lvl = levelInfo(xp);
  const { streak, studiedToday, jokerUsed } = streakInfo(data.sessions);
  const completed = data.sessions.filter((s) => s.completed).length;
  const plant = plantStage(completed);
  const badges = computeBadges(data.sessions);
  const reward = data.settings.personalReward;
  const towardReward = reward.every > 0 ? completed % reward.every : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <section className="card p-5">
          <div className="text-xs uppercase tracking-wide text-muted">Niveau</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-bold">{lvl.level}</span>
            <span className="text-accent">{levelTitle(lvl.level)}</span>
          </div>
          <div className="mt-3 h-3 rounded-full bg-card-2">
            <div className="h-3 rounded-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${lvl.progress * 100}%` }} />
          </div>
          <div className="mt-2 text-sm text-muted">
            {xp} XP · encore {lvl.next - xp} XP pour le niveau {lvl.level + 1}
          </div>
          <p className="mt-3 text-xs text-muted">1 XP par minute de concentration, +10 XP par période terminée.</p>
        </section>

        <section className="card p-5">
          <div className="text-xs uppercase tracking-wide text-muted">Série</div>
          <div className="mt-1 text-4xl font-bold">{streak} 🔥</div>
          <p className="mt-2 text-sm text-muted">
            {studiedToday ? "Tu as déjà étudié aujourd'hui, bien joué !" : streak > 0 ? "Fais au moins 5 minutes aujourd'hui pour garder ta série." : "Étudie aujourd'hui pour lancer ta série."}
          </p>
          <p className="mt-3 text-xs text-muted">
            🃏 Un joker par semaine : un jour manqué ne casse pas ta série{jokerUsed ? " (joker utilisé récemment)" : ""}.
          </p>
        </section>

        <section className="card flex flex-col items-center p-5 text-center">
          <div className="text-xs uppercase tracking-wide text-muted">Ta plante</div>
          <div className="my-2 text-7xl transition-transform hover:scale-110">{plant.emoji}</div>
          <div className="font-semibold">{plant.name}</div>
          <div className="mt-1 text-sm text-muted">
            {plant.next ? `Encore ${plant.next.min - completed} session(s) pour : ${plant.next.emoji} ${plant.next.name}` : "Stade maximum atteint !"}
          </div>
          <div className="mt-3 flex gap-1 text-lg">
            {PLANT_STAGES.map((p, i) => (
              <span key={p.name} className={i <= plant.index ? "" : "opacity-20 grayscale"} title={p.name}>{p.emoji}</span>
            ))}
          </div>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="font-semibold">Ma récompense perso 🎁</h2>
        <p className="mt-1 text-sm text-muted">Fixe-toi un petit plaisir : le site te prévient quand tu l&apos;as mérité.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span>Après</span>
          <input
            type="number"
            min={1}
            max={20}
            className="input w-20"
            value={reward.every}
            onChange={(e) => updateSettings({ personalReward: { ...reward, every: Math.max(1, Number(e.target.value)) } })}
          />
          <span>sessions terminées, je m&apos;accorde</span>
          <input
            className="input min-w-[220px] flex-1"
            value={reward.text}
            onChange={(e) => updateSettings({ personalReward: { ...reward, text: e.target.value } })}
          />
        </div>
        <div className="mt-4 flex gap-1.5">
          {Array.from({ length: reward.every }, (_, i) => (
            <span key={i} className={`h-3 flex-1 rounded-full ${i < towardReward ? "bg-warm" : "bg-card-2"}`} />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{towardReward} / {reward.every} avant ta récompense</p>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Badges ({badges.filter((b) => b.earned).length}/{badges.length})</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {badges.map((b) => (
            <div key={b.id} className={`rounded-xl border p-3 ${b.earned ? "border-warm/50 bg-warm/10" : "border-line bg-card-2/30 opacity-50"}`}>
              <div className={`text-2xl ${b.earned ? "" : "grayscale"}`}>{b.emoji}</div>
              <div className="mt-1 text-sm font-semibold">{b.name}</div>
              <div className="text-xs text-muted">{b.description}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
