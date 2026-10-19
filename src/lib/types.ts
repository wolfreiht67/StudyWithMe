export type MethodId = "pomodoro" | "52-17" | "90-20" | "flowtime" | "custom";

export type AmbianceId =
  | "none"
  | "pluie"
  | "vagues"
  | "bruit-brun"
  | "piano"
  | "lofi"
  | "pixel"
  | "chill";

export type TabId = "session" | "planning" | "historique" | "recompenses" | "compte";

/** Un créneau du planning, à une date précise. */
export interface PlanBlock {
  id: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  duration: number; // minutes
  subject: string;
  methodId: MethodId;
  note?: string;
  done?: boolean;
}

/** Une période de concentration terminée (ou interrompue). */
export interface StudySession {
  id: string;
  startedAt: string; // ISO
  subject: string;
  methodId: MethodId;
  focusMinutes: number;
  completed: boolean;
  blockId?: string;
}

export interface Settings {
  workAmbiance: AmbianceId;
  breakAmbiance: AmbianceId;
  volume: number; // 0..1
  custom: { work: number; break: number };
  personalReward: { every: number; text: string };
  autoStartBreak: boolean;
}

export interface AppData {
  blocks: PlanBlock[];
  sessions: StudySession[];
  settings: Settings;
  updatedAt: string;
}

export const DEFAULT_SETTINGS: Settings = {
  workAmbiance: "pluie",
  breakAmbiance: "chill",
  volume: 0.5,
  custom: { work: 40, break: 10 },
  personalReward: { every: 4, text: "un épisode de ma série" },
  autoStartBreak: true,
};

export const EMPTY_DATA: AppData = {
  blocks: [],
  sessions: [],
  settings: DEFAULT_SETTINGS,
  updatedAt: new Date(0).toISOString(),
};
