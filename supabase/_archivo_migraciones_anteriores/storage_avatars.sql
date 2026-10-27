-- Crea el bucket "avatars" (fotos de perfil) y sus políticas de seguridad.
-- Pégalo en el SQL Editor de Supabase y ejecútalo una sola vez.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Nota: no hace falta "alter table storage.objects enable row level security"
-- porque Supabase ya la activa por defecto, y el rol del SQL Editor no es
-- dueño de esa tabla (por eso daría el error 42501 si se intenta).

-- Cualquiera puede VER las fotos (necesario para que se muestren en la app)
drop policy if exists "Avatares son públicos" on storage.objects;
create policy "Avatares son públicos"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Solo el dueño puede subir/reemplazar/borrar SU PROPIA foto
-- (la carpeta del archivo debe ser igual a su user_id, ej: "abc123/avatar.jpg")
drop policy if exists "Usuarios suben su propio avatar" on storage.objects;
create policy "Usuarios suben su propio avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Usuarios actualizan su propio avatar" on storage.objects;
create policy "Usuarios actualizan su propio avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Usuarios borran su propio avatar" on storage.objects;
create policy "Usuarios borran su propio avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
