-- =====================================================================
-- Corrección GENERAL de categorías predeterminadas
-- Aplica a TODOS los usuarios que ya existan en el proyecto, no a uno solo.
-- Pégalo en el SQL Editor de Supabase y ejecútalo una sola vez.
-- =====================================================================

-- 1. Quita "Ventas / DJ" de cualquier cuenta que la tenga
delete from public.categorias
where nombre = 'Ventas / DJ';

-- 2. Le agrega "Ventas" a todo usuario que ya tenga categorías pero no la tenga
insert into public.categorias (user_id, nombre, tipo, icono, predeterminada)
select distinct c.user_id, 'Ventas', 'ingreso'::tipo_transaccion, 'plus-circle', true
from public.categorias c
where not exists (
  select 1 from public.categorias c2
  where c2.user_id = c.user_id and c2.nombre = 'Ventas'
);

-- 3. Le agrega "Freelancer" de la misma forma
insert into public.categorias (user_id, nombre, tipo, icono, predeterminada)
select distinct c.user_id, 'Freelancer', 'ingreso'::tipo_transaccion, 'target', true
from public.categorias c
where not exists (
  select 1 from public.categorias c2
  where c2.user_id = c.user_id and c2.nombre = 'Freelancer'
);

-- 4. Marca como predeterminadas (protegidas de borrado) todas las categorías
--    de fábrica de TODOS los usuarios, sin importar quién sea
update public.categorias
set predeterminada = true
where nombre in (
  'Salario','Ventas','Freelancer','Otros ingresos',
  'Comida','Transporte','Vivienda','Suscripciones',
  'Entretenimiento','Salud','Otros gastos'
);
