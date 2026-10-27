-- Migración: datos de préstamos bancarios (plazo y cuota mensual) + refuerzo
-- del trigger que descuenta capital al registrar un pago (por si tu
-- Supabase quedó sin él de una tanda vieja). Pégala completa y ejecútala.

-- 1) Campos nuevos, solo se usan en préstamos bancarios/hipotecarios/rotativos.
alter table public.deudas_creditos add column if not exists plazo_meses int;
alter table public.deudas_creditos add column if not exists cuota_mensual numeric(14,2);

-- 2) Reafirma el trigger que hace que "capital_pagado" suba de verdad cada
-- vez que registras un pago (y baje si borras uno) — si esto faltaba, tus
-- deudas nunca bajaban sin importar cuánto pagaras.
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
