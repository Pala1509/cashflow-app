-- Migración: CashFlow Pro Dúo — regalar Pro a tu pareja + cuentas/metas
-- compartidas. Pégala completa en el SQL Editor de Supabase y ejecútala
-- una vez.
--
-- Qué agrega:
-- 1) Tabla pro_duo: el vínculo entre quien invita y quien se une, con
--    código de invitación. Máximo 1 persona vinculada a la vez (se
--    fuerza con índices únicos, no solo en la app).
-- 2) profiles.es_pro_duo: Pro otorgado por estar vinculado — separado de
--    profiles.es_pro (el que paga de verdad), para que desvincularse
--    nunca le quite el Pro a quien sí lo paga.
-- 3) cuentas / metas_ahorro: columnas compartida_con_id + congelada.
-- 4) deudas_creditos: columna compartida_con_id (las deudas compartidas
--    NUNCA se congelan — la plata se sigue debiendo exista o no el vínculo).
-- 5) RLS para que la pareja vinculada pueda ver (y en cuentas/metas,
--    editar mientras no esté congelada) lo que se comparte explícitamente.
-- 6) Funciones RPC: crear_codigo_pro_duo(), canjear_codigo_pro_duo(codigo),
--    desvincular_pro_duo(id) — la app las llama con supabase.rpc(...).

-- ---------------------------------------------------------------------
-- 1) TABLA pro_duo
-- ---------------------------------------------------------------------
do $$ begin create type estado_pro_duo as enum ('pendiente','activo','finalizado'); exception when duplicate_object then null; end $$;

create table if not exists public.pro_duo (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users (id) on delete cascade,
  invitado_id uuid references auth.users (id) on delete set null,
  codigo text not null unique,
  estado estado_pro_duo not null default 'pendiente',
  created_at timestamptz not null default now(),
  vinculado_at timestamptz,
  finalizado_at timestamptz,
  constraint chk_pro_duo_no_self check (inviter_id <> invitado_id)
);

-- Un mismo inviter no puede tener dos vínculos pendientes/activos a la vez,
-- y un mismo invitado no puede estar activo en dos vínculos a la vez.
-- Esto es lo que garantiza "solo puede ser una persona" a nivel de datos,
-- no solo en la UI.
create unique index if not exists idx_pro_duo_inviter_activo on public.pro_duo (inviter_id) where estado in ('pendiente','activo');
create unique index if not exists idx_pro_duo_invitado_activo on public.pro_duo (invitado_id) where estado = 'activo';

-- ---------------------------------------------------------------------
-- 2) Pro otorgado por Dúo (independiente del es_pro real)
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists es_pro_duo boolean not null default false;

-- ---------------------------------------------------------------------
-- 3) Cuentas y metas: compartir + congelar
-- ---------------------------------------------------------------------
alter table public.cuentas add column if not exists compartida_con_id uuid references auth.users (id) on delete set null;
alter table public.cuentas add column if not exists congelada boolean not null default false;

alter table public.metas_ahorro add column if not exists compartida_con_id uuid references auth.users (id) on delete set null;
alter table public.metas_ahorro add column if not exists congelada boolean not null default false;

-- ---------------------------------------------------------------------
-- 4) Deudas/créditos: solo visibilidad compartida, nunca se congelan
-- ---------------------------------------------------------------------
alter table public.deudas_creditos add column if not exists compartida_con_id uuid references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------
-- 5) Trigger: al activar el vínculo, prender es_pro_duo del invitado.
-- Al finalizar, apagarlo y congelar lo compartido (cuentas y metas
-- únicamente — las deudas compartidas se quedan tal cual).
-- ---------------------------------------------------------------------
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
  end if;
  return new;
end; $$;
drop trigger if exists on_pro_duo_estado_change on public.pro_duo;
create trigger on_pro_duo_estado_change after update on public.pro_duo
  for each row execute procedure public.sync_pro_duo_estado();

-- ---------------------------------------------------------------------
-- 6) Funciones RPC
-- ---------------------------------------------------------------------

-- Genera (o reutiliza si ya hay uno sin canjear) el código de invitación
-- del usuario actual. Solo usuarios Pro de verdad (es_pro) pueden invitar
-- — el Pro otorgado por Dúo no permite re-invitar a alguien más.
create or replace function public.crear_codigo_pro_duo()
returns public.pro_duo
language plpgsql security definer set search_path = public as $$
declare
  v_es_pro boolean;
  v_codigo text;
  v_row public.pro_duo;
begin
  select es_pro into v_es_pro from public.profiles where id = auth.uid();
  if not coalesce(v_es_pro, false) then
    raise exception 'Solo usuarios Pro pueden invitar a Pro Dúo';
  end if;

  select * into v_row from public.pro_duo where inviter_id = auth.uid() and estado = 'pendiente';
  if found then
    return v_row;
  end if;

  if exists (select 1 from public.pro_duo where inviter_id = auth.uid() and estado = 'activo') then
    raise exception 'Ya tienes a alguien vinculado en Pro Dúo';
  end if;

  loop
    v_codigo := upper(substr(md5(random()::text), 1, 4)) || '-' || upper(substr(md5(random()::text), 1, 4));
    exit when not exists (select 1 from public.pro_duo where codigo = v_codigo);
  end loop;

  insert into public.pro_duo (inviter_id, codigo) values (auth.uid(), v_codigo) returning * into v_row;
  return v_row;
end; $$;

-- Canjea un código: valida, evita auto-canje y evita que alguien ya
-- vinculado se cuele a otro vínculo.
create or replace function public.canjear_codigo_pro_duo(p_codigo text)
returns public.pro_duo
language plpgsql security definer set search_path = public as $$
declare v_row public.pro_duo;
begin
  select * into v_row from public.pro_duo where codigo = upper(p_codigo) and estado = 'pendiente' for update;
  if not found then
    raise exception 'Código inválido o ya usado';
  end if;
  if v_row.inviter_id = auth.uid() then
    raise exception 'No puedes canjear tu propio código';
  end if;
  if exists (select 1 from public.pro_duo where invitado_id = auth.uid() and estado = 'activo') then
    raise exception 'Ya tienes un Pro Dúo activo';
  end if;

  update public.pro_duo
  set invitado_id = auth.uid(), estado = 'activo', vinculado_at = now()
  where id = v_row.id
  returning * into v_row;

  return v_row;
end; $$;

-- Desvincula (cualquiera de los dos puede hacerlo).
create or replace function public.desvincular_pro_duo(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.pro_duo set estado = 'finalizado', finalizado_at = now()
  where id = p_id and estado = 'activo' and (inviter_id = auth.uid() or invitado_id = auth.uid());
end; $$;

-- ---------------------------------------------------------------------
-- 7) ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.pro_duo enable row level security;
create policy "pro_duo: select own" on public.pro_duo for select using (auth.uid() = inviter_id or auth.uid() = invitado_id);
-- Insert/update reales pasan por las funciones RPC (security definer) de
-- arriba, no directo a la tabla — por eso no hace falta policy de insert.

-- La pareja vinculada puede ver el nombre/avatar del otro (para mostrar
-- "vinculado con Mafe"). Antes solo podías verte a ti mismo.
create policy "profiles: select partner" on public.profiles for select using (
  exists (
    select 1 from public.pro_duo pd
    where pd.estado = 'activo'
      and ((pd.inviter_id = auth.uid() and pd.invitado_id = profiles.id)
        or (pd.invitado_id = auth.uid() and pd.inviter_id = profiles.id))
  )
);

-- Cuentas compartidas: se pueden ver siempre; se pueden editar mientras
-- no estén congeladas (se congelan solas al desvincular, ver trigger arriba).
create policy "cuentas: select shared" on public.cuentas for select using (auth.uid() = compartida_con_id);
create policy "cuentas: update shared" on public.cuentas for update
  using (auth.uid() = compartida_con_id and congelada = false)
  with check (auth.uid() = compartida_con_id and congelada = false);

-- Metas compartidas: mismo criterio.
create policy "metas: select shared" on public.metas_ahorro for select using (auth.uid() = compartida_con_id);
create policy "metas: update shared" on public.metas_ahorro for update
  using (auth.uid() = compartida_con_id and congelada = false)
  with check (auth.uid() = compartida_con_id and congelada = false);
create policy "aportes_meta: crud shared" on public.aportes_meta for all
  using (exists (select 1 from public.metas_ahorro m where m.id = meta_id and m.compartida_con_id = auth.uid() and m.congelada = false))
  with check (exists (select 1 from public.metas_ahorro m where m.id = meta_id and m.compartida_con_id = auth.uid() and m.congelada = false));

-- Deudas/créditos compartidos: se ven y se pueden registrar pagos siempre
-- (nunca se congelan, la plata se sigue debiendo).
create policy "deudas: select shared" on public.deudas_creditos for select using (auth.uid() = compartida_con_id);
create policy "pagos_deuda: crud shared" on public.pagos_deuda for all
  using (exists (select 1 from public.deudas_creditos d where d.id = deuda_id and d.compartida_con_id = auth.uid()))
  with check (exists (select 1 from public.deudas_creditos d where d.id = deuda_id and d.compartida_con_id = auth.uid()));

-- =====================================================================
-- FIN — siguiente paso es la app: pantallas de invitar/canjear (ya
-- bocetadas) llamando a estas 3 funciones RPC, y un selector de
-- "compartir con Mafe" al crear/editar una cuenta o meta.
-- =====================================================================
