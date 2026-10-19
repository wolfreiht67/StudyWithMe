/**
 * Assistant de secours, sans IA : comprend les demandes les plus courantes
 * quand aucune clé d'API n'est configurée. Volontairement simple.
 */
import type { ChatActionT, ChatContext, ChatReplyT } from "./chat";
import type { AmbianceId, MethodId } from "./types";
import { addDays, fromISODate, toISODate, DAY_NAMES } from "./dates";

const SUBJECTS: [RegExp, string][] = [
  [/\bmaths?\b|math[ée]matiques?/i, "Maths"],
  [/fran[çc]ais/i, "Français"],
  [/anglais|english/i, "Anglais"],
  [/espagnol/i, "Espagnol"],
  [/allemand/i, "Allemand"],
  [/histoire|g[ée]o/i, "Histoire-Géo"],
  [/physique|chimie/i, "Physique-Chimie"],
  [/\bsvt\b|biolog/i, "SVT"],
  [/philo/i, "Philo"],
  [/[ée]co(nomie)?\b|\bses\b/i, "SES"],
  [/info(rmatique)?\b|\bnsi\b|code|programm/i, "Informatique"],
  [/droit/i, "Droit"],
  [/m[ée]decine|anatomie/i, "Médecine"],
];

const METHODS: [RegExp, MethodId][] = [
  [/pomodoro|25\s*\/\s*5/i, "pomodoro"],
  [/52\s*\/?\s*17/i, "52-17"],
  [/\b90\b|deep\s*work/i, "90-20"],
  [/flow\s*time|flowtime|sans minuteur/i, "flowtime"],
];

const AMBIANCES: [RegExp, AmbianceId][] = [
  [/pluie|rain/i, "pluie"],
  [/vague|oc[ée]an|mer\b/i, "vagues"],
  [/bruit (brun|blanc)|brown/i, "bruit-brun"],
  [/piano/i, "piano"],
  [/lo-?fi/i, "lofi"],
  [/minecraft|pixel|jeu vid[ée]o|8.?bit/i, "pixel"],
  [/chill|calme/i, "chill"],
  [/silence|sans (musique|son)/i, "none"],
];

const find = <T,>(table: [RegExp, T][], text: string) => table.find(([re]) => re.test(text))?.[1];
const findAll = (text: string) => SUBJECTS.filter(([re]) => re.test(text)).map(([, s]) => s);

function parseDeadline(text: string, today: Date): Date | null {
  const lower = text.toLowerCase();
  const m = lower.match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/);
  if (m) {
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : today.getFullYear();
    const d = new Date(year, Number(m[2]) - 1, Number(m[1]));
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  const rel = lower.match(/dans\s+(\d+)\s*(jours?|semaines?)/);
  if (rel) return addDays(today, Number(rel[1]) * (rel[2].startsWith("semaine") ? 7 : 1));
  if (/demain/.test(lower)) return addDays(today, 1);
  if (/semaine prochaine/.test(lower)) return addDays(today, 7);
  for (let i = 0; i < 7; i++) {
    if (lower.includes(DAY_NAMES[i].toLowerCase())) {
      const todayIdx = (today.getDay() + 6) % 7;
      let diff = (i - todayIdx + 7) % 7;
      if (diff === 0) diff = 7;
      return addDays(today, diff);
    }
  }
  return null;
}

function parseDailyMinutes(text: string): number | null {
  const h = text.match(/(\d+(?:[.,]\d+)?)\s*h(?:eures?)?\b(?!\d)/i);
  if (h) return Math.round(parseFloat(h[1].replace(",", ".")) * 60);
  const hm = text.match(/(\d+)\s*h\s*(\d{2})/i);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const min = text.match(/(\d+)\s*min/i);
  if (min) return Number(min[1]);
  return null;
}

function parseStartHour(text: string): string | null {
  const m = text.match(/(?:à|a partir de|dès|vers)\s*(\d{1,2})\s*h\s*(\d{2})?/i);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2] ?? "00"}`;
}

const addMinutes = (hhmm: string, min: number) => {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

export function localAssistant(message: string, ctx: ChatContext): ChatReplyT {
  const text = message.trim();
  const today = fromISODate(ctx.today);
  const subjects = findAll(text);
  const method = find(METHODS, text);
  const ambiance = find(AMBIANCES, text);
  const actions: ChatActionT[] = [];
  const empty = { blocks: null, subject: null, methodId: null, ambiance: null, tab: null };

  // Navigation simple
  if (/historique|statistique|stats\b/i.test(text) && !/planning/i.test(text)) {
    return { reply: "Voici ton historique.", actions: [{ ...empty, type: "navigate", tab: "historique" }] };
  }
  if (/r[ée]compense|badge|niveau|xp\b|plante/i.test(text)) {
    return { reply: "Voici tes récompenses.", actions: [{ ...empty, type: "navigate", tab: "recompenses" }] };
  }
  if (/compte|connexion|connecter|inscri/i.test(text)) {
    return { reply: "Tout se passe dans l'onglet Compte.", actions: [{ ...empty, type: "navigate", tab: "compte" }] };
  }

  // Lancer une session
  if (/lance|commence|d[ée]marre|go\b|on y va|session/i.test(text) && !/planning|planifie|organise|examen|partiel|contr[ôo]le|bac\b/i.test(text)) {
    const subject = subjects[0] ?? ctx.recentSubjects[0] ?? "Révisions";
    actions.push({ ...empty, type: "start_session", subject, methodId: method ?? "pomodoro", ambiance: ambiance ?? null });
    return { reply: `C'est parti pour ${subject} ! Concentre-toi, je m'occupe du minuteur.`, actions };
  }

  // Changer l'ambiance
  if (ambiance && !/planning|examen|partiel/i.test(text)) {
    return { reply: "Ambiance changée.", actions: [{ ...empty, type: "set_ambiance", ambiance }] };
  }

  // Construire un planning
  if (/planning|planifie|organise|r[ée]vis|examen|partiel|contr[ôo]le|bac\b|brevet|semaine/i.test(text) || subjects.length) {
    const deadline = parseDeadline(text, today);
    const daily = parseDailyMinutes(text) ?? 120;
    const startAt = parseStartHour(text) ?? "18:00";
    const list = subjects.length ? subjects : ctx.recentSubjects.slice(0, 3).length ? ctx.recentSubjects.slice(0, 3) : ["Révisions"];
    const m = method ?? (daily >= 180 ? "52-17" : "pomodoro");
    const lastDay = deadline ? addDays(deadline, -1) : addDays(today, 6);
    const days = Math.max(1, Math.min(21, Math.round((lastDay.getTime() - today.getTime()) / 86400000) + 1));
    const blocks = [];
    let k = 0;
    // Créneaux d'environ 50 min pour couper la journée en morceaux digestes
    const slot = Math.min(daily, m === "90-20" ? 90 : 50);
    const perDay = Math.max(1, Math.round(daily / slot));
    for (let d = 0; d < days; d++) {
      const date = toISODate(addDays(today, d));
      let start = d === 0 && ctx.now > startAt ? addMinutes(ctx.now, 15) : startAt;
      if (d === 0 && start < ctx.now) continue;
      for (let i = 0; i < perDay; i++) {
        blocks.push({ date, start, duration: slot, subject: list[k++ % list.length], methodId: m, note: null });
        start = addMinutes(start, slot + 10);
      }
    }
    actions.push({ ...empty, type: "add_blocks", blocks });
    actions.push({ ...empty, type: "navigate", tab: "planning" });
    const until = deadline ? ` jusqu'à ton échéance du ${deadline.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}` : " pour les 7 prochains jours";
    return {
      reply: `J'ai ajouté ${blocks.length} créneaux de ${slot} min${until}, en alternant ${list.join(", ")}. Tu peux les déplacer ou les supprimer dans le planning.`,
      actions,
    };
  }

  return {
    reply:
      "Je peux créer ton planning (« j'ai un partiel de maths et d'anglais vendredi, 2 h par jour »), lancer une session (« lance 52/17 en physique avec de la pluie ») ou t'emmener vers ton historique.",
    actions: [],
  };
}
