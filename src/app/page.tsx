"use client";

import { useState, useSyncExternalStore } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { TimerProvider, useTimer } from "@/lib/timer";
import { levelInfo, streakInfo, totalXp } from "@/lib/rewards";
import type { TabId } from "@/lib/types";
import SessionView from "@/components/SessionView";
import PlannerView from "@/components/PlannerView";
import HistoryView from "@/components/HistoryView";
import RewardsView from "@/components/RewardsView";
import AccountView from "@/components/AccountView";
import ChatBot from "@/components/ChatBot";

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: "session", label: "Session", emoji: "⏱️" },
  { id: "planning", label: "Planning", emoji: "📅" },
  { id: "historique", label: "Historique", emoji: "📈" },
  { id: "recompenses", label: "Récompenses", emoji: "🏆" },
  { id: "compte", label: "Compte", emoji: "👤" },
];

const noop = () => () => {};

export default function Home() {
  // L'application vit dans le navigateur (minuteur, sons, données locales) :
  // on l'affiche une fois côté client pour éviter tout écart avec le rendu serveur.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        <span className="animate-pulse text-lg">📚 StudyWithMe</span>
      </div>
    );
  }
  return (
    <StoreProvider>
      <TimerProvider>
        <App />
      </TimerProvider>
    </StoreProvider>
  );
}

function App() {
  const [tab, setTab] = useState<TabId>("session");
  const { data, user } = useStore();
  const timer = useTimer();
  const xp = totalXp(data.sessions);
  const { level } = levelInfo(xp);
  const { streak } = streakInfo(data.sessions);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-28 sm:px-6">
      <header className="flex flex-wrap items-center gap-4 py-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📚</span>
          <span className="text-xl font-bold tracking-tight">
            Study<span className="text-accent">With</span>Me
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {timer.status !== "idle" && tab !== "session" && (
            <button onClick={() => setTab("session")} className="rounded-full bg-accent/20 px-3 py-1 text-accent">
              {timer.phase === "work" ? "⏱ Session en cours" : "☕ Pause en cours"}
            </button>
          )}
          <span className="rounded-full bg-card-2 px-3 py-1" title="Série de jours">🔥 {streak}</span>
          <span className="rounded-full bg-card-2 px-3 py-1" title={`${xp} XP`}>⭐ Niv. {level}</span>
          <button onClick={() => setTab("compte")} className="rounded-full bg-card-2 px-3 py-1" title="Compte">
            {user ? "👤 " + (user.email?.split("@")[0] ?? "Moi") : "👤 Invité"}
          </button>
        </div>
      </header>

      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-card/60 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition ${tab === t.id ? "bg-accent text-night" : "text-muted hover:text-ink"}`}
          >
            <span>{t.emoji}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      <main className="flex-1">
        {tab === "session" && <SessionView />}
        {tab === "planning" && <PlannerView onStarted={() => setTab("session")} />}
        {tab === "historique" && <HistoryView />}
        {tab === "recompenses" && <RewardsView />}
        {tab === "compte" && <AccountView />}
      </main>

      <Celebration />
      <ChatBot onNavigate={setTab} />
    </div>
  );
}

function Celebration() {
  const { celebration, dismissCelebration } = useTimer();
  if (!celebration) return null;
  return (
    <div className="card animate-pop fixed bottom-5 left-1/2 z-50 flex w-[min(440px,calc(100vw-7rem))] -translate-x-1/2 items-center gap-3 border-warm/40 bg-card p-4 shadow-2xl sm:left-5 sm:translate-x-0">
      <span className="text-3xl">{celebration.emoji}</span>
      <div className="flex-1">
        <div className="font-semibold">{celebration.title}</div>
        <div className="text-sm text-muted">{celebration.text}</div>
      </div>
      <button className="text-muted hover:text-ink" onClick={dismissCelebration} aria-label="Fermer">✕</button>
    </div>
  );
}
