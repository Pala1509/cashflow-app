-- Migración: categorías organizadas por grupo, con color propio por grupo
-- (como en Buddy). Pégala completa en el SQL Editor de Supabase y
-- ejecútala una vez.

alter table public.categorias add column if not exists grupo text;
alter table public.categorias add column if not exists color text not null default 'lavender';

-- Le pone un grupo/color razonable a las categorías que ya tenías creadas
-- (para que no queden "sin agrupar" después de la migración). La app
-- misma se encarga de rellenar las categorías nuevas de Buddy la próxima
-- vez que abras CashFlow — no hace falta tocar nada más aquí.
update public.categorias set grupo = 'ingresos', color = 'lime' where tipo = 'ingreso' and grupo is null;
update public.categorias set grupo = 'estilo_vida', color = 'coral' where tipo = 'egreso' and grupo is null;

-- Simplifica el trigger de usuarios nuevos: ya NO siembra categorías aquí
-- (eso ahora lo hace la app automáticamente en el primer login, comparando
-- contra la lista completa — así nunca hay que mantener la lista en dos
-- lugares distintos y desincronizada).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nombre, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)), new.email);

  insert into public.cuentas (user_id, tipo, nombre, saldo, icono, color, four_x_mil)
  values (new.id, 'efectivo', 'Efectivo', 0, 'cash', 'lime', false);

  return new;
end;
$$;

