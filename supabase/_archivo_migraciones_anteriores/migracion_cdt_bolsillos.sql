-- Migración: bolsillos remunerados + CDT (Pro).
--
-- Bolsillo remunerado = una cuenta de Ahorros normal (cuenta_bancaria o
-- monedero) con una tasa_ea > 0 — la app le calcula la proyección de
-- interés. No es un tipo nuevo, es un campo nuevo sobre lo que ya existe.
--
-- CDT sí es un tipo de cuenta nuevo porque tiene reglas propias: capital
-- fijo, plazo, fecha de apertura/vencimiento — nada de eso aplica a una
-- cuenta normal.
--
-- Pégala en el SQL Editor de Supabase y corre una vez.

alter type tipo_cuenta add value if not exists 'cdt';

alter table public.cuentas add column if not exists tasa_ea numeric not null default 0;
alter table public.cuentas add column if not exists fecha_apertura date;
alter table public.cuentas add column if not exists plazo_dias int;
