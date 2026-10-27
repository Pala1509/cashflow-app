-- Migración: limpia las categorías duplicadas (el bug de "todo salió dos
-- veces") y agrega una restricción única para que sea IMPOSIBLE que vuelva
-- a pasar, sin importar cuántas veces corra la app la siembra al mismo
-- tiempo. Pégala completa en el SQL Editor de Supabase y ejecútala una vez.

-- 1) Antes de borrar duplicados, repunta cualquier movimiento/gasto fijo/
-- ingreso fijo/presupuesto que esté usando una categoría "perdedora"
-- (duplicada) hacia la categoría "ganadora" que sí se va a quedar — así no
-- se pierde la categorización de nada de lo que ya registraste.
with ranked as (
  select id, user_id, nombre,
         row_number() over (partition by user_id, nombre order by created_at asc, id asc) as rn
  from public.categorias
),
ganadoras as (
  select r1.id as ganadora_id, r2.id as perdedora_id
  from ranked r1
  join ranked r2 on r1.user_id = r2.user_id and r1.nombre = r2.nombre and r1.rn = 1 and r2.rn > 1
)
update public.transacciones t
set categoria_id = g.ganadora_id
from ganadoras g
where t.categoria_id = g.perdedora_id;

with ranked as (
  select id, user_id, nombre,
         row_number() over (partition by user_id, nombre order by created_at asc, id asc) as rn
  from public.categorias
),
ganadoras as (
  select r1.id as ganadora_id, r2.id as perdedora_id
  from ranked r1
  join ranked r2 on r1.user_id = r2.user_id and r1.nombre = r2.nombre and r1.rn = 1 and r2.rn > 1
)
update public.gastos_fijos g
set categoria_id = w.ganadora_id
from ganadoras w
where g.categoria_id = w.perdedora_id;

with ranked as (
  select id, user_id, nombre,
         row_number() over (partition by user_id, nombre order by created_at asc, id asc) as rn
  from public.categorias
),
ganadoras as (
  select r1.id as ganadora_id, r2.id as perdedora_id
  from ranked r1
  join ranked r2 on r1.user_id = r2.user_id and r1.nombre = r2.nombre and r1.rn = 1 and r2.rn > 1
)
update public.ingresos_fijos i
set categoria_id = w.ganadora_id
from ganadoras w
where i.categoria_id = w.perdedora_id;

with ranked as (
  select id, user_id, nombre,
         row_number() over (partition by user_id, nombre order by created_at asc, id asc) as rn
  from public.categorias
),
ganadoras as (
  select r1.id as ganadora_id, r2.id as perdedora_id
  from ranked r1
  join ranked r2 on r1.user_id = r2.user_id and r1.nombre = r2.nombre and r1.rn = 1 and r2.rn > 1
)
update public.presupuestos p
set categoria_id = w.ganadora_id
from ganadoras w
where p.categoria_id = w.perdedora_id;

-- 2) Ahora sí, borra las categorías duplicadas (ya nada apunta a ellas).
with ranked as (
  select id, user_id, nombre,
         row_number() over (partition by user_id, nombre order by created_at asc, id asc) as rn
  from public.categorias
)
delete from public.categorias
where id in (select id from ranked where rn > 1);

-- 3) La restricción única: de aquí en adelante, la base de datos misma
-- rechaza cualquier intento de crear dos categorías con el mismo nombre
-- para el mismo usuario — pase lo que pase en el código.
alter table public.categorias
  add constraint categorias_user_nombre_unique unique (user_id, nombre);
