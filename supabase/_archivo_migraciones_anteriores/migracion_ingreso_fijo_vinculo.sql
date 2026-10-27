-- Migración: igual que gasto_fijo_id, pero para ingresos — así se puede
-- marcar "ya me pagaron el sueldo de esta quincena" y la barra de
-- progreso de Ingresos fijos en Balance sabe qué tan cerca estás.
alter table public.transacciones add column if not exists ingreso_fijo_id uuid references public.ingresos_fijos(id) on delete set null;
