-- Agrega la columna es_pro a profiles en un proyecto que ya corrió schema_zafra.sql.
-- Pégalo en el SQL Editor y ejecútalo una sola vez.

alter table public.profiles add column if not exists es_pro boolean not null default false;
