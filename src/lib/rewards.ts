import type { StudySession } from "./types";
import { addDays, toISODate } from "./dates";

/** 1 XP par minute de concentration + 10 XP par période terminée sans abandon. */
export function sessionXp(s: StudySession): number {
  return Math.round(s.focusMinutes) + (s.completed ? 10 : 0);
}

export function totalXp(sessions: StudySession[]): number {
  return sessions.reduce((sum, s) => sum + sessionXp(s), 0);
}

/** Niveau n atteint à 50 * n * (n - 1) XP : 0, 100, 300, 600, 1000… */
export function levelInfo(xp: number) {
  let level = 1;
  while (50 * (level + 1) * level <= xp) level++;
  const current = 50 * level * (level - 1);
  const next = 50 * (level + 1) * level;
  return { level, current, next, progress: (xp - current) / (next - current) };
}

export const LEVEL_TITLES = [
  "Débutant",
  "Apprenti",
  "Studieux",
  "Concentré",
  "Assidu",
  "Expert",
  "Maître",
  "Sage",
  "Légende",
];

export function levelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
}

function studyDays(sessions: StudySession[]): Set<string> {
  return new Set(sessions.filter((s) => s.focusMinutes >= 5).map((s) => toISODate(new Date(s.startedAt))));
}

/**
 * Série de jours consécutifs avec au moins une session.
 * Un jour manqué par semaine glissante est pardonné (le « joker »).
 */
export function streakInfo(sessions: StudySession[], today = new Date()) {
  const days = studyDays(sessions);
  let streak = 0;
  let jokerUsedAt: string | null = null;
  let cursor = today;
  // Aujourd'hui ne casse pas la série si on n'a pas encore étudié.
  if (!days.has(toISODate(cursor))) cursor = addDays(cursor, -1);
  for (let i = 0; i < 400; i++) {
    const key = toISODate(cursor);
    if (days.has(key)) {
      streak++;
    } else {
      const canJoker = streak > 0 && (jokerUsedAt === null || daysBetween(key, jokerUsedAt) >= 7);
      if (!canJoker || !days.has(toISODate(addDays(cursor, -1)))) break;
      jokerUsedAt = key;
    }
    cursor = addDays(cursor, -1);
  }
  return { streak, studiedToday: days.has(toISODate(today)), jokerUsed: jokerUsedAt !== null };
}

function daysBetween(a: string, b: string) {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  earned: boolean;
}

export function computeBadges(sessions: StudySession[]): Badge[] {
  const done = sessions.filter((s) => s.completed);
  const minutes = sessions.reduce((a, s) => a + s.focusMinutes, 0);
  const { streak } = streakInfo(sessions);
  const hours = sessions.map((s) => new Date(s.startedAt).getHours());
  const perDay = new Map<string, number>();
  for (const s of done) {
    const k = toISODate(new Date(s.startedAt));
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const maxPerDay = Math.max(0, ...perDay.values());
  const subjects = new Set(sessions.map((s) => s.subject.toLowerCase()));

  return [
    { id: "first", emoji: "🚀", name: "Premier pas", description: "Terminer ta première session", earned: done.length >= 1 },
    { id: "ten", emoji: "🔟", name: "Régulier", description: "Terminer 10 sessions", earned: done.length >= 10 },
    { id: "fifty", emoji: "🏅", name: "Marathonien", description: "Terminer 50 sessions", earned: done.length >= 50 },
    { id: "5h", emoji: "⏳", name: "5 heures", description: "Cumuler 5 h de concentration", earned: minutes >= 300 },
    { id: "20h", emoji: "🧠", name: "20 heures", description: "Cumuler 20 h de concentration", earned: minutes >= 1200 },
    { id: "streak3", emoji: "🔥", name: "Lancé", description: "Série de 3 jours", earned: streak >= 3 },
    { id: "streak7", emoji: "🌋", name: "Inarrêtable", description: "Série de 7 jours", earned: streak >= 7 },
    { id: "four", emoji: "🍅", name: "Journée tomate", description: "4 sessions terminées dans la même journée", earned: maxPerDay >= 4 },
    { id: "early", emoji: "🌅", name: "Lève-tôt", description: "Une session commencée avant 8 h", earned: hours.some((h) => h < 8) },
    { id: "night", emoji: "🦉", name: "Oiseau de nuit", description: "Une session commencée après 22 h", earned: hours.some((h) => h >= 22) },
    { id: "multi", emoji: "📚", name: "Touche-à-tout", description: "Travailler 4 matières différentes", earned: subjects.size >= 4 },
  ];
}

/** La plante grandit avec les sessions terminées. */
export const PLANT_STAGES = [
  { min: 0, emoji: "🌰", name: "Graine" },
  { min: 1, emoji: "🌱", name: "Pousse" },
  { min: 5, emoji: "🌿", name: "Jeune plante" },
  { min: 12, emoji: "🪴", name: "Plante en pot" },
  { min: 25, emoji: "🌳", name: "Arbre" },
  { min: 50, emoji: "🌸", name: "Arbre en fleurs" },
  { min: 100, emoji: "🏝️", name: "Île paradisiaque" },
];

export function plantStage(completedCount: number) {
  let idx = 0;
  PLANT_STAGES.forEach((p, i) => {
    if (completedCount >= p.min) idx = i;
  });
  const next = PLANT_STAGES[idx + 1];
  return { ...PLANT_STAGES[idx], index: idx, next };
}
