"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** null quand Supabase n'est pas configuré : le site fonctionne alors en mode local. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
