"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS, EMPTY_DATA, type AppData, type PlanBlock, type Settings, type StudySession } from "./types";
import { supabase } from "./supabase";

const STORAGE_KEY = "studywithme:data:v1";

function loadLocal(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DATA;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      blocks: parsed.blocks ?? [],
      sessions: parsed.sessions ?? [],
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      updatedAt: parsed.updatedAt ?? EMPTY_DATA.updatedAt,
    };
  } catch {
    return EMPTY_DATA;
  }
}

function saveLocal(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // stockage indisponible (navigation privée) : on continue en mémoire
  }
}

/** Fusionne deux jeux de données : union par id, la version la plus récente gagne pour les réglages. */
function merge(a: AppData, b: AppData): AppData {
  const byId = <T extends { id: string }>(x: T[], y: T[]) => {
    const m = new Map<string, T>();
    [...x, ...y].forEach((item) => m.set(item.id, item));
    return [...m.values()];
  };
  const newer = a.updatedAt > b.updatedAt ? a : b;
  return {
    blocks: byId(a.blocks, b.blocks),
    sessions: byId(a.sessions, b.sessions),
    settings: newer.settings,
    updatedAt: new Date().toISOString(),
  };
}

interface Store {
  data: AppData;
  ready: boolean;
  user: User | null;
  syncState: "local" | "syncing" | "synced" | "error";
  addBlocks: (blocks: PlanBlock[]) => void;
  updateBlock: (id: string, patch: Partial<PlanBlock>) => void;
  removeBlock: (id: string) => void;
  addSession: (s: StudySession) => void;
  removeSession: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetAll: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [syncState, setSyncState] = useState<Store["syncState"]>("local");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chargement initial depuis le navigateur (après le montage, pour éviter les écarts d'hydratation).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(loadLocal());
    setReady(true);
  }, []);

  // Session Supabase
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // À la connexion : récupérer les données du compte et les fusionner avec les données locales.
  useEffect(() => {
    if (!supabase || !user || !ready) return;
    let cancelled = false;
    (async () => {
      setSyncState("syncing");
      const { data: row, error } = await supabase!.from("user_data").select("data").eq("user_id", user.id).maybeSingle();
      if (cancelled) return;
      if (error) {
        setSyncState("error");
        return;
      }
      setData((local) => {
        const merged = row?.data ? merge(local, row.data as AppData) : local;
        saveLocal(merged);
        void supabase!.from("user_data").upsert({ user_id: user.id, data: merged, updated_at: new Date().toISOString() });
        return merged;
      });
      setSyncState("synced");
    })();
    return () => {
      cancelled = true;
    };
  }, [user, ready]);

  const persist = useCallback(
    (next: AppData) => {
      saveLocal(next);
      if (!supabase || !user) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSyncState("syncing");
      saveTimer.current = setTimeout(async () => {
        const { error } = await supabase!
          .from("user_data")
          .upsert({ user_id: user.id, data: next, updated_at: new Date().toISOString() });
        setSyncState(error ? "error" : "synced");
      }, 800);
    },
    [user],
  );

  const mutate = useCallback(
    (fn: (d: AppData) => AppData) => {
      setData((prev) => {
        const next = { ...fn(prev), updatedAt: new Date().toISOString() };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const store: Store = {
    data,
    ready,
    user,
    syncState: user ? syncState : "local",
    addBlocks: (blocks) => mutate((d) => ({ ...d, blocks: [...d.blocks, ...blocks] })),
    updateBlock: (id, patch) => mutate((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
    removeBlock: (id) => mutate((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) })),
    addSession: (s) => mutate((d) => ({ ...d, sessions: [...d.sessions, s] })),
    removeSession: (id) => mutate((d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== id) })),
    updateSettings: (patch) => mutate((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
    resetAll: () => mutate(() => ({ ...EMPTY_DATA })),
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore doit être utilisé dans StoreProvider");
  return s;
}
