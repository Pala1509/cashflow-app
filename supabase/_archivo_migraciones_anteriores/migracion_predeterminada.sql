-- Migración: agregar 'predeterminada' a categorias en un proyecto que ya corrió schema_zafra.sql
-- Pégala en el SQL Editor de Supabase y ejecútala una sola vez.

alter table public.categorias
  add column if not exists predeterminada boolean not null default false;

-- Opcional: marca tus categorías actuales que coincidan con los nombres de fábrica
-- como predeterminadas (así quedan protegidas de borrado). "Ventas / DJ" queda
-- afuera a propósito para que la puedas eliminar y crear "Freelance / Ventas" en su lugar.
update public.categorias
set predeterminada = true
where nombre in (
  'Salario','Otros ingresos','Comida','Transporte','Vivienda',
  'Suscripciones','Entretenimiento','Salud','Otros gastos'
);
