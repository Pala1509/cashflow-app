-- Aplicado en Supabase (VantaEco) el 23-oct-2026 — "Anotar con Siri" de CashFlow.
create table if not exists public.siri_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  ultima_transaccion_id uuid,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists siri_tokens_user_idx on public.siri_tokens(user_id);
alter table public.siri_tokens enable row level security;
create policy siri_tokens_select_propios on public.siri_tokens for select to authenticated using (auth.uid() = user_id);
create policy siri_tokens_delete_propios on public.siri_tokens for delete to authenticated using (auth.uid() = user_id);

-- Genera un token nuevo; lo devuelve en texto plano UNA vez (la app lo guarda
-- en el dispositivo). En la base solo queda el hash sha256.
create or replace function public.crear_token_siri()
returns text language plpgsql security definer set search_path = public, extensions as $$
declare tok text;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  tok := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.siri_tokens (user_id, token_hash) values (auth.uid(), encode(extensions.digest(tok, 'sha256'), 'hex'));
  return tok;
end; $$;
revoke all on function public.crear_token_siri() from public, anon;
grant execute on function public.crear_token_siri() to authenticated;
