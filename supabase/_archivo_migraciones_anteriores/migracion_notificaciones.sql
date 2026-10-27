-- Migración: preferencias de notificaciones reales (antes eran solo
-- interruptores decorativos que no guardaban nada ni hacían nada). Pégala
-- completa en el SQL Editor de Supabase y ejecútala una vez.

alter table public.profiles add column if not exists notif_gastos_fijos boolean not null default true;
alter table public.profiles add column if not exists notif_presupuestos boolean not null default true;
alter table public.profiles add column if not exists notif_metas boolean not null default true;
alter table public.profiles add column if not exists notif_deudas boolean not null default true;
alter table public.profiles add column if not exists notif_deudas_dias_antes int not null default 3;
