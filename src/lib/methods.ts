import type { MethodId, Settings } from "./types";

export interface WorkMethod {
  id: MethodId;
  name: string;
  short: string;
  description: string;
  work: number; // minutes, 0 = chrono libre (Flowtime)
  break: number;
  longBreak?: number;
  longEvery?: number;
}

export const METHODS: WorkMethod[] = [
  {
    id: "pomodoro",
    name: "Pomodoro",
    short: "25 / 5",
    description:
      "25 minutes de travail, 5 minutes de pause. Toutes les 4 sessions, une pause longue de 15 minutes. Idéal pour démarrer.",
    work: 25,
    break: 5,
    longBreak: 15,
    longEvery: 4,
  },
  {
    id: "52-17",
    name: "52 / 17",
    short: "52 / 17",
    description:
      "52 minutes de concentration, 17 minutes de vraie pause. Pour ceux qui trouvent 25 minutes trop court.",
    work: 52,
    break: 17,
  },
  {
    id: "90-20",
    name: "Deep work 90",
    short: "90 / 20",
    description:
      "Un cycle complet de 90 minutes puis 20 minutes de pause. Parfait pour les grosses révisions.",
    work: 90,
    break: 20,
  },
  {
    id: "flowtime",
    name: "Flowtime",
    short: "libre",
    description:
      "Pas de minuteur imposé : tu travailles tant que tu es concentré, puis tu prends une pause égale à 1/5 du temps travaillé.",
    work: 0,
    break: 0,
  },
  {
    id: "custom",
    name: "Personnalisé",
    short: "à toi",
    description: "Choisis tes propres durées de travail et de pause.",
    work: 40,
    break: 10,
  },
];

export function getMethod(id: MethodId, settings?: Settings): WorkMethod {
  const m = METHODS.find((x) => x.id === id) ?? METHODS[0];
  if (m.id === "custom" && settings) {
    return { ...m, work: settings.custom.work, break: settings.custom.break, short: `${settings.custom.work} / ${settings.custom.break}` };
  }
  return m;
}

export const ACTIVE_BREAKS = [
  "Lève-toi et étire tes bras vers le plafond pendant 20 secondes.",
  "Bois un grand verre d'eau.",
  "Regarde un point au loin pendant 20 secondes pour reposer tes yeux.",
  "Respire : 4 secondes d'inspiration, 4 de blocage, 6 d'expiration. Trois fois.",
  "Fais le tour de la pièce ou ouvre la fenêtre.",
  "Range une chose sur ton bureau.",
  "Fais 10 rotations des épaules dans chaque sens.",
  "Ferme les yeux et ne pense à rien pendant une minute.",
];
