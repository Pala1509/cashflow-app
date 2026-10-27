-- Migración: Transferencias entre cuentas propias + vincular egresos a
-- gastos fijos ("¿ya pagué el arriendo este mes?"). Pégala completa en el
-- SQL Editor de Supabase y ejecútala una vez.
--
-- IMPORTANTE: si al correrla te sale un error tipo "unsafe use of new value
-- of enum type", significa que Postgres no deja usar un valor de enum
-- recién creado en la misma ejecución. Solución: corre PRIMERO nada más
-- esta línea sola:
--   alter type tipo_transaccion add value if not exists 'transferencia';
-- Dale "Run" a esa línea sola, y LUEGO pega y corre el resto de este
-- archivo completo (desde el punto 2 en adelante) en una segunda ejecución.

-- 1) Nuevo tipo de movimiento: transferencia (mover plata entre tus propias
-- cuentas — no cuenta como ingreso ni egreso en tus reportes).
alter type tipo_transaccion add value if not exists 'transferencia';

-- 2) Columna nueva: a qué cuenta llega la plata (solo se usa en transferencias).
alter table public.transacciones add column if not exists cuenta_destino_id uuid references public.cuentas(id) on delete restrict;

-- 3) Columna nueva: vincular un egreso a un gasto fijo específico, para
-- saber si ya se pagó "el arriendo de este mes" o no.
alter table public.transacciones add column if not exists gasto_fijo_id uuid references public.gastos_fijos(id) on delete set null;

-- 4) Reemplaza el trigger de saldo para que también sepa mover dinero entre
-- dos cuentas en una transferencia (resta de una, suma a la otra).
create or replace function public.sync_saldo_cuenta()
returns trigger language plpgsql security definer set search_path = public as $$
declare delta numeric;
begin
  if TG_OP = 'DELETE' then
    if old.tipo = 'transferencia' then
      update public.cuentas set saldo = saldo + old.monto where id = old.cuenta_id;
      update public.cuentas set saldo = saldo - old.monto where id = old.cuenta_destino_id;
    else
      delta := case when old.tipo = 'ingreso' then -old.monto else (old.monto + old.monto_4x1000) end;
      update public.cuentas set saldo = saldo + delta where id = old.cuenta_id;
    end if;
    return old;

  elsif TG_OP = 'INSERT' then
    if new.tipo = 'transferencia' then
      update public.cuentas set saldo = saldo - new.monto where id = new.cuenta_id;
      update public.cuentas set saldo = saldo + new.monto where id = new.cuenta_destino_id;
    else
      delta := case when new.tipo = 'ingreso' then new.monto else -(new.monto + new.monto_4x1000) end;
      update public.cuentas set saldo = saldo + delta where id = new.cuenta_id;
    end if;
    return new;

  elsif TG_OP = 'UPDATE' then
    -- revertir el efecto viejo
    if old.tipo = 'transferencia' then
      update public.cuentas set saldo = saldo + old.monto where id = old.cuenta_id;
      update public.cuentas set saldo = saldo - old.monto where id = old.cuenta_destino_id;
    else
      delta := case when old.tipo = 'ingreso' then -old.monto else (old.monto + old.monto_4x1000) end;
      update public.cuentas set saldo = saldo + delta where id = old.cuenta_id;
    end if;
    -- aplicar el nuevo
    if new.tipo = 'transferencia' then
      update public.cuentas set saldo = saldo - new.monto where id = new.cuenta_id;
      update public.cuentas set saldo = saldo + new.monto where id = new.cuenta_destino_id;
    else
      delta := case when new.tipo = 'ingreso' then new.monto else -(new.monto + new.monto_4x1000) end;
      update public.cuentas set saldo = saldo + delta where id = new.cuenta_id;
    end if;
    return new;
  end if;
  return null;
end; $$;
