"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export default function AccountView() {
  const { user, syncState, data, updateSettings, resetAll } = useStore();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const { custom, autoStartBreak } = data.settings;

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setMsg(error ? `Erreur : ${error.message}` : "Lien envoyé ! Ouvre ton mail et clique sur le lien pour te connecter.");
  };

  const google = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  };

  const syncLabel = { local: "Données enregistrées sur cet appareil", syncing: "Synchronisation…", synced: "Synchronisé avec ton compte ✓", error: "Erreur de synchronisation" }[syncState];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-6">
        <h2 className="text-lg font-semibold">Mon compte</h2>
        {!supabase ? (
          <div className="mt-3 space-y-2 text-sm text-muted">
            <p>
              Tu es en <strong className="text-ink">mode local</strong> : tout fonctionne et tes données restent dans ce navigateur.
            </p>
            <p>
              Pour activer les comptes et retrouver ton historique sur tous tes appareils, il suffit de brancher Supabase (voir le
              fichier README du projet).
            </p>
          </div>
        ) : user ? (
          <div className="mt-3 space-y-3 text-sm">
            <p>
              Connecté en tant que <strong>{user.email}</strong>
            </p>
            <p className="text-muted">{syncLabel}</p>
            <button className="btn-ghost" onClick={() => supabase!.auth.signOut()}>Se déconnecter</button>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            <p className="text-sm text-muted">Crée un compte pour sauvegarder ton historique et le retrouver partout. Tes sessions déjà faites ici seront gardées.</p>
            <button className="btn-ghost w-full" onClick={google}>Continuer avec Google</button>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
            </div>
            <form onSubmit={sendLink} className="space-y-2">
              <input type="email" required className="input" placeholder="ton@email.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn-primary w-full" type="submit">Recevoir un lien de connexion</button>
            </form>
            {msg && <p className="text-sm text-accent-2">{msg}</p>}
          </div>
        )}
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Réglages</h2>
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <span className="label">Méthode personnalisée</span>
            <div className="flex items-center gap-2">
              <input type="number" min={5} max={180} className="input w-24" value={custom.work} onChange={(e) => updateSettings({ custom: { ...custom, work: Number(e.target.value) } })} aria-label="Minutes de travail" />
              <span className="text-muted">min de travail</span>
              <input type="number" min={1} max={60} className="input w-24" value={custom.break} onChange={(e) => updateSettings({ custom: { ...custom, break: Number(e.target.value) } })} aria-label="Minutes de pause" />
              <span className="text-muted">min de pause</span>
            </div>
          </div>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={autoStartBreak} onChange={(e) => updateSettings({ autoStartBreak: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
            Lancer la pause automatiquement à la fin d&apos;une période
          </label>
          <div className="border-t border-line pt-4">
            <button
              className="btn-ghost text-danger"
              onClick={() => {
                if (confirm("Effacer tout ton planning, ton historique et tes réglages ?")) resetAll();
              }}
            >
              Tout effacer
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
