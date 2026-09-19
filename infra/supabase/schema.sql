-- Esquema opcional. El planificador offline no depende de estas tablas.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  transport text not null check (transport in ('metro', 'metrobus')),
  from_station text not null,
  to_station text not null,
  route_mode text not null default 'fast' check (route_mode in ('fast', 'transfers')),
  network_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.route_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transport text not null check (transport in ('metro', 'metrobus')),
  from_station text not null,
  to_station text not null,
  route_mode text not null default 'fast' check (route_mode in ('fast', 'transfers')),
  planned_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'es' check (locale in ('es', 'en')),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  default_route_mode text not null default 'fast' check (default_route_mode in ('fast', 'transfers')),
  history_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists saved_routes_set_updated_at on public.saved_routes;
create trigger saved_routes_set_updated_at
before update on public.saved_routes
for each row execute function public.set_updated_at();

drop trigger if exists preferences_set_updated_at on public.user_preferences;
create trigger preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.saved_routes enable row level security;
alter table public.route_history enable row level security;
alter table public.user_preferences enable row level security;

revoke all on public.profiles from anon;
revoke all on public.saved_routes from anon;
revoke all on public.route_history from anon;
revoke all on public.user_preferences from anon;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.saved_routes to authenticated;
grant select, insert, delete on public.route_history to authenticated;
grant select, insert, update on public.user_preferences to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "saved_routes_select_own" on public.saved_routes;
create policy "saved_routes_select_own" on public.saved_routes
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "saved_routes_insert_own" on public.saved_routes;
create policy "saved_routes_insert_own" on public.saved_routes
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "saved_routes_update_own" on public.saved_routes;
create policy "saved_routes_update_own" on public.saved_routes
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "saved_routes_delete_own" on public.saved_routes;
create policy "saved_routes_delete_own" on public.saved_routes
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "route_history_select_own" on public.route_history;
create policy "route_history_select_own" on public.route_history
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "route_history_insert_own" on public.route_history;
create policy "route_history_insert_own" on public.route_history
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "route_history_delete_own" on public.route_history;
create policy "route_history_delete_own" on public.route_history
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "preferences_select_own" on public.user_preferences;
create policy "preferences_select_own" on public.user_preferences
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "preferences_insert_own" on public.user_preferences;
create policy "preferences_insert_own" on public.user_preferences
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "preferences_update_own" on public.user_preferences;
create policy "preferences_update_own" on public.user_preferences
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists saved_routes_user_created_idx
on public.saved_routes (user_id, created_at desc);

create index if not exists route_history_user_planned_idx
on public.route_history (user_id, planned_at desc);
