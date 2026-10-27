-- =====================================================================
-- VANTAECO — 02 CASHFLOW SCHEMA
-- Todas las tablas, tipos, triggers y RLS de CashFlow
-- Corre DESPUÉS de 01_vantaeco_core.sql
-- IMPORTANTE: corre primero solo esta línea y dale Run, luego el resto:
--   alter type tipo_transaccion add value if not exists 'transferencia';
-- =====================================================================

-- ─────────────────────────────────────────
-- DIAGNÓSTICO — columnas faltantes en cuentas
-- Mismo patrón que el diagnóstico de profiles en 01_vantaeco_core.sql —
-- si algo en Cuentas se queja de una columna que no existe, corre esto
-- aparte para encontrar TODAS las que falten de una sola vez:
--
-- with esperadas(columna) as (
--   values
-- ('id'), ('user_id'), ('tipo'), ('subtipo'), ('nombre'), ('saldo'),
-- ('cupo_total'), ('icono'), ('color'), ('banco'), ('diseno_tarjeta'),
-- ('four_x_mil'), ('es_ahorro'), ('activa'), ('cuota_manejo'),
-- ('tasa_interes'), ('dia_corte'), ('dia_pago'), ('tasa_ea'),
-- ('fecha_apertura'), ('plazo_dias'), ('compartida_con_id'),
-- ('congelada'), ('moneda'), ('created_at')
-- )
-- select e.columna as columna_faltante
-- from esperadas e
-- left join information_schema.columns c
-- on c.table_name = 'cuentas' and c.table_schema = 'public' and c.column_name = e.columna
-- where c.column_name is null;
-- ─────────────────────────────────────────

-- ─────────────────────────────────────────
-- TIPOS
-- ─────────────────────────────────────────
do $$ begin create type tipo_transaccion      as enum ('ingreso','egreso','transferencia');  exception when duplicate_object then null; end $$;
do $$ begin create type tipo_cuenta           as enum ('efectivo','billetera_digital','cuenta_bancaria','tarjeta_credito','monedero','tarjeta_debito','cdt'); exception when duplicate_object then null; end $$;
do $$ begin create type tipo_deuda_credito    as enum ('deuda','credito');                   exception when duplicate_object then null; end $$;
do $$ begin create type tipo_interes          as enum ('sobre_saldo','fijo_capital','sin_interes'); exception when duplicate_object then null; end $$;
do $$ begin create type estado_deuda_credito  as enum ('activa','pagada');                   exception when duplicate_object then null; end $$;
do $$ begin create type estado_meta           as enum ('activa','completada');               exception when duplicate_object then null; end $$;
do $$ begin create type frecuencia_fija       as enum ('quincenal','mensual','trimestral','semestral','anual'); exception when duplicate_object then null; end $$;
do $$ begin create type estado_pro_duo        as enum ('pendiente','activo','finalizado');   exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────
-- CUENTAS
-- ─────────────────────────────────────────
create table if not exists public.cuentas (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  tipo                tipo_cuenta not null,
  subtipo             text,
  nombre              text not null,
  saldo               numeric(14,2) not null default 0,
  cupo_total          numeric(14,2),
  icono               text not null default 'wallet',
  color               text not null default 'lime',
  banco               text,
  diseno_tarjeta      text default 'clasico',
  four_x_mil          boolean not null default false,
  es_ahorro           boolean not null default false,
  activa              boolean not null default true,
  -- Tarjeta crédito
  cuota_manejo        numeric not null default 0,
  tasa_interes        numeric not null default 0,
  dia_corte           smallint,
  dia_pago            smallint,
  -- CDT / bolsillo remunerado
  tasa_ea             numeric not null default 0,
  fecha_apertura      date,
  plazo_dias          int,
  -- Pro Dúo
  compartida_con_id   uuid references auth.users(id) on delete set null,
  congelada           boolean not null default false,
  moneda              text not null default 'COP',
  created_at          timestamptz not null default now(),
  constraint chk_efectivo_sin_4x1000 check (not (tipo = 'efectivo' and four_x_mil = true)),
  constraint chk_dia_corte check (dia_corte is null or (dia_corte between 1 and 31)),
  constraint chk_dia_pago  check (dia_pago  is null or (dia_pago  between 1 and 31))
);

alter table public.cuentas add column if not exists moneda text not null default 'COP';

-- ─────────────────────────────────────────
-- CATEGORÍAS
-- ─────────────────────────────────────────
create table if not exists public.categorias (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  nombre        text not null,
  tipo          tipo_transaccion not null,
  icono         text not null default 'circle',
  grupo         text,
  color         text not null default 'lavender',
  predeterminada boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (user_id, nombre, tipo)
);

-- BUG REAL encontrado y arreglado: el unique original era (user_id,
-- nombre) sin el tipo — eso significaba que no podías crear una
-- categoría de ingreso con el mismo nombre que ya tenías en una de
-- egreso (o viceversa), aunque conceptualmente son cosas separadas.
-- Explotaba con un error crudo de Postgres en pantalla ("duplicate key
-- value..."), no un mensaje amigable. Este bloque arregla las
-- instalaciones que ya tenían el constraint viejo (create table de
-- arriba no hace nada si la tabla ya existe):
do $$ begin
  alter table public.categorias drop constraint categorias_user_id_nombre_key;
exception when undefined_object then null;
end $$;

do $$ begin
  alter table public.categorias add constraint categorias_user_id_nombre_tipo_key unique (user_id, nombre, tipo);
-- Un unique constraint crea también un índice con el mismo nombre por
-- debajo — si ya corriste este archivo una vez y el constraint quedó
-- creado, Postgres no lanza "duplicate_object" (42710) sino
-- "duplicate_table" (42P07, porque un índice también es una "relation"
-- para Postgres) — sin este segundo caso, volver a correr el archivo
-- completo (como se hace siempre) fallaba acá y no seguía con el resto.
exception when duplicate_object or duplicate_table then null;
end $$;

-- ─────────────────────────────────────────
-- BANCOS PERSONALIZADOS
-- ─────────────────────────────────────────
-- Bancos que el usuario agrega porque no están en la lista predeterminada
-- de BANCOS_GRUPOS (Cuentas.tsx) — mismo patrón que categorías
-- personalizadas: función de CashFlow Pro, con límite en Free (ver
-- FREE_LIMITS.maxBancosPersonalizados en pro.ts). El `grupo` guarda el
-- continente elegido al crearlo (norteamerica/centroamerica/sudamerica/
-- europa/asia) solo para mostrarlo agrupado igual que los predeterminados
-- — no afecta ninguna lógica de moneda.
create table if not exists public.bancos_personalizados (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  nombre     text not null,
  grupo      text not null default 'sudamerica',
  color      text not null default 'lavender',
  created_at timestamptz not null default now(),
  unique (user_id, nombre)
);

-- ─────────────────────────────────────────
-- TRANSACCIONES
-- ─────────────────────────────────────────
create table if not exists public.transacciones (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  tipo                tipo_transaccion not null,
  monto               numeric(14,2) not null check (monto > 0),
  monto_4x1000        numeric(14,2) not null default 0,
  categoria_id        uuid references public.categorias(id) on delete set null,
  cuenta_id           uuid not null references public.cuentas(id) on delete restrict,
  cuenta_destino_id   uuid references public.cuentas(id) on delete restrict,
  gasto_fijo_id       uuid,  -- FK se agrega luego (circular)
  ingreso_fijo_id     uuid,  -- FK se agrega luego (circular)
  descripcion         text,
  lugar               text,
  fecha               date not null default current_date,
  created_at          timestamptz not null default now()
);
create index if not exists idx_transacciones_user_fecha on public.transacciones(user_id, fecha desc);
create index if not exists idx_transacciones_cuenta     on public.transacciones(cuenta_id);

-- ─────────────────────────────────────────
-- DEUDAS Y CRÉDITOS
-- ─────────────────────────────────────────
create table if not exists public.deudas_creditos (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  tipo                tipo_deuda_credito not null,
  subtipo             text,
  nombre              text not null,
  entidad             text,
  capital             numeric(14,2) not null check (capital > 0),
  capital_pagado      numeric(14,2) not null default 0,
  tipo_interes        tipo_interes not null default 'sin_interes',
  tasa_interes        numeric(6,3) default 0,
  periodo_interes     text default 'mensual',
  fecha_inicio        date not null default current_date,
  fecha_limite        date,
  notif_dias_antes    int, -- por-ítem: si no está vacío, avisa este número de días antes de fecha_limite (aparte del interruptor maestro en profiles)
  plazo_meses         int,
  cuota_mensual       numeric(14,2),
  estado              estado_deuda_credito not null default 'activa',
  notas               text,
  gasto_fijo_id       uuid,  -- FK se agrega luego
  compartida_con_id   uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

alter table public.deudas_creditos add column if not exists notif_dias_antes int;
-- Encontrada en el sondeo de seguridad: cuentas y metas_ahorro sí tenían
-- "congelada" para cortar el acceso de tu ex-pareja de Pro Dúo cuando se
-- desvinculan, pero deudas_creditos nunca la tuvo — un ex-Dúo podía
-- seguir editando pagos de una deuda compartida para siempre. Se agrega
-- acá y se conecta al mismo trigger de desvinculación más abajo.
alter table public.deudas_creditos add column if not exists congelada boolean not null default false;

create table if not exists public.pagos_deuda (
  id              uuid primary key default gen_random_uuid(),
  deuda_id        uuid not null references public.deudas_creditos(id) on delete cascade,
  monto_total     numeric(14,2) not null check (monto_total > 0),
  monto_interes   numeric(14,2) not null default 0,
  monto_capital   numeric(14,2) not null default 0,
  fecha           date not null default current_date,
  notas           text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_pagos_deuda_deuda on public.pagos_deuda(deuda_id);

-- ─────────────────────────────────────────
-- INGRESOS Y GASTOS FIJOS
-- ─────────────────────────────────────────
create table if not exists public.ingresos_fijos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  nombre        text not null,
  monto         numeric(14,2) not null check (monto > 0),
  dia_mes       int not null check (dia_mes between 1 and 31),
  frecuencia    frecuencia_fija not null default 'mensual',
  categoria_id  uuid references public.categorias(id) on delete set null,
  icono         text not null default 'wallet',
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.gastos_fijos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  nombre        text not null,
  monto         numeric(14,2) not null check (monto > 0),
  dia_mes       int not null check (dia_mes between 1 and 31),
  notif_dias_antes int, -- por-ítem: si no está vacío, avisa este número de días antes del dia_mes (aparte del interruptor maestro en profiles). Vacío = usa el default de 2 días.
  frecuencia    frecuencia_fija not null default 'mensual',
  categoria_id  uuid references public.categorias(id) on delete set null,
  icono         text not null default 'home',
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- create table if not exists no le agrega columnas a una tabla que ya
-- existía — esto es lo que de verdad las aplica en un proyecto que ya
-- tenía la tabla creada de antes (como el tuyo).
alter table public.gastos_fijos add column if not exists notif_dias_antes int;

-- FKs circulares (ahora que las tablas existen) — con drop-si-existe antes,
-- igual que las políticas, para que este archivo se pueda correr las
-- veces que sea sin errores.
alter table public.transacciones drop constraint if exists fk_transacciones_gasto_fijo;
alter table public.transacciones drop constraint if exists fk_transacciones_ingreso_fijo;
alter table public.transacciones
  add constraint fk_transacciones_gasto_fijo    foreign key (gasto_fijo_id)   references public.gastos_fijos(id)   on delete set null,
  add constraint fk_transacciones_ingreso_fijo  foreign key (ingreso_fijo_id) references public.ingresos_fijos(id) on delete set null;

alter table public.deudas_creditos drop constraint if exists fk_deuda_gasto_fijo;
alter table public.deudas_creditos
  add constraint fk_deuda_gasto_fijo foreign key (gasto_fijo_id) references public.gastos_fijos(id) on delete set null;

-- ─────────────────────────────────────────
-- METAS DE AHORRO
-- ─────────────────────────────────────────
create table if not exists public.metas_ahorro (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  nombre            text not null,
  monto_objetivo    numeric(14,2) not null check (monto_objetivo > 0),
  monto_actual      numeric(14,2) not null default 0,
  aporte_mensual    numeric(14,2) not null default 0,
  fecha_limite      date,
  icono             text not null default 'piggy-bank',
  color             text not null default 'lime',
  estado            estado_meta not null default 'activa',
  compartida_con_id uuid references auth.users(id) on delete set null,
  congelada         boolean not null default false,
  created_at        timestamptz not null default now()
);

create table if not exists public.aportes_meta (
  id         uuid primary key default gen_random_uuid(),
  meta_id    uuid not null references public.metas_ahorro(id) on delete cascade,
  monto      numeric(14,2) not null check (monto > 0),
  fecha      date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists idx_aportes_meta_meta on public.aportes_meta(meta_id);

-- ─────────────────────────────────────────
-- PRESUPUESTOS
-- ─────────────────────────────────────────
create table if not exists public.presupuestos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  categoria_id  uuid not null references public.categorias(id) on delete cascade,
  monto_limite  numeric(14,2) not null check (monto_limite > 0),
  mes           int not null check (mes between 1 and 12),
  anio          int not null check (anio between 2000 and 2100),
  created_at    timestamptz not null default now(),
  unique (user_id, categoria_id, mes, anio)
);

-- ─────────────────────────────────────────
-- PRO DÚO
-- ─────────────────────────────────────────
create table if not exists public.pro_duo (
  id              uuid primary key default gen_random_uuid(),
  inviter_id      uuid not null references auth.users(id) on delete cascade,
  invitado_id     uuid references auth.users(id) on delete set null,
  codigo          text not null unique,
  estado          estado_pro_duo not null default 'pendiente',
  created_at      timestamptz not null default now(),
  vinculado_at    timestamptz,
  finalizado_at   timestamptz,
  constraint chk_pro_duo_no_self check (inviter_id <> invitado_id)
);
create unique index if not exists idx_pro_duo_inviter_activo  on public.pro_duo(inviter_id)  where estado in ('pendiente','activo');
create unique index if not exists idx_pro_duo_invitado_activo on public.pro_duo(invitado_id) where estado = 'activo';

-- =====================================================================
-- TRIGGERS CASHFLOW
-- =====================================================================

-- Saldo de cuenta al insertar/editar/borrar transacción
create or replace function public.sync_saldo_cuenta()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  delta numeric;
  v_tipo_origen  text;
  v_tipo_destino text;
begin
  if TG_OP = 'DELETE' then
    if old.tipo = 'transferencia' then
      select tipo into v_tipo_origen  from public.cuentas where id = old.cuenta_id;
      select tipo into v_tipo_destino from public.cuentas where id = old.cuenta_destino_id;
      update public.cuentas set saldo = saldo + (case when v_tipo_origen  = 'tarjeta_credito' then -old.monto else  old.monto end) where id = old.cuenta_id;
      if old.cuenta_destino_id is not null then
        update public.cuentas set saldo = saldo + (case when v_tipo_destino = 'tarjeta_credito' then  old.monto else -old.monto end) where id = old.cuenta_destino_id;
      end if;
    else
      select tipo into v_tipo_origen from public.cuentas where id = old.cuenta_id;
      if v_tipo_origen = 'tarjeta_credito' then
        delta := case when old.tipo = 'ingreso' then old.monto else -(old.monto + old.monto_4x1000) end;
      else
        delta := case when old.tipo = 'ingreso' then -old.monto else  (old.monto + old.monto_4x1000) end;
      end if;
      update public.cuentas set saldo = saldo + delta where id = old.cuenta_id;
    end if;
    return old;

  elsif TG_OP = 'INSERT' then
    if new.tipo = 'transferencia' then
      select tipo into v_tipo_origen  from public.cuentas where id = new.cuenta_id;
      select tipo into v_tipo_destino from public.cuentas where id = new.cuenta_destino_id;
      update public.cuentas set saldo = saldo + (case when v_tipo_origen  = 'tarjeta_credito' then  new.monto else -new.monto end) where id = new.cuenta_id;
      if new.cuenta_destino_id is not null then
        update public.cuentas set saldo = saldo + (case when v_tipo_destino = 'tarjeta_credito' then -new.monto else  new.monto end) where id = new.cuenta_destino_id;
      end if;
    else
      select tipo into v_tipo_origen from public.cuentas where id = new.cuenta_id;
      if v_tipo_origen = 'tarjeta_credito' then
        delta := case when new.tipo = 'ingreso' then -new.monto else  (new.monto + new.monto_4x1000) end;
      else
        delta := case when new.tipo = 'ingreso' then  new.monto else -(new.monto + new.monto_4x1000) end;
      end if;
      update public.cuentas set saldo = saldo + delta where id = new.cuenta_id;
    end if;
    return new;

  elsif TG_OP = 'UPDATE' then
    -- revertir viejo
    if old.tipo = 'transferencia' then
      select tipo into v_tipo_origen  from public.cuentas where id = old.cuenta_id;
      select tipo into v_tipo_destino from public.cuentas where id = old.cuenta_destino_id;
      update public.cuentas set saldo = saldo + (case when v_tipo_origen  = 'tarjeta_credito' then -old.monto else  old.monto end) where id = old.cuenta_id;
      if old.cuenta_destino_id is not null then
        update public.cuentas set saldo = saldo + (case when v_tipo_destino = 'tarjeta_credito' then  old.monto else -old.monto end) where id = old.cuenta_destino_id;
      end if;
    else
      select tipo into v_tipo_origen from public.cuentas where id = old.cuenta_id;
      if v_tipo_origen = 'tarjeta_credito' then
        delta := case when old.tipo = 'ingreso' then old.monto else -(old.monto + old.monto_4x1000) end;
      else
        delta := case when old.tipo = 'ingreso' then -old.monto else  (old.monto + old.monto_4x1000) end;
      end if;
      update public.cuentas set saldo = saldo + delta where id = old.cuenta_id;
    end if;
    -- aplicar nuevo
    if new.tipo = 'transferencia' then
      select tipo into v_tipo_origen  from public.cuentas where id = new.cuenta_id;
      select tipo into v_tipo_destino from public.cuentas where id = new.cuenta_destino_id;
      update public.cuentas set saldo = saldo + (case when v_tipo_origen  = 'tarjeta_credito' then  new.monto else -new.monto end) where id = new.cuenta_id;
      if new.cuenta_destino_id is not null then
        update public.cuentas set saldo = saldo + (case when v_tipo_destino = 'tarjeta_credito' then -new.monto else  new.monto end) where id = new.cuenta_destino_id;
      end if;
    else
      select tipo into v_tipo_origen from public.cuentas where id = new.cuenta_id;
      if v_tipo_origen = 'tarjeta_credito' then
        delta := case when new.tipo = 'ingreso' then -new.monto else  (new.monto + new.monto_4x1000) end;
      else
        delta := case when new.tipo = 'ingreso' then  new.monto else -(new.monto + new.monto_4x1000) end;
      end if;
      update public.cuentas set saldo = saldo + delta where id = new.cuenta_id;
    end if;
    return new;
  end if;
  return null;
end; $$;

drop trigger if exists on_transaccion_change on public.transacciones;
create trigger on_transaccion_change
  after insert or update or delete on public.transacciones
  for each row execute procedure public.sync_saldo_cuenta();

-- Pagos de deuda → capital_pagado + estado
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

-- Aportes a meta → monto_actual + estado
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

-- Pro Dúo: activar/desactivar es_pro_duo y congelar al desvincular
create or replace function public.sync_pro_duo_estado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'activo' and old.estado is distinct from 'activo' then
    update public.profiles set es_pro_duo = true where id = new.invitado_id;
  elsif new.estado = 'finalizado' and old.estado = 'activo' then
    update public.profiles set es_pro_duo = false where id = old.invitado_id;
    update public.cuentas set congelada = true
      where (user_id = old.inviter_id and compartida_con_id = old.invitado_id)
         or (user_id = old.invitado_id and compartida_con_id = old.inviter_id);
    update public.metas_ahorro set congelada = true
      where (user_id = old.inviter_id and compartida_con_id = old.invitado_id)
         or (user_id = old.invitado_id and compartida_con_id = old.inviter_id);
    update public.deudas_creditos set congelada = true
      where (user_id = old.inviter_id and compartida_con_id = old.invitado_id)
         or (user_id = old.invitado_id and compartida_con_id = old.inviter_id);
  end if;
  return new;
end; $$;

drop trigger if exists on_pro_duo_estado_change on public.pro_duo;
create trigger on_pro_duo_estado_change
  after update on public.pro_duo
  for each row execute procedure public.sync_pro_duo_estado();

-- =====================================================================
-- FUNCIONES RPC — Pro Dúo
-- =====================================================================

create or replace function public.crear_codigo_pro_duo()
returns public.pro_duo language plpgsql security definer set search_path = public as $$
declare
  v_es_pro boolean;
  v_codigo text;
  v_row public.pro_duo;
begin
  select es_pro into v_es_pro from public.profiles where id = auth.uid();
  if not coalesce(v_es_pro, false) then raise exception 'Solo usuarios Pro pueden invitar a Pro Dúo'; end if;
  select * into v_row from public.pro_duo where inviter_id = auth.uid() and estado = 'pendiente';
  if found then return v_row; end if;
  if exists (select 1 from public.pro_duo where inviter_id = auth.uid() and estado = 'activo') then raise exception 'Ya tienes a alguien vinculado'; end if;
  loop
    v_codigo := upper(substr(md5(random()::text),1,4)) || '-' || upper(substr(md5(random()::text),1,4));
    exit when not exists (select 1 from public.pro_duo where codigo = v_codigo);
  end loop;
  insert into public.pro_duo(inviter_id, codigo) values (auth.uid(), v_codigo) returning * into v_row;
  return v_row;
end; $$;

create or replace function public.canjear_codigo_pro_duo(p_codigo text)
returns public.pro_duo language plpgsql security definer set search_path = public as $$
declare v_row public.pro_duo;
begin
  select * into v_row from public.pro_duo where codigo = upper(p_codigo) and estado = 'pendiente' for update;
  if not found then raise exception 'Código inválido o ya usado'; end if;
  if v_row.inviter_id = auth.uid() then raise exception 'No puedes canjear tu propio código'; end if;
  if exists (select 1 from public.pro_duo where invitado_id = auth.uid() and estado = 'activo') then raise exception 'Ya tienes un Pro Dúo activo'; end if;
  update public.pro_duo set invitado_id = auth.uid(), estado = 'activo', vinculado_at = now()
    where id = v_row.id returning * into v_row;
  return v_row;
end; $$;

create or replace function public.desvincular_pro_duo(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.pro_duo set estado = 'finalizado', finalizado_at = now()
    where id = p_id and estado = 'activo' and (inviter_id = auth.uid() or invitado_id = auth.uid());
end; $$;

-- =====================================================================
-- ROW LEVEL SECURITY — CashFlow
-- =====================================================================
alter table public.cuentas         enable row level security;
alter table public.categorias      enable row level security;
alter table public.bancos_personalizados enable row level security;
alter table public.transacciones   enable row level security;
alter table public.deudas_creditos enable row level security;
alter table public.pagos_deuda     enable row level security;
alter table public.ingresos_fijos  enable row level security;
alter table public.gastos_fijos    enable row level security;
alter table public.metas_ahorro    enable row level security;
alter table public.aportes_meta    enable row level security;
alter table public.presupuestos    enable row level security;
alter table public.pro_duo         enable row level security;

drop policy if exists "cuentas: crud own" on public.cuentas;
create policy "cuentas: crud own"       on public.cuentas         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "categorias: crud own" on public.categorias;
create policy "categorias: crud own"    on public.categorias       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "bancos_personalizados: crud own" on public.bancos_personalizados;
create policy "bancos_personalizados: crud own" on public.bancos_personalizados for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "transacciones: crud own" on public.transacciones;
create policy "transacciones: crud own" on public.transacciones    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "deudas: crud own" on public.deudas_creditos;
create policy "deudas: crud own"        on public.deudas_creditos  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "ingresos_fijos: crud own" on public.ingresos_fijos;
create policy "ingresos_fijos: crud own" on public.ingresos_fijos  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "gastos_fijos: crud own" on public.gastos_fijos;
create policy "gastos_fijos: crud own"  on public.gastos_fijos     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "metas: crud own" on public.metas_ahorro;
create policy "metas: crud own"         on public.metas_ahorro     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "presupuestos: crud own" on public.presupuestos;
create policy "presupuestos: crud own"  on public.presupuestos      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "pagos_deuda: crud own" on public.pagos_deuda;
create policy "pagos_deuda: crud own" on public.pagos_deuda for all
  using   (exists (select 1 from public.deudas_creditos d where d.id = deuda_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.deudas_creditos d where d.id = deuda_id and d.user_id = auth.uid()));

drop policy if exists "aportes_meta: crud own" on public.aportes_meta;
create policy "aportes_meta: crud own" on public.aportes_meta for all
  using   (exists (select 1 from public.metas_ahorro m where m.id = meta_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.metas_ahorro m where m.id = meta_id and m.user_id = auth.uid()));

drop policy if exists "pro_duo: select own" on public.pro_duo;
create policy "pro_duo: select own" on public.pro_duo for select
  using (auth.uid() = inviter_id or auth.uid() = invitado_id);

-- Compartidos Pro Dúo
drop policy if exists "profiles: select partner" on public.profiles;
create policy "profiles: select partner" on public.profiles for select using (
  exists (select 1 from public.pro_duo pd where pd.estado = 'activo'
    and ((pd.inviter_id = auth.uid() and pd.invitado_id = profiles.id)
      or (pd.invitado_id = auth.uid() and pd.inviter_id = profiles.id)))
);
drop policy if exists "cuentas: select shared" on public.cuentas;
create policy "cuentas: select shared"  on public.cuentas       for select using (auth.uid() = compartida_con_id);
drop policy if exists "cuentas: update shared" on public.cuentas;
create policy "cuentas: update shared"  on public.cuentas       for update using  (auth.uid() = compartida_con_id and congelada = false) with check (auth.uid() = compartida_con_id and congelada = false);
drop policy if exists "metas: select shared" on public.metas_ahorro;
create policy "metas: select shared"    on public.metas_ahorro  for select using  (auth.uid() = compartida_con_id);
drop policy if exists "metas: update shared" on public.metas_ahorro;
create policy "metas: update shared"    on public.metas_ahorro  for update using  (auth.uid() = compartida_con_id and congelada = false) with check (auth.uid() = compartida_con_id and congelada = false);
drop policy if exists "aportes_meta: crud shared" on public.aportes_meta;
create policy "aportes_meta: crud shared" on public.aportes_meta for all
  using   (exists (select 1 from public.metas_ahorro m where m.id = meta_id and m.compartida_con_id = auth.uid() and m.congelada = false))
  with check (exists (select 1 from public.metas_ahorro m where m.id = meta_id and m.compartida_con_id = auth.uid() and m.congelada = false));
drop policy if exists "deudas: select shared" on public.deudas_creditos;
create policy "deudas: select shared"   on public.deudas_creditos for select using (auth.uid() = compartida_con_id);
drop policy if exists "pagos_deuda: crud shared" on public.pagos_deuda;
create policy "pagos_deuda: crud shared" on public.pagos_deuda for all
  -- Igual que "aportes_meta: crud shared" — sin el congelada=false acá,
  -- alguien con quien ya congelaste una deuda compartida (ej. terminaste
  -- el Pro Dúo) podía seguir agregando/editando/borrando pagos de esa
  -- deuda. Encontrado en el sondeo de seguridad, corregido para que se
  -- comporte igual que el resto de lo "compartido".
  using   (exists (select 1 from public.deudas_creditos d where d.id = deuda_id and d.compartida_con_id = auth.uid() and d.congelada = false))
  with check (exists (select 1 from public.deudas_creditos d where d.id = deuda_id and d.compartida_con_id = auth.uid() and d.congelada = false));

-- ---------------------------------------------------------------------
-- PUSH_TOKENS — el "teléfono digital" (token FCM) de cada dispositivo,
-- para mandar notificaciones push aunque la app esté cerrada. Un usuario
-- puede tener más de uno (varios dispositivos).
-- ---------------------------------------------------------------------

create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null,
  platform    text not null default 'android',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, token)
);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens: crud own" on public.push_tokens;
create policy "push_tokens: crud own" on public.push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Se actualiza updated_at solo cada vez que el mismo token se vuelve a
-- registrar (pasa cada vez que abres la app) — así el "cerebro" que revisa
-- y manda avisos puede ignorar tokens viejos que ya no se usan hace meses.
create or replace function public.touch_push_token()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists on_push_token_upsert on public.push_tokens;
create trigger on_push_token_upsert before update on public.push_tokens
  for each row execute procedure public.touch_push_token();

-- ---------------------------------------------------------------------
-- PUSH_AVISOS_ENVIADOS — para que la función de push (enviar-push) no
-- mande el mismo aviso todos los días si sigue siendo cierto (ej. sigues
-- pasado del presupuesto todo el mes). "clave" identifica de qué se
-- trata el aviso — ej. "presupuesto:{id}:{mes}:{anio}" o "meta:{id}".
-- ---------------------------------------------------------------------

create table if not exists public.push_avisos_enviados (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  clave       text not null,
  enviado_en  timestamptz not null default now(),
  unique (user_id, clave)
);

alter table public.push_avisos_enviados enable row level security;

-- Solo la Edge Function (con la service role key, que se salta RLS) lee
-- y escribe aquí — no hace falta política para el usuario normal, pero
-- se deja RLS activo por si algún día se quiere exponer al cliente.
drop policy if exists "push_avisos_enviados: select own" on public.push_avisos_enviados;
create policy "push_avisos_enviados: select own" on public.push_avisos_enviados for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- CRON DE PUSH — hace que la Edge Function "enviar-push" corra sola una
-- vez al día (revisa presupuestos excedidos, metas al 90%+, y gastos
-- hormiga detectados — manda el push real). Requiere que la función ya
-- esté desplegada primero — ver supabase/README_PUSH.md para el paso a
-- paso completo por terminal.
--
-- Project ref y anon key ya están puestos (vnlblvrsdypbxgendchl) — no
-- hace falta reemplazar nada, corre tal cual.
--
-- IMPORTANTE — encontrado en el sondeo de seguridad: "enviar-push" y
-- "actualizar-tasas" se despliegan con --no-verify-jwt (necesario porque
-- este cron las llama con la anon key, no con un JWT de usuario real).
-- Eso significa que, tal como estaban, CUALQUIERA con la URL podía
-- llamarlas sin ninguna credencial. Los headers de abajo ahora incluyen
-- 'x-cron-secret', que las funciones revisan antes de hacer nada — pero
-- para que esto funcione TIENES que setear ese mismo valor como secret
-- de la función, una sola vez, antes de desplegar:
--
--   npx supabase secrets set CRON_SECRET=1d11bb6c30eb61fd2344b070be87ca7c116228eb698169aa0e6ed43c330f3d45
--   npx supabase functions deploy enviar-push --no-verify-jwt
--   npx supabase functions deploy actualizar-tasas --no-verify-jwt
--
-- (el --no-verify-jwt sigue haciendo falta por el mismo motivo de
-- siempre — la anon key del cron no pasa esa revisión de Supabase — pero
-- ahora ya no importa, porque el 401 de adentro de la función es el que
-- de verdad protege esto.)
--
-- Este valor es distinto a la anon key de arriba: la anon key está
-- pensada para ser pública (va también en la app), pero este
-- CRON_SECRET NO — no lo compartas ni lo subas a ningún lado público.
-- ---------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('enviar-push-diario') where exists (select 1 from cron.job where jobname = 'enviar-push-diario');

-- '0 14 * * *' = todos los días a las 14:00 UTC = 9:00 AM hora Colombia.
select cron.schedule(
  'enviar-push-diario',
  '0 14 * * *',
  $$
  select net.http_post(
    url := 'https://vnlblvrsdypbxgendchl.supabase.co/functions/v1/enviar-push',
    headers := jsonb_build_object('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubGJsdnJzZHlwYnhnZW5kY2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1ODMxODMsImV4cCI6MjEwMDE1OTE4M30.qg_7yVBYXd88tO6Ll_qcY7Web8TgqaDa6-Um9xra2I4', 'Content-Type', 'application/json', 'x-cron-secret', '1d11bb6c30eb61fd2344b070be87ca7c116228eb698169aa0e6ed43c330f3d45')
  );
  $$
);

-- Segundo disparo del mismo día, en la NOCHE — solo existe para la
-- sección 6 de enviar-push/index.ts (recordatorio de anotar movimientos
-- si no hiciste nada hoy). Esa sección se autoprotege revisando la hora
-- de Colombia adentro de la función, así que aunque este cron llame a
-- la MISMA función que el de la mañana, las demás secciones (presupuestos,
-- metas, etc.) no se disparan dos veces gracias a push_avisos_enviados.
-- '0 1 * * *' = todos los días a la 1:00 AM UTC = 8:00 PM hora Colombia
-- del día anterior (Colombia no tiene horario de verano, UTC-5 fijo).
select cron.unschedule('enviar-push-nocturno') where exists (select 1 from cron.job where jobname = 'enviar-push-nocturno');

select cron.schedule(
  'enviar-push-nocturno',
  '0 1 * * *',
  $$
  select net.http_post(
    url := 'https://vnlblvrsdypbxgendchl.supabase.co/functions/v1/enviar-push',
    headers := jsonb_build_object('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubGJsdnJzZHlwYnhnZW5kY2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1ODMxODMsImV4cCI6MjEwMDE1OTE4M30.qg_7yVBYXd88tO6Ll_qcY7Web8TgqaDa6-Um9xra2I4', 'Content-Type', 'application/json', 'x-cron-secret', '1d11bb6c30eb61fd2344b070be87ca7c116228eb698169aa0e6ed43c330f3d45')
  );
  $$
);

-- Sin esto, Supabase a veces tarda un rato en "enterarse" de columnas o
-- tablas nuevas — con esto se entera al toque, apenas termina de correr
-- este archivo, sin que tengas que acordarte de hacerlo aparte.
-- ---------------------------------------------------------------------
-- TASAS_CAMBIO — cuánto vale 1 unidad de cada moneda en pesos
-- colombianos. La actualiza sola una vez al día la Edge Function
-- "actualizar-tasas" (ver el cron más abajo) — la app nunca le pega
-- directo a la API externa, siempre lee de aquí.
-- ---------------------------------------------------------------------

-- Se rediseñó de "una fila por moneda" a "una fila por moneda y día" —
-- necesario para poder dibujar la tendencia (mini gráfica) en Inicio, no
-- solo mostrar el número de hoy. ¡OJO! Este archivo ya NO lleva el
-- "drop table" que tuvo en su momento — cuando se rediseñó la tabla
-- solo tenía datos de prueba, pero ahora acumula semanas de historial
-- REAL del cron diario (actualizar-tasas-diario). Volver a correr este
-- archivo completo (como se hace siempre con los demás) ya no borra
-- ese historial — antes sí lo hacía, y así fue como se perdió una vez.
create table if not exists public.tasas_cambio (
  moneda        text not null,
  fecha         date not null,
  tasa_cop      numeric not null,
  actualizado_en timestamptz not null default now(),
  primary key (moneda, fecha)
);

alter table public.tasas_cambio enable row level security;

-- Cualquier usuario logueado puede leer las tasas — no son datos
-- privados de nadie, son un dato público del mercado.
drop policy if exists "tasas_cambio: select all" on public.tasas_cambio;
create policy "tasas_cambio: select all" on public.tasas_cambio for select using (auth.role() = 'authenticated');

-- Semilla inicial — para que la app tenga algo que mostrar desde el
-- primer minuto, antes de que corra el cron por primera vez. Se
-- reemplaza sola apenas la Edge Function corra por primera vez.
insert into public.tasas_cambio (moneda, fecha, tasa_cop) values
  ('COP', current_date, 1),
  ('USD', current_date, 4000),
  ('EUR', current_date, 4300),
  ('MXN', current_date, 220)
on conflict (moneda, fecha) do nothing;

-- ---------------------------------------------------------------------
-- ─────────────────────────────────────────
-- MOVIMIENTOS FRECUENTES — plantillas de un toque para movimientos que
-- se repiten siempre igual (ej. "Parqueadero CC Monterrey" siempre
-- $7.200). Se guardan al confirmar un movimiento normal (toggle
-- opcional), y aparecen como chips justo debajo del teclado numérico al
-- crear un movimiento nuevo — tocar uno llena monto, categoría, cuenta
-- y descripción de una sola vez, saltando directo a la confirmación.
-- ─────────────────────────────────────────
create table if not exists public.movimientos_frecuentes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  nombre         text not null,
  tipo           text not null check (tipo in ('ingreso','egreso')),
  monto          numeric(14,2) not null check (monto > 0),
  categoria_id   uuid references public.categorias(id) on delete set null,
  cuenta_id      uuid references public.cuentas(id) on delete set null,
  -- Si el frecuente viene de "Pago de un gasto fijo" / "Ingreso fijo"
  -- (ej. "Parqueaderos"), acá queda el vínculo — sin esto, tocar el chip
  -- no tenía cómo saber que ese frecuente correspondía a un gasto fijo
  -- específico, y el toque rápido caía siempre al flujo manual.
  gasto_fijo_id   uuid references public.gastos_fijos(id) on delete set null,
  ingreso_fijo_id uuid references public.ingresos_fijos(id) on delete set null,
  descripcion    text,
  lugar          text,
  usos           int not null default 1,
  ultimo_uso     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
alter table public.movimientos_frecuentes add column if not exists gasto_fijo_id uuid references public.gastos_fijos(id) on delete set null;
alter table public.movimientos_frecuentes add column if not exists ingreso_fijo_id uuid references public.ingresos_fijos(id) on delete set null;
alter table public.movimientos_frecuentes enable row level security;
drop policy if exists "movimientos_frecuentes: crud own" on public.movimientos_frecuentes;
create policy "movimientos_frecuentes: crud own" on public.movimientos_frecuentes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- CRON DE TASAS DE CAMBIO — corre una vez al día, trae USD/EUR/MXN en
-- pesos colombianos de una API pública gratis (fawazahmed0/currency-api,
-- sin API key, sin límite de peticiones) y actualiza tasas_cambio.
-- Requiere que la función "actualizar-tasas" ya esté desplegada
-- (mismo procedimiento que enviar-push — ver supabase/README_PUSH.md,
-- el despliegue es igual de simple, solo cambia el nombre).
-- ---------------------------------------------------------------------

select cron.unschedule('actualizar-tasas-diario') where exists (select 1 from cron.job where jobname = 'actualizar-tasas-diario');

-- '0 10 * * *' = todos los días a las 10:00 UTC = 5:00 AM hora Colombia
-- (antes de que la mayoría abra la app en la mañana).
select cron.schedule(
  'actualizar-tasas-diario',
  '0 10 * * *',
  $$
  select net.http_post(
    url := 'https://vnlblvrsdypbxgendchl.supabase.co/functions/v1/actualizar-tasas',
    headers := jsonb_build_object('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubGJsdnJzZHlwYnhnZW5kY2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1ODMxODMsImV4cCI6MjEwMDE1OTE4M30.qg_7yVBYXd88tO6Ll_qcY7Web8TgqaDa6-Um9xra2I4', 'Content-Type', 'application/json', 'x-cron-secret', '1d11bb6c30eb61fd2344b070be87ca7c116228eb698169aa0e6ed43c330f3d45')
  );
  $$
);

notify pgrst, 'reload schema';

-- =====================================================================
-- FIN 02_cashflow_schema.sql
-- =====================================================================
