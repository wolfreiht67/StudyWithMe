-- StudyWithMe : une ligne par utilisateur avec ses données (planning, sessions, réglages).
-- À coller dans Supabase > SQL Editor, puis « Run ».

create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

-- Chaque utilisateur ne voit et ne modifie que ses propres données.
create policy "lecture de ses données" on public.user_data
  for select using (auth.uid() = user_id);
create policy "création de ses données" on public.user_data
  for insert with check (auth.uid() = user_id);
create policy "mise à jour de ses données" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
