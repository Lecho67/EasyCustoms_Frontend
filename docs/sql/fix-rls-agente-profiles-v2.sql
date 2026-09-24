-- Fix real de F1, v2 — usa agente_tiene_caso_de() (ya existente, SECURITY
-- DEFINER, probado, evita la recursión profiles ↔ customs_queries) en vez
-- del subquery a mano que rompió producción en el primer intento.
--
-- documents no tenía un helper equivalente, así que se crea uno nuevo con
-- el MISMO patrón exacto (SQL, STABLE, SECURITY DEFINER) -- así el bypass
-- de RLS que evita la recursión funciona igual que en el original.

create or replace function public.agente_tiene_documento_de(cliente_id uuid)
returns boolean
language sql
stable
security definer
as $function$
  select exists (
    select 1 from public.documents d
    where d.user_id = cliente_id
      and (d.assigned_agent_id is null or d.assigned_agent_id = auth.uid())
  );
$function$;

revoke execute on function public.agente_tiene_documento_de(uuid) from public, anon;
grant execute on function public.agente_tiene_documento_de(uuid) to authenticated;

drop policy if exists "agente ve perfiles de sus casos asignados" on public.profiles;

create policy "agente ve perfiles de sus casos asignados" on public.profiles
  for select using (
    get_my_role() = 'admin'
    or (
      get_my_role() = 'agente'
      and (
        public.agente_tiene_caso_de(profiles.id)
        or public.agente_tiene_documento_de(profiles.id)
      )
    )
  );

-- Verificación paso a paso, para detectar un problema ANTES de probar la
-- app entera:
-- 1) esto solo no debería tirar error de recursión:
select id, email from public.profiles limit 1;
-- 2) esto tampoco:
select policyname, qual
from pg_policies
where schemaname = 'public' and tablename = 'profiles' and policyname = 'agente ve perfiles de sus casos asignados';
