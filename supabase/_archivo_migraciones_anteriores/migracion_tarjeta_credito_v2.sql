-- Migración: Tarjetas de crédito con cuota de manejo, corte y % interés,
-- + nuevo tipo de cuenta "Monedero" (para Ahorros).
-- Pégala en el SQL Editor de Supabase y corre una vez.

alter type tipo_cuenta add value if not exists 'monedero';

alter table public.cuentas add column if not exists cuota_manejo numeric not null default 0;
alter table public.cuentas add column if not exists tasa_interes numeric not null default 0; -- % mensual
alter table public.cuentas add column if not exists dia_corte smallint;   -- día del mes (1-31) en que corta el estado de cuenta
alter table public.cuentas add column if not exists dia_pago smallint;    -- día del mes (1-31) límite de pago

alter table public.cuentas add constraint chk_dia_corte check (dia_corte is null or (dia_corte between 1 and 31));
alter table public.cuentas add constraint chk_dia_pago check (dia_pago is null or (dia_pago between 1 and 31));
