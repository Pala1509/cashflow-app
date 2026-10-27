-- Migración: campo diseno_tarjeta — qué variante visual eligió el usuario
-- para su tarjeta (clásico / oscuro / claro), además del banco.
-- Pégala en el SQL Editor de Supabase y corre una vez.

alter table public.cuentas add column if not exists diseno_tarjeta text default 'clasico';
