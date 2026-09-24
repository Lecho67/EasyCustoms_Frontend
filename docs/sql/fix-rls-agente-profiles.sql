-- Fix del hallazgo confirmado de F1 (audit de seguridad, sesión 2026-09-23):
-- la policy "agente ve perfiles de sus casos asignados" en public.profiles
-- tiene qual = (get_my_role() = 'admin' OR get_my_role() = 'agente') -- no
-- compara nada de la fila, así que cualquier agente lee TODOS los perfiles
-- del sistema (nombre, email, teléfono, dirección, document_number,
-- kyc_document_path), no solo los de sus casos asignados. Confirmado en vivo
-- contra pg_policies, no es teórico.
--
-- La policy de gestor (auth.uid() = gestor_id) SÍ está bien -- no hace falta
-- tocarla.
--
-- Este fix acota la visibilidad de agente a perfiles de clientes que tengan
-- una fila en customs_queries o documents sin asignar o asignada a ese
-- mismo agente -- lo mismo que ya filtran las políticas de esas 2 tablas
-- (ver CLAUDE.md). No afecta el panel de KYC: ese usa el RPC
-- listar_kyc_pendientes() (SECURITY DEFINER), que bypasea RLS aparte.
-- Admin sigue viendo todo.

drop policy if exists "agente ve perfiles de sus casos asignados" on public.profiles;

create policy "agente ve perfiles de sus casos asignados" on public.profiles
  for select using (
    get_my_role() = 'admin'
    or (
      get_my_role() = 'agente'
      and (
        exists (
          select 1 from public.customs_queries cq
          where cq.user_id = profiles.id
            and (cq.assigned_agent_id is null or cq.assigned_agent_id = auth.uid())
        )
        or exists (
          select 1 from public.documents d
          where d.user_id = profiles.id
            and (d.assigned_agent_id is null or d.assigned_agent_id = auth.uid())
        )
      )
    )
  );

-- Verificación (correr como el propio Editor SQL, ve todas las filas igual):
-- confirma que la nueva condición sí referencia profiles.id ahora.
select policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'profiles' and policyname = 'agente ve perfiles de sus casos asignados';
