"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getEngine } from "./audio";
import { getMethod } from "./methods";
import { sessionXp } from "./rewards";
import { useStore } from "./store";
import type { MethodId, StudySession } from "./types";
import { formatClock, uid } from "./dates";

export type Phase = "work" | "break" | "longBreak";
export type Status = "idle" | "running" | "paused";

interface TimerState {
  status: Status;
  phase: Phase;
  methodId: MethodId;
  subject: string;
  blockId?: string;
  phaseTotalMs: number; // Infinity pour Flowtime en travail
  accumulatedMs: number;
  runningSince: number | null;
  workStartedAt: string | null;
  cycle: number; // nombre de périodes de travail terminées dans cette série
}

export interface Celebration {
  emoji: string;
  title: string;
  text: string;
}

interface Timer extends TimerState {
  elapsedMs: number;
  remainingMs: number;
  musicOn: boolean;
  preview: boolean;
  celebration: Celebration | null;
  start: (opts: { subject: string; methodId: MethodId; blockId?: string }) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  /** Termine la phase en cours maintenant (ex. « je fais une pause » en Flowtime). */
  finishPhase: () => void;
  setMusicOn: (on: boolean) => void;
  /** Écouter l'ambiance sans lancer de session. */
  setPreview: (on: boolean) => void;
  setSubject: (s: string) => void;
  setMethod: (m: MethodId) => void;
  dismissCelebration: () => void;
}

const TimerContext = createContext<Timer | null>(null);

const INITIAL: TimerState = {
  status: "idle",
  phase: "work",
  methodId: "pomodoro",
  subject: "",
  phaseTotalMs: 25 * 60_000,
  accumulatedMs: 0,
  runningSince: null,
  workStartedAt: null,
  cycle: 0,
};

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const { data, addSession, updateBlock } = useStore();
  const settings = data.settings;
  const [state, setState] = useState<TimerState>(INITIAL);
  const [now, setNow] = useState(() => Date.now());
  const [musicOn, setMusicOn] = useState(true);
  const [preview, setPreview] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const stateRef = useRef(state);
  const sessionsRef = useRef(data.sessions);
  useLayoutEffect(() => {
    stateRef.current = state;
    sessionsRef.current = data.sessions;
  });

  const elapsedMs = state.accumulatedMs + (state.runningSince ? now - state.runningSince : 0);
  const remainingMs = state.phaseTotalMs - elapsedMs;

  const workMs = useCallback(
    (methodId: MethodId) => {
      const m = getMethod(methodId, settings);
      return m.work === 0 ? Infinity : m.work * 60_000;
    },
    [settings],
  );

  const recordWork = useCallback(
    (s: TimerState, workedMs: number, completed: boolean) => {
      const minutes = workedMs / 60_000;
      if (minutes < 1) return null;
      const session: StudySession = {
        id: uid(),
        startedAt: s.workStartedAt ?? new Date(Date.now() - workedMs).toISOString(),
        subject: s.subject.trim() || "Sans matière",
        methodId: s.methodId,
        focusMinutes: Math.round(minutes * 10) / 10,
        completed,
        blockId: s.blockId,
      };
      addSession(session);
      if (completed && s.blockId) updateBlock(s.blockId, { done: true });
      return session;
    },
    [addSession, updateBlock],
  );

  const celebrate = useCallback(
    (session: StudySession) => {
      const doneCount = sessionsRef.current.filter((x) => x.completed).length + 1;
      const every = settings.personalReward.every;
      if (every > 0 && doneCount % every === 0 && settings.personalReward.text.trim()) {
        setCelebration({
          emoji: "🎁",
          title: "Récompense débloquée !",
          text: `${every} sessions terminées : tu as mérité ${settings.personalReward.text}. +${sessionXp(session)} XP`,
        });
      } else {
        setCelebration({ emoji: "✨", title: "Session terminée !", text: `Bravo, +${sessionXp(session)} XP. Profite de ta pause.` });
      }
    },
    [settings.personalReward],
  );

  /** Passe à la phase suivante. `completed` = la période de travail est allée au bout. */
  const advance = useCallback(
    (completed: boolean) => {
      const s = stateRef.current;
      const t = Date.now();
      const worked = s.accumulatedMs + (s.runningSince ? t - s.runningSince : 0);
      getEngine().chime();
      if (s.phase === "work") {
        const session = recordWork(s, worked, completed);
        if (session) celebrate(session);
        const method = getMethod(s.methodId, settings);
        const cycle = s.cycle + 1;
        const isLong = !!method.longEvery && cycle % method.longEvery === 0;
        const breakMin =
          method.work === 0 ? Math.max(3, Math.round(worked / 60_000 / 5)) : isLong ? method.longBreak! : method.break;
        setState({
          ...s,
          phase: isLong ? "longBreak" : "break",
          cycle,
          phaseTotalMs: breakMin * 60_000,
          accumulatedMs: 0,
          runningSince: settings.autoStartBreak ? t : null,
          status: settings.autoStartBreak ? "running" : "paused",
          workStartedAt: null,
        });
      } else {
        // Fin de pause : la période suivante attend que l'utilisateur soit prêt.
        setState({
          ...s,
          phase: "work",
          phaseTotalMs: workMs(s.methodId),
          accumulatedMs: 0,
          runningSince: null,
          status: "paused",
          workStartedAt: null,
        });
        setCelebration({ emoji: "⏰", title: "La pause est finie", text: "Prêt pour la suite ? Appuie sur Reprendre." });
      }
    },
    [celebrate, recordWork, settings, workMs],
  );

  // Horloge
  useEffect(() => {
    if (state.status !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [state.status]);

  // Fin de phase automatique
  useEffect(() => {
    if (state.status === "running" && remainingMs <= 0) advance(true);
  }, [state.status, remainingMs, advance]);

  // Ambiance sonore selon la phase
  useEffect(() => {
    const engine = getEngine();
    engine.setVolume(settings.volume);
    if (!musicOn || (state.status === "idle" && !preview)) {
      engine.stop();
      return;
    }
    engine.play(state.phase === "work" ? settings.workAmbiance : settings.breakAmbiance);
  }, [musicOn, preview, state.status, state.phase, settings.workAmbiance, settings.breakAmbiance, settings.volume]);

  // Titre de l'onglet
  useEffect(() => {
    if (state.status === "idle") {
      document.title = "StudyWithMe";
      return;
    }
    const label = state.phase === "work" ? "Focus" : "Pause";
    const clock = Number.isFinite(remainingMs) ? formatClock(remainingMs / 1000) : formatClock(elapsedMs / 1000);
    document.title = `${clock} · ${label} · StudyWithMe`;
  }, [state.status, state.phase, remainingMs, elapsedMs]);

  const timer: Timer = {
    ...state,
    elapsedMs,
    remainingMs,
    musicOn,
    preview,
    celebration,
    start: ({ subject, methodId, blockId }) => {
      const t = Date.now();
      setNow(t);
      setState({
        ...INITIAL,
        status: "running",
        subject,
        methodId,
        blockId,
        phaseTotalMs: workMs(methodId),
        runningSince: t,
        workStartedAt: new Date(t).toISOString(),
      });
    },
    pause: () =>
      setState((s) =>
        s.status === "running" && s.runningSince
          ? { ...s, status: "paused", accumulatedMs: s.accumulatedMs + Date.now() - s.runningSince, runningSince: null }
          : s,
      ),
    resume: () => {
      const t = Date.now();
      setNow(t);
      setState((s) =>
        s.status === "paused"
          ? { ...s, status: "running", runningSince: t, workStartedAt: s.workStartedAt ?? (s.phase === "work" ? new Date(t).toISOString() : null) }
          : s,
      );
    },
    stop: () => {
      const s = stateRef.current;
      if (s.phase === "work") {
        const worked = s.accumulatedMs + (s.runningSince ? Date.now() - s.runningSince : 0);
        // Une période arrêtée en cours compte quand même, mais sans le bonus de fin.
        const isFlow = getMethod(s.methodId, settings).work === 0;
        recordWork(s, worked, isFlow && worked >= 10 * 60_000);
      }
      setState((prev) => ({ ...INITIAL, subject: prev.subject, methodId: prev.methodId, phaseTotalMs: workMs(prev.methodId) }));
    },
    finishPhase: () => {
      const s = stateRef.current;
      if (s.status === "idle") return;
      const isFlow = getMethod(s.methodId, settings).work === 0;
      const worked = s.accumulatedMs + (s.runningSince ? Date.now() - s.runningSince : 0);
      advance(s.phase === "work" ? isFlow && worked >= 10 * 60_000 : true);
    },
    setMusicOn,
    setPreview,
    setSubject: (subject) => setState((s) => ({ ...s, subject })),
    setMethod: (methodId) =>
      setState((s) => (s.status === "idle" ? { ...s, methodId, phaseTotalMs: workMs(methodId) } : s)),
    dismissCelebration: () => setCelebration(null),
  };

  return <TimerContext.Provider value={timer}>{children}</TimerContext.Provider>;
}

export function useTimer(): Timer {
  const t = useContext(TimerContext);
  if (!t) throw new Error("useTimer doit être utilisé dans TimerProvider");
  return t;
}
