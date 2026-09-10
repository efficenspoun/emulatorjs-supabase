create extension if not exists pgcrypto;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  system text not null,
  rom_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists games_user_id_idx on public.games(user_id);

alter table public.games enable row level security;

drop policy if exists "Users can read their games" on public.games;
create policy "Users can read their games"
on public.games for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their games" on public.games;
create policy "Users can create their games"
on public.games for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their games" on public.games;
create policy "Users can update their games"
on public.games for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their games" on public.games;
create policy "Users can delete their games"
on public.games for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values
  ('roms', 'roms', false),
  ('saves', 'saves', false),
  ('states', 'states', false)
on conflict (id) do nothing;

-- Every object is stored as: user-id/...

drop policy if exists "Users can read own ROMs" on storage.objects;
create policy "Users can read own ROMs"
on storage.objects for select
to authenticated
using (
  bucket_id = 'roms'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can upload own ROMs" on storage.objects;
create policy "Users can upload own ROMs"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'roms'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can update own ROMs" on storage.objects;
create policy "Users can update own ROMs"
on storage.objects for update
to authenticated
using (
  bucket_id = 'roms'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'roms'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can delete own ROMs" on storage.objects;
create policy "Users can delete own ROMs"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'roms'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can read own saves"
on storage.objects for select
to authenticated
using (
  bucket_id = 'saves'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can upload own saves"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'saves'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can update own saves"
on storage.objects for update
to authenticated
using (
  bucket_id = 'saves'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'saves'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can delete own saves"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'saves'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can read own states"
on storage.objects for select
to authenticated
using (
  bucket_id = 'states'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can upload own states"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'states'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can update own states"
on storage.objects for update
to authenticated
using (
  bucket_id = 'states'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'states'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can delete own states"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'states'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
