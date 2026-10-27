-- Migración: push_tokens — guarda el "teléfono digital" (token FCM) de
-- cada dispositivo, para que el servidor sepa a dónde mandar un push
-- aunque la app esté cerrada. Un usuario puede tener más de un token
-- (varios dispositivos), por eso no es una columna más en profiles.
--
-- Pégala en el SQL Editor de Supabase y corre una vez.

create table if not exists public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null,
  platform    text not null default 'android',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, token)
);

alter table public.push_tokens enable row level security;

create policy "push_tokens: crud own" on public.push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Se actualiza updated_at solo cada vez que el mismo token se vuelve a
-- registrar (pasa cada vez que abres la app) — así el "cerebro" que revisa
-- y manda avisos puede ignorar tokens viejos que ya no se usan hace meses.
create or replace function public.touch_push_token()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists on_push_token_upsert on public.push_tokens;
create trigger on_push_token_upsert before update on public.push_tokens
  for each row execute procedure public.touch_push_token();
