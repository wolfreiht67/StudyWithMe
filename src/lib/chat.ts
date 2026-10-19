import { z } from "zod";

export const METHOD_IDS = ["pomodoro", "52-17", "90-20", "flowtime", "custom"] as const;
export const AMBIANCE_IDS = ["none", "pluie", "vagues", "bruit-brun", "piano", "lofi", "pixel", "chill"] as const;
export const TAB_IDS = ["session", "planning", "historique", "recompenses", "compte"] as const;

export const BlockInput = z.object({
  date: z.string().describe("Date au format YYYY-MM-DD"),
  start: z.string().describe("Heure de début au format HH:MM"),
  duration: z.number().describe("Durée en minutes"),
  subject: z.string().describe("Matière ou tâche, courte"),
  methodId: z.enum(METHOD_IDS),
  note: z.string().nullable().describe("Précision facultative, ex. chapitre à revoir"),
});

export const ChatAction = z.object({
  type: z.enum(["add_blocks", "start_session", "navigate", "set_ambiance"]),
  blocks: z.array(BlockInput).nullable().describe("Pour add_blocks : les créneaux à ajouter au planning"),
  subject: z.string().nullable().describe("Pour start_session : la matière"),
  methodId: z.enum(METHOD_IDS).nullable().describe("Pour start_session : la méthode"),
  ambiance: z.enum(AMBIANCE_IDS).nullable().describe("Pour start_session ou set_ambiance : l'ambiance de travail"),
  tab: z.enum(TAB_IDS).nullable().describe("Pour navigate : l'onglet à ouvrir"),
});

export const ChatReply = z.object({
  reply: z.string().describe("Réponse courte et chaleureuse en français, 1 à 3 phrases"),
  actions: z.array(ChatAction),
});

export type ChatActionT = z.infer<typeof ChatAction>;
export type ChatReplyT = z.infer<typeof ChatReply>;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  today: string; // YYYY-MM-DD
  weekday: string;
  now: string; // HH:MM
  existingBlocks: { date: string; start: string; duration: number; subject: string }[];
  recentSubjects: string[];
}
