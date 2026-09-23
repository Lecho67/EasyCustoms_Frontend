-- Límites de uso: espera entre consultas + sesión única por cuenta.
-- Ejecutar completo en el SQL Editor de Supabase (plan gratuito; no requiere Pro).
-- Idempotente: se puede volver a correr sin romper nada.

-- ============================================================================
-- 1. ESPERA ENTRE CONSULTAS
-- ============================================================================
-- Segundos que le faltan al usuario para poder enviar otra consulta (0 = ya puede).
-- Fuente de verdad del tiempo: el reloj del servidor (no el del navegador).
-- Los roles internos (agente/gestor/admin) no tienen espera.
-- Para cambiar la espera, editar c_espera y volver a correr este bloque.

create or replace function public.segundos_espera_consulta()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c_espera constant integer := 30;
  v_ultima timestamptz;
begin
  if auth.uid() is null or coalesce(public.get_my_role(), 'cliente') <> 'cliente' then
    return 0;
  end if;

  select max(created_at) into v_ultima
  from public.customs_queries
  where user_id = auth.uid();

  if v_ultima is null then
    return 0;
  end if;

  return greatest(0, ceil(c_espera - extract(epoch from (now() - v_ultima)))::integer);
end;
$$;

revoke execute on function public.segundos_espera_consulta() from public, anon;
grant execute on function public.segundos_espera_consulta() to authenticated;

-- Refuerzo duro: aunque alguien salte el chequeo del frontend, la base rechaza
-- guardar otra consulta dentro de la ventana. Solo aplica a inserts hechos por
-- el propio usuario (auth.uid() = user_id); un insert con service-role no se toca.
create or replace function public.limitar_frecuencia_consultas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_espera integer;
begin
  if auth.uid() is null or auth.uid() <> new.user_id then
    return new;
  end if;

  v_espera := public.segundos_espera_consulta();
  if v_espera > 0 then
    raise exception 'Espera % s antes de enviar otra consulta.', v_espera;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_limitar_frecuencia_consultas on public.customs_queries;
create trigger trg_limitar_frecuencia_consultas
  before insert on public.customs_queries
  for each row execute function public.limitar_frecuencia_consultas();

-- ============================================================================
-- 2. SESIÓN ÚNICA POR CUENTA
-- ============================================================================
-- La opción nativa de Supabase ("single session per user") es de plan Pro, así
-- que se resuelve con una tabla + RPCs. "La última sesión gana": al iniciar
-- sesión, registrar_sesion() marca esa sesión como la activa y BORRA las demás
-- de auth.sessions (sus refresh tokens dejan de servir). El cliente viejo se
-- entera al instante por Realtime (o en <60 s por polling) vía sesion_vigente().
-- Ojo: el access token viejo sigue siendo un JWT válido hasta que expire
-- (1 h por defecto); lo que se corta de inmediato es el refresh y la UI.

create table if not exists public.sesiones_activas (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  session_id uuid not null,
  updated_at timestamptz not null default now()
);

alter table public.sesiones_activas enable row level security;

-- Solo lectura de la fila propia (la necesita Realtime). Sin políticas de
-- INSERT/UPDATE/DELETE: únicamente escriben las funciones SECURITY DEFINER.
drop policy if exists "sesion_propia_select" on public.sesiones_activas;
create policy "sesion_propia_select" on public.sesiones_activas
  for select using (user_id = auth.uid());

-- Toma el control de la cuenta: esta sesión pasa a ser la única activa.
create or replace function public.registrar_sesion()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if auth.uid() is null or v_sid is null then
    raise exception 'No autorizado';
  end if;

  insert into public.sesiones_activas (user_id, session_id, updated_at)
  values (auth.uid(), v_sid, now())
  on conflict (user_id)
  do update set session_id = excluded.session_id, updated_at = now();

  delete from auth.sessions where user_id = auth.uid() and id <> v_sid;
end;
$$;

-- ¿Esta sesión sigue siendo la activa? Si no hay registro (cuentas anteriores a
-- esta función) o el registrado ya no existe en auth.sessions (cerró sesión),
-- reclama la cuenta para sí y devuelve true.
create or replace function public.sesion_vigente()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_sid    uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_actual uuid;
begin
  if auth.uid() is null or v_sid is null then
    return false;
  end if;

  select session_id into v_actual
  from public.sesiones_activas
  where user_id = auth.uid();

  if v_actual is null
     or not exists (select 1 from auth.sessions where id = v_actual) then
    insert into public.sesiones_activas (user_id, session_id, updated_at)
    values (auth.uid(), v_sid, now())
    on conflict (user_id)
    do update set session_id = excluded.session_id, updated_at = now();
    return true;
  end if;

  return v_actual = v_sid;
end;
$$;

revoke execute on function public.registrar_sesion() from public, anon;
revoke execute on function public.sesion_vigente() from public, anon;
grant execute on function public.registrar_sesion() to authenticated;
grant execute on function public.sesion_vigente() to authenticated;

-- Realtime: para que el dispositivo viejo se entere al instante.
-- (Si ya estaba agregada, este comando falla con "already member": ignorar.)
alter publication supabase_realtime add table public.sesiones_activas;
