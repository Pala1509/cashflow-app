-- Agrega apellido, fecha de nacimiento y ciudad a profiles en un proyecto
-- que ya corrió schema_zafra.sql. Pégalo en el SQL Editor y ejecútalo una vez.

alter table public.profiles add column if not exists apellido text;
alter table public.profiles add column if not exists fecha_nacimiento date;
alter table public.profiles add column if not exists ciudad text;
