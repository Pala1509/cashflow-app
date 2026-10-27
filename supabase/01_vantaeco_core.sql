-- =====================================================================
-- VANTAECO — 01 CORE
-- Auth, Profiles, Vanta System, Waitlist, Avatares
-- Corre este PRIMERO, antes de cualquier otro.
-- =====================================================================

-- ─────────────────────────────────────────
-- DIAGNÓSTICO — columnas faltantes en profiles
-- Si alguna vez sale "column X does not exist" en profiles (o el
-- registro de un usuario falla raro), corre esto primero en vez de ir
-- cazando de a una — compara TODAS las columnas esperadas contra las
-- que existen de verdad en producción. Esta técnica salió del susto de
-- registro roto de Bryan (ver el changelog en README.md) — la base de
-- datos en producción se había desactualizado sin que nadie lo notara.
-- Copia y pega esto en una consulta aparte para correrlo (no es parte
-- del script de abajo, es solo referencia):
--
-- with esperadas(columna) as (
--   values
-- ('id'), ('nombre'), ('apellido'), ('telefono'), ('fecha_nacimiento'),
-- ('ciudad'), ('email'), ('avatar_url'), ('moneda'), ('idioma'), ('tema'),
-- ('notif_gastos_fijos'), ('notif_presupuestos'), ('notif_metas'),
-- ('notif_deudas'), ('notif_deudas_dias_antes'), ('notif_gastos_hormiga'),
-- ('notif_recordatorio_diario'), ('notif_dolar'),
-- ('cashflow_onboarding_visto'), ('vanta_system'), ('vanta_system_expires_at'),
-- ('es_pro'), ('es_pro_duo'), ('created_at'), ('updated_at')
-- )
-- select e.columna as columna_faltante
-- from esperadas e
-- left join information_schema.columns c
-- on c.table_name = 'profiles' and c.table_schema = 'public' and c.column_name = e.columna
-- where c.column_name is null;
-- ─────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────
-- PROFILES (tabla compartida por TODAS las apps Vanta)
-- ─────────────────────────────────────────
create table if not exists public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  nombre                text not null default 'Usuario',
  apellido              text,
  telefono              text,
  fecha_nacimiento      date,
  ciudad                text,
  -- País — CashFlow lo pide en el registro para mostrarle de entrada solo
  -- los bancos de su continente (ver BANCOS_GRUPOS/continenteDe en el
  -- frontend). Nullable: null en los usuarios que ya existían antes de
  -- este campo, y el frontend lo interpreta como "no filtrar".
  pais                  text,
  email                 text,
  avatar_url            text,
  moneda                text not null default 'COP',
  idioma                text not null default 'es',
  tema                  text not null default 'dark',

  -- Notificaciones CashFlow
  notif_gastos_fijos        boolean not null default true,
  notif_presupuestos        boolean not null default true,
  notif_metas               boolean not null default true,
  notif_deudas              boolean not null default true,
  notif_deudas_dias_antes   int not null default 3,
  notif_gastos_hormiga      boolean not null default true,
  notif_recordatorio_diario boolean not null default true,
  notif_dolar               boolean not null default true,

  -- Onboarding CashFlow (con prefijo porque profiles es compartida por
  -- todas las apps Vanta — cada app puede tener su propio onboarding acá)
  cashflow_onboarding_visto boolean not null default false,

  -- Vanta System (suscripción premium del ecosistema)
  vanta_system              boolean not null default false,
  vanta_system_expires_at   timestamptz,

  -- CashFlow Pro (separado de Vanta System)
  es_pro                    boolean not null default false,
  es_pro_duo                boolean not null default false,
  -- Qué plan de Pro tiene activo (para mostrarle "tu plan actual" en vez
  -- de la pantalla de compra otra vez) — null si nunca ha comprado nada
  -- o si su Pro viene de Dúo (compartido, no es un plan propio).
  plan_pro                  text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);


-- Respaldo completo — TODAS las columnas de profiles, no solo las nuevas.
-- El "create table if not exists" de arriba NO agrega columnas a una
-- tabla que ya existe (aunque le falten columnas nuevas) — por eso este
-- archivo se puede correr las veces que sea necesario sin miedo, y
-- cualquier columna que falte por lo que sea siempre se pone al día sola.
alter table public.profiles add column if not exists nombre text not null default 'Usuario';
alter table public.profiles add column if not exists apellido text;
alter table public.profiles add column if not exists telefono text;
alter table public.profiles add column if not exists fecha_nacimiento date;
alter table public.profiles add column if not exists ciudad text;
alter table public.profiles add column if not exists pais text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists moneda text not null default 'COP';
alter table public.profiles add column if not exists idioma text not null default 'es';
alter table public.profiles add column if not exists tema text not null default 'dark';
alter table public.profiles add column if not exists notif_gastos_fijos boolean not null default true;
alter table public.profiles add column if not exists notif_presupuestos boolean not null default true;
alter table public.profiles add column if not exists notif_metas boolean not null default true;
alter table public.profiles add column if not exists notif_deudas boolean not null default true;
alter table public.profiles add column if not exists notif_deudas_dias_antes int not null default 3;
alter table public.profiles add column if not exists notif_gastos_hormiga boolean not null default true;
alter table public.profiles add column if not exists notif_recordatorio_diario boolean not null default true;
alter table public.profiles add column if not exists notif_dolar boolean not null default true;
alter table public.profiles add column if not exists cashflow_onboarding_visto boolean not null default false;
alter table public.profiles add column if not exists vanta_system boolean not null default false;
alter table public.profiles add column if not exists vanta_system_expires_at timestamptz;
alter table public.profiles add column if not exists es_pro boolean not null default false;
alter table public.profiles add column if not exists es_pro_duo boolean not null default false;
alter table public.profiles add column if not exists plan_pro text;
do $$ begin
  alter table public.profiles add constraint profiles_plan_pro_check
    check (plan_pro is null or plan_pro in ('mensual','semestral','anual','unico','vitalicio'));
exception when duplicate_object or duplicate_table then null;
end $$;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- ─────────────────────────────────────────
-- TRIGGER: crear perfil al registrarse
-- ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre, apellido, telefono, email, pais)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'apellido',
    new.raw_user_meta_data->>'telefono',
    new.email,
    new.raw_user_meta_data->>'pais'
  );

  -- CashFlow: cuenta Efectivo inicial (solo si la tabla cuentas existe)
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'cuentas') then
    insert into public.cuentas (user_id, tipo, nombre, saldo, icono, color, four_x_mil)
    values (new.id, 'efectivo', 'Efectivo', 0, 'cash', 'lime', false);
  end if;

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────
-- WAITLIST (lista de espera de la web)
-- ─────────────────────────────────────────
create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- STORAGE: bucket de avatares
-- ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatares son públicos"         on storage.objects;
drop policy if exists "Usuarios suben su propio avatar"    on storage.objects;
drop policy if exists "Usuarios actualizan su propio avatar" on storage.objects;
drop policy if exists "Usuarios borran su propio avatar"   on storage.objects;

create policy "Avatares son públicos"
  on storage.objects for select using (bucket_id = 'avatars');

create policy "Usuarios suben su propio avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Usuarios actualizan su propio avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Usuarios borran su propio avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- ─────────────────────────────────────────
-- RLS PROFILES
-- ─────────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.waitlist        enable row level security;

drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own"   on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"   on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- CRÍTICO: sin esto, cualquier usuario logueado podía abrir la consola
-- del navegador y hacer supabase.from('profiles').update({ es_pro: true })
-- sobre su propia fila y volverse Pro gratis para siempre — el WITH CHECK
-- de arriba controla FILAS (que sigas siendo tú), no COLUMNAS, así que no
-- alcanza para bloquear esto.
--
-- La solución es un trigger (no un REVOKE a nivel de rol) porque este
-- mismo proyecto de Supabase también alberga otras cosas de Vanta Lab
-- Studio — un REVOKE afecta al rol "authenticated" completo, mientras
-- que un trigger solo se activa sobre public.profiles y solo mira estas
-- 4 columnas puntuales de CashFlow, así que no puede afectar nada más
-- de lo que este proyecto llegue a alojar.
--
-- Permite el cambio cuando: a) se corre desde el SQL Editor/backend
-- directo (sin JWT de PostgREST), b) lo hace una Edge Function con la
-- service_role key (ej. un futuro webhook de pago), o c) lo hace la
-- cuenta de Felo (para poder seguir usando el switch de prueba
-- Free/Pro). Bloquea a cualquier otro usuario autenticado desde la app.
grant update (es_pro, es_pro_duo, plan_pro, vanta_system, vanta_system_expires_at)
  on public.profiles to authenticated;

create or replace function public.profiles_guard_pro_columns()
returns trigger
language plpgsql
as $$
begin
  if (
    new.es_pro is distinct from old.es_pro
    or new.es_pro_duo is distinct from old.es_pro_duo
    or new.plan_pro is distinct from old.plan_pro
    or new.vanta_system is distinct from old.vanta_system
    or new.vanta_system_expires_at is distinct from old.vanta_system_expires_at
  )
  and auth.jwt() is not null
  and coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
  and coalesce(auth.jwt() ->> 'email', '') <> 'andresfelipepalaciosmoreno@gmail.com'
  then
    raise exception 'No autorizado para modificar el estado Pro de esta cuenta';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_pro_columns_trg on public.profiles;
create trigger profiles_guard_pro_columns_trg
  before update on public.profiles
  for each row execute function public.profiles_guard_pro_columns();

-- Deja la cuenta de Felo en Pro de una vez, de por vida.
update public.profiles set es_pro = true, plan_pro = 'vitalicio'
where id = (select id from auth.users where email = 'andresfelipepalaciosmoreno@gmail.com');
drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"   on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "waitlist: anyone insert" on public.waitlist;
create policy "waitlist: anyone insert" on public.waitlist for insert with check (true);

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 01_vantaeco_core.sql
-- =====================================================================
