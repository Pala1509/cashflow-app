-- Actualiza el TRIGGER en Supabase (no solo el archivo local) para que
-- las cuentas NUEVAS reciban las categorías correctas desde el día uno.
-- Esto es necesario porque el trigger ya estaba guardado en tu base de
-- datos desde antes — cambiar el archivo .sql local no lo actualiza solo.
-- Pégalo en el SQL Editor y ejecútalo una sola vez.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nombre, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)), new.email);

  insert into public.categorias (user_id, nombre, tipo, icono, predeterminada) values
    (new.id,'Salario','ingreso','wallet',true),
    (new.id,'Ventas','ingreso','plus-circle',true),
    (new.id,'Freelancer','ingreso','target',true),
    (new.id,'Otros ingresos','ingreso','dots',true),
    (new.id,'Comida','egreso','utensils',true),
    (new.id,'Transporte','egreso','bike',true),
    (new.id,'Vivienda','egreso','home',true),
    (new.id,'Suscripciones','egreso','device-desktop',true),
    (new.id,'Entretenimiento','egreso','gamepad-2',true),
    (new.id,'Salud','egreso','heart',true),
    (new.id,'Otros gastos','egreso','dots',true);

  insert into public.cuentas (user_id, tipo, nombre, saldo, icono, color, four_x_mil)
  values (new.id, 'efectivo', 'Efectivo', 0, 'cash', 'lime', false);

  return new;
end;
$$;

-- Por si algún usuario ya se registró después del rebranding pero antes de
-- este fix y le tocó "Ventas / DJ": lo corrige para TODOS de una vez,
-- igual que hicimos la vez pasada.
delete from public.categorias where nombre = 'Ventas / DJ';

insert into public.categorias (user_id, nombre, tipo, icono, predeterminada)
select distinct c.user_id, 'Ventas', 'ingreso'::tipo_transaccion, 'plus-circle', true
from public.categorias c
where not exists (select 1 from public.categorias c2 where c2.user_id = c.user_id and c2.nombre = 'Ventas');

insert into public.categorias (user_id, nombre, tipo, icono, predeterminada)
select distinct c.user_id, 'Freelancer', 'ingreso'::tipo_transaccion, 'target', true
from public.categorias c
where not exists (select 1 from public.categorias c2 where c2.user_id = c.user_id and c2.nombre = 'Freelancer');
