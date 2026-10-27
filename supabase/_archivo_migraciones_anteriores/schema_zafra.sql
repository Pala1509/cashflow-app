-- =====================================================================
-- ZAFRA — Esquema de base de datos (Supabase / Postgres)
-- "Tu control financiero." — Vanta Lab Studio
-- =====================================================================
-- Cómo usarlo:
-- 1. Ve a tu proyecto de Supabase > SQL Editor > New query.
-- 2. Pega TODO este archivo y ejecútalo.
-- 3. Copia la URL y la anon key del proyecto (Settings > API) y pásamelas
--    (o ponlas tú mismo en el .env de la app: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- TIPOS
-- ---------------------------------------------------------------------
do $$ begin create type tipo_transaccion as enum ('ingreso','egreso','transferencia'); exception when duplicate_object then null; end $$;
do $$ begin create type tipo_cuenta as enum ('efectivo','billetera_digital','cuenta_bancaria','tarjeta_credito'); exception when duplicate_object then null; end $$;
do $$ begin create type tipo_deuda_credito as enum ('deuda','credito'); exception when duplicate_object then null; end $$;
do $$ begin create type tipo_interes as enum ('sobre_saldo','fijo_capital','sin_interes'); exception when duplicate_object then null; end $$;
do $$ begin create type estado_deuda_credito as enum ('activa','pagada'); exception when duplicate_object then null; end $$;
do $$ begin create type estado_meta as enum ('activa','completada'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default 'Usuario',
  apellido text,
  fecha_nacimiento date,
  ciudad text,
  email text,
  avatar_url text,
  moneda text not null default 'COP',
  notif_gastos_fijos boolean not null default true,
  notif_presupuestos boolean not null default true,
  notif_metas boolean not null default true,
  notif_deudas boolean not null default true,
  notif_deudas_dias_antes int not null default 3,
  idioma text not null default 'es',
  es_pro boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CUENTAS — efectivo, billeteras digitales, cuentas bancarias, tarjetas
-- ---------------------------------------------------------------------
create table if not exists public.cuentas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo tipo_cuenta not null,
  subtipo text,                              -- 'Cuenta de ahorros', 'CDT', etc. (solo cuenta_bancaria)
  nombre text not null,
  saldo numeric(14,2) not null default 0,     -- para tarjeta_credito, representa el CUPO DISPONIBLE
  cupo_total numeric(14,2),                   -- solo tarjeta_credito
  icono text not null default 'wallet',
  color text not null default 'lime',
  four_x_mil boolean not null default false,  -- si esta cuenta descuenta 4x1000 en egresos
  es_ahorro boolean not null default false,   -- cuenta dedicada exclusivamente a ahorros
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  constraint chk_efectivo_sin_4x1000 check (not (tipo = 'efectivo' and four_x_mil = true))
);

-- ---------------------------------------------------------------------
-- CATEGORIAS
-- ---------------------------------------------------------------------
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  tipo tipo_transaccion not null,
  icono text not null default 'circle',
  grupo text,
  color text not null default 'lavender',
  predeterminada boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, nombre)
);

-- ---------------------------------------------------------------------
-- TRANSACCIONES
-- ---------------------------------------------------------------------
create table if not exists public.transacciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo tipo_transaccion not null,
  monto numeric(14,2) not null check (monto > 0),
  monto_4x1000 numeric(14,2) not null default 0,
  categoria_id uuid references public.categorias (id) on delete set null,
  cuenta_id uuid not null references public.cuentas (id) on delete restrict,
  cuenta_destino_id uuid references public.cuentas (id) on delete restrict,
  descripcion text,
  lugar text,
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists idx_transacciones_user_fecha on public.transacciones (user_id, fecha desc);
create index if not exists idx_transacciones_cuenta on public.transacciones (cuenta_id);

-- ---------------------------------------------------------------------
-- DEUDAS Y CREDITOS + motor de interés
-- ---------------------------------------------------------------------
create table if not exists public.deudas_creditos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo tipo_deuda_credito not null,
  subtipo text,                               -- 'Préstamo bancario', 'Préstamo con un tercero', etc.
  nombre text not null,
  entidad text,
  capital numeric(14,2) not null check (capital > 0),
  capital_pagado numeric(14,2) not null default 0,
  tipo_interes tipo_interes not null default 'sin_interes',
  tasa_interes numeric(6,3) default 0,        -- % por periodo
  periodo_interes text default 'mensual',
  fecha_inicio date not null default current_date,
  fecha_limite date,
  plazo_meses int,
  cuota_mensual numeric(14,2),
  estado estado_deuda_credito not null default 'activa',
  notas text,
  created_at timestamptz not null default now()
);

-- Cada pago separa cuánto fue a interés (fijo o sobre saldo) y cuánto a capital.
-- Esto es CLAVE para que "interés fijo sobre capital" no mienta sobre el avance real.
create table if not exists public.pagos_deuda (
  id uuid primary key default gen_random_uuid(),
  deuda_id uuid not null references public.deudas_creditos (id) on delete cascade,
  monto_total numeric(14,2) not null check (monto_total > 0),
  monto_interes numeric(14,2) not null default 0,
  monto_capital numeric(14,2) not null default 0,
  fecha date not null default current_date,
  notas text,
  created_at timestamptz not null default now()
);
create index if not exists idx_pagos_deuda_deuda on public.pagos_deuda (deuda_id);

-- ---------------------------------------------------------------------
-- INGRESOS Y GASTOS FIJOS (recurrentes) — pantalla "Balance"
-- ---------------------------------------------------------------------
do $$ begin
  create type frecuencia_fija as enum ('quincenal','mensual','trimestral','semestral','anual');
exception when duplicate_object then null; end $$;

create table if not exists public.ingresos_fijos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  monto numeric(14,2) not null check (monto > 0),
  dia_mes int not null check (dia_mes between 1 and 31),
  frecuencia frecuencia_fija not null default 'mensual',
  categoria_id uuid references public.categorias (id) on delete set null,
  icono text not null default 'wallet',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.gastos_fijos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  monto numeric(14,2) not null check (monto > 0),
  dia_mes int not null check (dia_mes between 1 and 31),
  frecuencia frecuencia_fija not null default 'mensual',
  categoria_id uuid references public.categorias (id) on delete set null,
  icono text not null default 'home',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- (va aquí y no en la definición de transacciones porque esta tabla se
-- crea después — el orden de las tablas arriba importa para las FK)
alter table public.transacciones add column if not exists gasto_fijo_id uuid references public.gastos_fijos (id) on delete set null;
alter table public.transacciones add column if not exists ingreso_fijo_id uuid references public.ingresos_fijos (id) on delete set null;
alter table public.deudas_creditos add column if not exists gasto_fijo_id uuid references public.gastos_fijos (id) on delete set null;

-- ---------------------------------------------------------------------
-- METAS DE AHORRO
-- ---------------------------------------------------------------------
create table if not exists public.metas_ahorro (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  monto_objetivo numeric(14,2) not null check (monto_objetivo > 0),
  monto_actual numeric(14,2) not null default 0,
  aporte_mensual numeric(14,2) not null default 0,
  fecha_limite date,
  icono text not null default 'piggy-bank',
  color text not null default 'lime',
  estado estado_meta not null default 'activa',
  created_at timestamptz not null default now()
);

create table if not exists public.aportes_meta (
  id uuid primary key default gen_random_uuid(),
  meta_id uuid not null references public.metas_ahorro (id) on delete cascade,
  monto numeric(14,2) not null check (monto > 0),
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists idx_aportes_meta_meta on public.aportes_meta (meta_id);

-- ---------------------------------------------------------------------
-- PRESUPUESTOS
-- ---------------------------------------------------------------------
create table if not exists public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  categoria_id uuid not null references public.categorias (id) on delete cascade,
  monto_limite numeric(14,2) not null check (monto_limite > 0),
  mes int not null check (mes between 1 and 12),
  anio int not null check (anio between 2000 and 2100),
  created_at timestamptz not null default now(),
  unique (user_id, categoria_id, mes, anio)
);

-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- Nuevo usuario -> profile + categorías base + cuenta "Efectivo" inicial
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)), new.email);

  -- Las categorías por defecto (~68, agrupadas y coloridas) las siembra la
  -- app automáticamente en el primer login — así solo existe una lista
  -- maestra (en el código), no dos copias desincronizadas.

  insert into public.cuentas (user_id, tipo, nombre, saldo, icono, color, four_x_mil)
  values (new.id, 'efectivo', 'Efectivo', 0, 'cash', 'lime', false);

  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Transacción insertada/eliminada/actualizada -> ajustar saldo de la cuenta
create or replace function public.sync_saldo_cuenta()
returns trigger language plpgsql security definer set search_path = public as $$
declare delta numeric;
begin
  if TG_OP = 'DELETE' then
    delta := case when old.tipo = 'ingreso' then -old.monto else (old.monto + old.monto_4x1000) end;
    update public.cuentas set saldo = saldo + delta where id = old.cuenta_id;
    return old;
  elsif TG_OP = 'INSERT' then
    delta := case when new.tipo = 'ingreso' then new.monto else -(new.monto + new.monto_4x1000) end;
    update public.cuentas set saldo = saldo + delta where id = new.cuenta_id;
    return new;
  elsif TG_OP = 'UPDATE' then
    -- revertir el efecto viejo y aplicar el nuevo (soporta editar un movimiento)
    delta := case when old.tipo = 'ingreso' then -old.monto else (old.monto + old.monto_4x1000) end;
    update public.cuentas set saldo = saldo + delta where id = old.cuenta_id;
    delta := case when new.tipo = 'ingreso' then new.monto else -(new.monto + new.monto_4x1000) end;
    update public.cuentas set saldo = saldo + delta where id = new.cuenta_id;
    return new;
  end if;
  return null;
end; $$;
drop trigger if exists on_transaccion_change on public.transacciones;
create trigger on_transaccion_change
  after insert or update or delete on public.transacciones
  for each row execute procedure public.sync_saldo_cuenta();

-- Pago de deuda -> actualizar capital_pagado y estado (usa capital, no el total con interés)
create or replace function public.sync_pago_deuda()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_deuda_id uuid := coalesce(new.deuda_id, old.deuda_id);
begin
  update public.deudas_creditos d
  set capital_pagado = (select coalesce(sum(monto_capital),0) from public.pagos_deuda where deuda_id = v_deuda_id),
      estado = case when (select coalesce(sum(monto_capital),0) from public.pagos_deuda where deuda_id = v_deuda_id) >= d.capital
                    then 'pagada'::estado_deuda_credito else 'activa'::estado_deuda_credito end
  where d.id = v_deuda_id;
  return coalesce(new, old);
end; $$;
drop trigger if exists on_pago_deuda_change on public.pagos_deuda;
create trigger on_pago_deuda_change
  after insert or update or delete on public.pagos_deuda
  for each row execute procedure public.sync_pago_deuda();

-- Aporte a meta -> actualizar monto_actual y estado
create or replace function public.sync_aporte_meta()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_meta_id uuid := coalesce(new.meta_id, old.meta_id);
begin
  update public.metas_ahorro m
  set monto_actual = (select coalesce(sum(monto),0) from public.aportes_meta where meta_id = v_meta_id),
      estado = case when (select coalesce(sum(monto),0) from public.aportes_meta where meta_id = v_meta_id) >= m.monto_objetivo
                    then 'completada'::estado_meta else 'activa'::estado_meta end
  where m.id = v_meta_id;
  return coalesce(new, old);
end; $$;
drop trigger if exists on_aporte_meta_change on public.aportes_meta;
create trigger on_aporte_meta_change
  after insert or update or delete on public.aportes_meta
  for each row execute procedure public.sync_aporte_meta();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles        enable row level security;
alter table public.cuentas         enable row level security;
alter table public.categorias      enable row level security;
alter table public.transacciones   enable row level security;
alter table public.deudas_creditos enable row level security;
alter table public.pagos_deuda     enable row level security;
alter table public.ingresos_fijos  enable row level security;
alter table public.gastos_fijos    enable row level security;
alter table public.metas_ahorro    enable row level security;
alter table public.aportes_meta    enable row level security;
alter table public.presupuestos    enable row level security;

create policy "profiles: own" on public.profiles for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id);

create policy "cuentas: crud own" on public.cuentas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categorias: crud own" on public.categorias for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transacciones: crud own" on public.transacciones for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "deudas: crud own" on public.deudas_creditos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ingresos_fijos: crud own" on public.ingresos_fijos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gastos_fijos: crud own" on public.gastos_fijos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "metas: crud own" on public.metas_ahorro for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "presupuestos: crud own" on public.presupuestos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "pagos_deuda: crud own" on public.pagos_deuda for all
  using (exists (select 1 from public.deudas_creditos d where d.id = deuda_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.deudas_creditos d where d.id = deuda_id and d.user_id = auth.uid()));

create policy "aportes_meta: crud own" on public.aportes_meta for all
  using (exists (select 1 from public.metas_ahorro m where m.id = meta_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.metas_ahorro m where m.id = meta_id and m.user_id = auth.uid()));

-- =====================================================================
-- FIN
-- =====================================================================
