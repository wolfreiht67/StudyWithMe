import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ChatReply, type ChatContext, type ChatMessage } from "@/lib/chat";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

const SYSTEM = `Tu es l'assistant intégré de StudyWithMe, une plateforme d'étude pour élèves et étudiants francophones.
Ton rôle : comprendre vite ce que veut l'utilisateur et agir pour lui dans l'application, puis répondre en 1 à 3 phrases, en français, avec un ton chaleureux et motivant.

Actions possibles (champ "actions") :
- add_blocks : ajouter des créneaux au planning. Pour un examen, répartis le travail sur les jours restants avant la date (pas le jour même de l'examen), alterne les matières, mets la matière la plus difficile en premier dans la journée, prévois des créneaux de 25 à 90 minutes avec 10 minutes d'écart entre deux créneaux. Ne place pas de créneau dans le passé ni en double avec un créneau existant. Si l'utilisateur ne donne pas d'horaire, commence à 18:00 en semaine et 10:00 le week-end. Si aucune durée n'est donnée, vise 1 h 30 à 2 h par jour.
- start_session : lancer tout de suite une session de travail (matière, méthode, ambiance éventuelle).
- set_ambiance : changer l'ambiance sonore de travail.
- navigate : ouvrir un onglet (session, planning, historique, recompenses, compte).

Méthodes : pomodoro (25/5, défaut), 52-17, 90-20 (deep work, grosses révisions), flowtime (sans minuteur), custom.
Ambiances : pluie, vagues, bruit-brun, piano, lofi, pixel (ambiance jeu vidéo rétro, à proposer si on demande Minecraft), chill, none.

Après add_blocks, ajoute une action navigate vers "planning". Si la demande est floue, fais une proposition raisonnable plutôt que de poser plusieurs questions. Si la demande n'a rien à voir avec les études ou l'application, réponds brièvement et ramène gentiment vers le travail. Mets à null les champs qui ne concernent pas une action.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Le client bascule alors sur l'assistant local sans IA.
    return Response.json({ error: "no_api_key" }, { status: 501 });
  }

  const body = (await request.json()) as { messages: ChatMessage[]; context: ChatContext };
  const messages = (body.messages ?? []).slice(-12).filter((m) => m.content.trim());
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const ctx = body.context;
  const contextNote = `Contexte : nous sommes ${ctx.weekday} ${ctx.today}, il est ${ctx.now}.
Matières récentes : ${ctx.recentSubjects.join(", ") || "aucune"}.
Créneaux déjà prévus (14 prochains jours) : ${
    ctx.existingBlocks.length
      ? ctx.existingBlocks.map((b) => `${b.date} ${b.start} ${b.duration} min ${b.subject}`).join(" ; ")
      : "aucun"
  }.`;

  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: `${SYSTEM}\n\n${contextNote}`,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      output_config: { effort: "low", format: zodOutputFormat(ChatReply) },
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ reply: "Je ne peux pas t'aider sur ce point. Revenons à tes révisions ?", actions: [] });
    }
    return Response.json(response.parsed_output);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Claude API error", error.status, error.message);
      return Response.json({ error: "api_error" }, { status: 502 });
    }
    throw error;
  }
}
