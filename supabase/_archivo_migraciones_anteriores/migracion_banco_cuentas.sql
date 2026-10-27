-- Migración: campo "banco" en cuentas — para cuentas débito y tarjetas de
-- crédito, donde ahora se elige el banco de una lista (Colombia por ahora)
-- en vez de solo un color libre. El color se sigue guardando (se deriva
-- automático del banco elegido), así que nada de lo que ya existe se rompe.
--
-- Pégala en el SQL Editor de Supabase y corre una vez.

alter table public.cuentas add column if not exists banco text;
