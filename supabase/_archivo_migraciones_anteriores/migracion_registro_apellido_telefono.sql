-- Migración: registro pide nombre, apellido, correo y celular — sin
-- cédula (se decidió que era invasivo pedirla). El celular queda
-- guardado para cuando se retome el login por OTP más adelante.
--
-- Pégala en el SQL Editor de Supabase y corre una vez.

alter table public.profiles add column if not exists telefono text;

-- El trigger de "usuario nuevo" ya insertaba nombre + email, pero ignoraba
-- apellido aunque la columna ya existía (se llenaba después, a mano, en
-- Editar perfil). Ahora los tres llegan de una vez desde el registro.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre, apellido, telefono, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'apellido',
    new.raw_user_meta_data->>'telefono',
    new.email
  );

  insert into public.cuentas (user_id, tipo, nombre, saldo, icono, color, four_x_mil)
  values (new.id, 'efectivo', 'Efectivo', 0, 'cash', 'lime', false);

  return new;
end; $$;
