-- Corrige las categorías predeterminadas de TU cuenta (no de cuentas nuevas).
-- 1. Reemplaza TU_CORREO_AQUI por el correo con el que entras a Zafra.
-- 2. Pega todo esto en el SQL Editor de Supabase y ejecútalo una sola vez.

do $$
declare v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = 'TU_CORREO_AQUI';

  if v_user_id is null then
    raise exception 'No encontré un usuario con ese correo. Revisa que esté bien escrito.';
  end if;

  -- Quita la categoría vieja "Ventas / DJ"
  delete from public.categorias
  where user_id = v_user_id and nombre = 'Ventas / DJ';

  -- Agrega "Ventas" y "Freelancer" como predeterminadas (si no existen ya)
  insert into public.categorias (user_id, nombre, tipo, icono, predeterminada)
  select v_user_id, 'Ventas', 'ingreso', 'plus-circle', true
  where not exists (select 1 from public.categorias where user_id = v_user_id and nombre = 'Ventas');

  insert into public.categorias (user_id, nombre, tipo, icono, predeterminada)
  select v_user_id, 'Freelancer', 'ingreso', 'target', true
  where not exists (select 1 from public.categorias where user_id = v_user_id and nombre = 'Freelancer');

  -- Por si acaso, deja marcadas como predeterminadas (protegidas de borrado)
  -- todas las categorías de fábrica que ya tenías
  update public.categorias
  set predeterminada = true
  where user_id = v_user_id
    and nombre in ('Salario','Otros ingresos','Comida','Transporte','Vivienda',
                    'Suscripciones','Entretenimiento','Salud','Otros gastos');
end $$;
