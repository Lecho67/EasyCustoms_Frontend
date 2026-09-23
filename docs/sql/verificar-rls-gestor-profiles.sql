-- F1 del audit de seguridad (sesión 2026-09-23): GestorPanel llama a
-- fetchClientesDelGestor(gestorId), que hace
--   select("*").eq("gestor_id", gestorId)
-- sobre `profiles`, con `gestorId = profile.id` del propio usuario logueado.
-- Ese filtro corre en el navegador -- no es un límite de seguridad. Si la
-- política RLS de SELECT sobre `profiles` para el rol `gestor` no compara
-- también `gestor_id = auth.uid()`, cualquier gestor puede pedir
-- directamente a la REST API de Supabase (con su propio JWT, sin pasar por
-- el frontend) la cartera de OTRO gestor completa -- nombre, email,
-- teléfono, dirección, document_number, kyc_document_path.
--
-- Paso 1 (solo lectura, no cambia nada): correr esto primero y revisar el
-- `qual` de cada policy con cmd = 'SELECT' sobre profiles.
select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public' and tablename = 'profiles'
order by cmd, policyname;

-- Paso 2: si alguna policy de SELECT permite el rol 'gestor' (o un
-- catch-all para 'authenticated') SIN comparar gestor_id = auth.uid(),
-- ese es el hueco. No hay forma automática de saber el nombre exacto de esa
-- policy sin ver el resultado del Paso 1 -- reemplazar "NOMBRE_DE_LA_POLICY"
-- abajo por el que aparezca ahí antes de correr esto.
--
-- drop policy if exists "NOMBRE_DE_LA_POLICY" on public.profiles;
--
-- Policy correctora: un gestor solo ve su propia fila (ya cubierta por
-- cualquier policy de "select la propia") y las filas de sus clientes
-- (gestor_id = auth.uid()). Admin sigue viendo todo vía su propia policy.
-- create policy "profiles_select_gestor_propia_cartera" on public.profiles
--   for select using (
--     public.get_my_role() = 'gestor' and gestor_id = auth.uid()
--   );
