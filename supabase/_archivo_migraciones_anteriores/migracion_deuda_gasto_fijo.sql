-- Migración: vincular una deuda a un gasto fijo — así cada pago que
-- registres para esa deuda también cuenta como "ya pagué esto este
-- periodo" en Balance. Pégala completa y ejecútala.

alter table public.deudas_creditos add column if not exists gasto_fijo_id uuid references public.gastos_fijos(id) on delete set null;
