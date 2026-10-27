-- Migración tanda 3. Pégala completa en el SQL Editor de Supabase y ejecútala una vez.

-- #10: marcar una cuenta como "dedicada a ahorros" (caja fuerte, cuenta de ahorro aparte, etc.)
alter table public.cuentas add column if not exists es_ahorro boolean not null default false;

-- #14/#15: frecuencia (en vez de escribir un día a mano) y categoría en ingresos/gastos fijos
do $$ begin
  create type frecuencia_fija as enum ('quincenal','mensual','trimestral','semestral','anual');
exception when duplicate_object then null; end $$;

alter table public.ingresos_fijos add column if not exists frecuencia frecuencia_fija not null default 'mensual';
alter table public.ingresos_fijos add column if not exists categoria_id uuid references public.categorias(id) on delete set null;

alter table public.gastos_fijos add column if not exists frecuencia frecuencia_fija not null default 'mensual';
alter table public.gastos_fijos add column if not exists categoria_id uuid references public.categorias(id) on delete set null;
