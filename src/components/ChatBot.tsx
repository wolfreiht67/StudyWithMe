"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useTimer } from "@/lib/timer";
import { localAssistant } from "@/lib/localAssistant";
import type { ChatActionT, ChatContext, ChatMessage, ChatReplyT } from "@/lib/chat";
import { DAY_NAMES, addDays, dayIndex, toISODate, uid } from "@/lib/dates";
import type { TabId } from "@/lib/types";

const SUGGESTIONS = [
  "J'ai un partiel de maths et de physique vendredi, 2 h par jour",
  "Lance un pomodoro en anglais avec de la pluie",
  "Organise ma semaine : philo, SES et anglais, 1 h 30 par soir",
  "Montre mon historique",
];

export default function ChatBot({ onNavigate }: { onNavigate: (t: TabId) => void }) {
  const { data, addBlocks, updateSettings } = useStore();
  const timer = useTimer();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Salut ! Dis-moi ce que tu dois réviser et pour quand, je te prépare ton planning en quelques secondes. Je peux aussi lancer une session pour toi." },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const buildContext = (): ChatContext => {
    const now = new Date();
    const today = toISODate(now);
    const horizon = toISODate(addDays(now, 14));
    const subjects = new Set<string>();
    [...data.sessions].reverse().forEach((s) => s.subject !== "Sans matière" && subjects.add(s.subject));
    data.blocks.forEach((b) => subjects.add(b.subject));
    return {
      today,
      weekday: DAY_NAMES[dayIndex(now)].toLowerCase(),
      now: now.toTimeString().slice(0, 5),
      existingBlocks: data.blocks
        .filter((b) => b.date >= today && b.date <= horizon)
        .map(({ date, start, duration, subject }) => ({ date, start, duration, subject })),
      recentSubjects: [...subjects].slice(0, 8),
    };
  };

  const runActions = (actions: ChatActionT[]) => {
    for (const a of actions) {
      if (a.type === "add_blocks" && a.blocks?.length) {
        addBlocks(a.blocks.map((b) => ({ ...b, note: b.note ?? undefined, id: uid() })));
      } else if (a.type === "start_session") {
        if (a.ambiance) updateSettings({ workAmbiance: a.ambiance });
        if (timer.status === "idle") timer.start({ subject: a.subject ?? "Révisions", methodId: a.methodId ?? "pomodoro" });
        onNavigate("session");
        setOpen(false);
      } else if (a.type === "set_ambiance" && a.ambiance) {
        updateSettings({ workAmbiance: a.ambiance });
      } else if (a.type === "navigate" && a.tab) {
        onNavigate(a.tab);
      }
    }
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(history);
    setInput("");
    setLoading(true);
    const context = buildContext();
    let result: ChatReplyT | null = null;
    if (aiAvailable) {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // le premier message d'accueil ne sert pas au modèle
          body: JSON.stringify({ messages: history.slice(1), context }),
        });
        if (res.status === 501) setAiAvailable(false);
        else if (res.ok) result = (await res.json()) as ChatReplyT;
      } catch {
        // réseau indisponible : on bascule sur l'assistant local
      }
    }
    if (!result) result = localAssistant(content, context);
    setMessages((m) => [...m, { role: "assistant", content: result!.reply }]);
    runActions(result.actions);
    setLoading(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed right-5 bottom-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-night shadow-lg shadow-accent/30 transition hover:scale-105"
        aria-label={open ? "Fermer l'assistant" : "Ouvrir l'assistant"}
      >
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div className="card animate-pop fixed right-5 bottom-24 z-40 flex h-[min(560px,75vh)] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden border-accent/30 bg-card shadow-2xl">
          <div className="border-b border-line px-4 py-3">
            <div className="font-semibold">Assistant StudyWithMe</div>
            <div className="text-xs text-muted">{aiAvailable ? "Planning express et raccourcis" : "Mode simplifié (sans IA)"}</div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-accent text-night" : "bg-card-2 text-ink"}`}>{m.content}</div>
              </div>
            ))}
            {loading && <div className="text-sm text-muted">L&apos;assistant réfléchit…</div>}
            {messages.length === 1 && (
              <div className="space-y-2 pt-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="block w-full rounded-xl border border-line px-3 py-2 text-left text-xs text-muted hover:border-accent hover:text-ink">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form
            className="flex gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input className="input" placeholder="Ex. bac de philo dans 2 semaines…" value={input} onChange={(e) => setInput(e.target.value)} />
            <button className="btn-primary px-3" disabled={loading || !input.trim()} type="submit" aria-label="Envoyer">➤</button>
          </form>
        </div>
      )}
    </>
  );
}
