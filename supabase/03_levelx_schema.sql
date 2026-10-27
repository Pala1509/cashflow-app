-- =====================================================================
-- VANTAECO — 03 LEVELX SCHEMA
-- Tablas de LevelX — Hábitos, Misiones, Arquetipos, Gremios
-- Corre DESPUÉS de 01_vantaeco_core.sql
-- ⚠️  PENDIENTE — se completa cuando retomemos LevelX
-- =====================================================================

-- Las tablas de LevelX van aquí cuando las construyamos.
-- El user_id siempre referencia auth.users(id) del mismo proyecto VantaEco.
-- Ejemplo de lo que vendrá:
--
-- agent_stats      → nivel, EXP, rango, STR, AGI, VIT, INT, PER
-- arquetipos       → definición de cada arquetipo
-- misiones         → misiones diarias del agente
-- quests_diarias   → registro de completadas por día
-- gremios          → grupos sociales
-- gremio_miembros  → membresía
-- amigos           → red social del ecosistema
--
-- Por ahora solo se incluye agent_stats básico para que la web
-- pueda mostrar nivel y rango en el portal de cuenta.

create table if not exists public.agent_stats (
  id                  uuid primary key references auth.users(id) on delete cascade,
  nivel               integer not null default 1,
  exp                 integer not null default 0,
  exp_next            integer not null default 100,
  rango               text not null default 'F',
  arquetipo           text,
  str                 integer not null default 1,
  agi                 integer not null default 1,
  vit                 integer not null default 1,
  int                 integer not null default 1,
  per                 integer not null default 1,
  racha_actual        integer not null default 0,
  racha_max           integer not null default 0,
  misiones_completadas integer not null default 0,
  updated_at          timestamptz not null default now()
);

alter table public.agent_stats enable row level security;

drop policy if exists "agent_stats: select own" on public.agent_stats;
create policy "agent_stats: select own"  on public.agent_stats for select using (auth.uid() = id);
drop policy if exists "agent_stats: update own" on public.agent_stats;
create policy "agent_stats: update own"  on public.agent_stats for update using (auth.uid() = id);
drop policy if exists "agent_stats: insert own" on public.agent_stats;
create policy "agent_stats: insert own"  on public.agent_stats for insert with check (auth.uid() = id);

-- Trigger: crear stats al registrarse (si el usuario ya existe en profiles)
create or replace function public.handle_new_agent_stats()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.agent_stats(id) values (new.id) on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_profile_created_stats on public.profiles;
create trigger on_profile_created_stats
  after insert on public.profiles
  for each row execute procedure public.handle_new_agent_stats();

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 03_levelx_schema.sql
-- =====================================================================
