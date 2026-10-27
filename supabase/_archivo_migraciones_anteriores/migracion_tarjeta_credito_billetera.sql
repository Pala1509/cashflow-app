-- Migración: las tarjetas de crédito ahora se pueden elegir como billetera
-- al registrar un movimiento. La diferencia clave: en una cuenta normal
-- (efectivo/débito), un egreso RESTA saldo. En una tarjeta de crédito, un
-- egreso SUMA a lo que debes (el saldo ahí representa "usado", no "tienes").
-- Pégala completa en el SQL Editor de Supabase y ejecútala una vez.

create or replace function public.sync_saldo_cuenta()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  delta numeric;
  v_tipo_origen text;
  v_tipo_destino text;
begin
  if TG_OP = 'DELETE' then
    if old.tipo = 'transferencia' then
      select tipo into v_tipo_origen from public.cuentas where id = old.cuenta_id;
      select tipo into v_tipo_destino from public.cuentas where id = old.cuenta_destino_id;
      update public.cuentas set saldo = saldo + (case when v_tipo_origen = 'tarjeta_credito' then -old.monto else old.monto end) where id = old.cuenta_id;
      if old.cuenta_destino_id is not null then
        update public.cuentas set saldo = saldo + (case when v_tipo_destino = 'tarjeta_credito' then old.monto else -old.monto end) where id = old.cuenta_destino_id;
      end if;
    else
      select tipo into v_tipo_origen from public.cuentas where id = old.cuenta_id;
      if v_tipo_origen = 'tarjeta_credito' then
        delta := case when old.tipo = 'ingreso' then old.monto else -(old.monto + old.monto_4x1000) end;
      else
        delta := case when old.tipo = 'ingreso' then -old.monto else (old.monto + old.monto_4x1000) end;
      end if;
      update public.cuentas set saldo = saldo + delta where id = old.cuenta_id;
    end if;
    return old;

  elsif TG_OP = 'INSERT' then
    if new.tipo = 'transferencia' then
      select tipo into v_tipo_origen from public.cuentas where id = new.cuenta_id;
      select tipo into v_tipo_destino from public.cuentas where id = new.cuenta_destino_id;
      update public.cuentas set saldo = saldo + (case when v_tipo_origen = 'tarjeta_credito' then new.monto else -new.monto end) where id = new.cuenta_id;
      if new.cuenta_destino_id is not null then
        update public.cuentas set saldo = saldo + (case when v_tipo_destino = 'tarjeta_credito' then -new.monto else new.monto end) where id = new.cuenta_destino_id;
      end if;
    else
      select tipo into v_tipo_origen from public.cuentas where id = new.cuenta_id;
      if v_tipo_origen = 'tarjeta_credito' then
        delta := case when new.tipo = 'ingreso' then -new.monto else (new.monto + new.monto_4x1000) end;
      else
        delta := case when new.tipo = 'ingreso' then new.monto else -(new.monto + new.monto_4x1000) end;
      end if;
      update public.cuentas set saldo = saldo + delta where id = new.cuenta_id;
    end if;
    return new;

  elsif TG_OP = 'UPDATE' then
    -- revertir el efecto viejo
    if old.tipo = 'transferencia' then
      select tipo into v_tipo_origen from public.cuentas where id = old.cuenta_id;
      select tipo into v_tipo_destino from public.cuentas where id = old.cuenta_destino_id;
      update public.cuentas set saldo = saldo + (case when v_tipo_origen = 'tarjeta_credito' then -old.monto else old.monto end) where id = old.cuenta_id;
      if old.cuenta_destino_id is not null then
        update public.cuentas set saldo = saldo + (case when v_tipo_destino = 'tarjeta_credito' then old.monto else -old.monto end) where id = old.cuenta_destino_id;
      end if;
    else
      select tipo into v_tipo_origen from public.cuentas where id = old.cuenta_id;
      if v_tipo_origen = 'tarjeta_credito' then
        delta := case when old.tipo = 'ingreso' then old.monto else -(old.monto + old.monto_4x1000) end;
      else
        delta := case when old.tipo = 'ingreso' then -old.monto else (old.monto + old.monto_4x1000) end;
      end if;
      update public.cuentas set saldo = saldo + delta where id = old.cuenta_id;
    end if;
    -- aplicar el nuevo
    if new.tipo = 'transferencia' then
      select tipo into v_tipo_origen from public.cuentas where id = new.cuenta_id;
      select tipo into v_tipo_destino from public.cuentas where id = new.cuenta_destino_id;
      update public.cuentas set saldo = saldo + (case when v_tipo_origen = 'tarjeta_credito' then new.monto else -new.monto end) where id = new.cuenta_id;
      if new.cuenta_destino_id is not null then
        update public.cuentas set saldo = saldo + (case when v_tipo_destino = 'tarjeta_credito' then -new.monto else new.monto end) where id = new.cuenta_destino_id;
      end if;
    else
      select tipo into v_tipo_origen from public.cuentas where id = new.cuenta_id;
      if v_tipo_origen = 'tarjeta_credito' then
        delta := case when new.tipo = 'ingreso' then -new.monto else (new.monto + new.monto_4x1000) end;
      else
        delta := case when new.tipo = 'ingreso' then new.monto else -(new.monto + new.monto_4x1000) end;
      end if;
      update public.cuentas set saldo = saldo + delta where id = new.cuenta_id;
    end if;
    return new;
  end if;
  return null;
end; $$;
