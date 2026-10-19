# StudyWithMe

Plateforme d'étude simple et efficace : planning, méthodes de travail, ambiances sonores, pauses, récompenses, historique et assistant qui crée ton planning en une phrase.

## Ce que contient cette première version

- **Session** : minuteur avec 5 méthodes (Pomodoro 25/5, 52/17, Deep work 90/20, Flowtime sans minuteur, Personnalisé). La pause démarre toute seule, avec une idée de pause active.
- **Ambiances** : pluie, vagues, bruit brun, piano, lofi, « pixel calme » (ambiance jeu vidéo rétro) et chill pour les pauses. Tout est généré en direct par le navigateur : aucun fichier audio, aucun problème de droits d'auteur. La musique bascule automatiquement en mode pause.
- **Planning** : vue semaine, ajout manuel de créneaux, lancement d'une session en un clic depuis un créneau.
- **Historique** : temps total, 7 derniers jours, temps par matière, liste des sessions.
- **Récompenses** : XP et niveaux, série de jours (avec un joker par semaine), plante qui grandit, badges, et une récompense perso (« après 4 sessions, je m'accorde un épisode »).
- **Assistant** (bulle en bas à droite) : « J'ai un partiel de maths vendredi, 2 h par jour » remplit le planning ; « lance un pomodoro en anglais avec de la pluie » démarre la session. Sans clé d'API, il fonctionne en mode simplifié qui comprend les demandes courantes.
- **Comptes** : connexion par Google ou lien par e-mail avec Supabase, synchronisation de l'historique. Sans Supabase, tout marche en mode local (données gardées dans le navigateur).

## Lancer le site sur ton ordinateur

Il faut [Node.js](https://nodejs.org) 20 ou plus.

```bash
npm install
npm run dev
```

Puis ouvre http://localhost:3000.

## Activer l'assistant IA (facultatif)

1. Crée une clé sur https://console.anthropic.com.
2. Copie `.env.example` en `.env.local` et remplis `ANTHROPIC_API_KEY`.

L'API est payante à l'usage. Avant d'ouvrir le site au public, ajoute une limite de messages par utilisateur pour maîtriser le coût.

## Activer les comptes (facultatif)

1. Crée un projet gratuit sur https://supabase.com.
2. Dans **SQL Editor**, colle le contenu de `supabase/schema.sql` et clique sur **Run**.
3. Dans **Project Settings > API**, copie l'URL et la clé `anon` dans `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Dans **Authentication > URL Configuration**, ajoute l'adresse de ton site (et `http://localhost:3000`).
5. Pour Google : **Authentication > Providers > Google** (il faut créer un identifiant OAuth dans Google Cloud).

## Mettre en ligne sur Vercel

1. Mets ce dossier sur GitHub.
2. Sur https://vercel.com, **Add New > Project**, choisis le dépôt.
3. Ajoute les mêmes variables d'environnement que dans `.env.local`.
4. **Deploy**. Le site est en ligne en une minute.

## Organisation du code

- `src/app/page.tsx` : structure de la page et onglets
- `src/app/api/chat/route.ts` : assistant IA (Claude)
- `src/components/` : un fichier par écran (session, planning, historique, récompenses, compte, assistant)
- `src/lib/audio.ts` : génération des ambiances sonores
- `src/lib/timer.tsx` : logique du minuteur et des pauses
- `src/lib/rewards.ts` : XP, niveaux, séries, badges, plante
- `src/lib/store.tsx` : données (navigateur et Supabase)
- `src/lib/localAssistant.ts` : assistant de secours sans IA
