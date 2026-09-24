-- EMERGENCIA — correr ya. El fix de fix-rls-agente-profiles.sql causó
-- "infinite recursion detected in policy for relation profiles" en
-- producción: el subquery que agregué lee customs_queries, y esa tabla
-- tiene una policy que en algún punto vuelve a leer profiles (para el caso
-- de gestor, probablemente) -- ciclo. Esto reintroduce el hueco de
-- seguridad de F1 (agente ve todos los perfiles) pero restaura el servicio
-- mientras se arma el fix correcto con un helper SECURITY DEFINER.

drop policy if exists "agente ve perfiles de sus casos asignados" on public.profiles;

create policy "agente ve perfiles de sus casos asignados" on public.profiles
  for select using (
    (get_my_role() = 'admin'::text) OR (get_my_role() = 'agente'::text)
  );

-- Verificación: debería devolver 0 filas (nada roto) al probar cualquier
-- select simple, por ejemplo:
-- select id, email from public.profiles limit 1;
