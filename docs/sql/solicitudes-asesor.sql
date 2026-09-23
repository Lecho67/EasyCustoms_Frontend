-- Solicitudes de asesor personal (chat de ayuda -> "pedir un asesor").
-- Ejecutar completo en el SQL Editor de Supabase (plan gratuito; no requiere Pro).
-- Idempotente: se puede volver a correr sin romper nada.
--
-- No auto-asigna gestor: solo deja una fila pendiente para que un admin la
-- vea y asigne el gestor a mano desde /admin (asignarGestor ya existe en
-- adminService.ts). Este script no toca esa asignación.

create table if not exists public.solicitudes_asesor (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  mensaje       text,
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'atendida')),
  created_at    timestamptz not null default now(),
  atendida_por  uuid references public.profiles (id),
  atendida_at   timestamptz
);

-- Un solo pedido pendiente por cliente a la vez (evita que el chat spamee
-- solicitudes si el cliente lo pide varias veces antes de que lo atiendan).
create unique index if not exists solicitudes_asesor_pendiente_unica
  on public.solicitudes_asesor (user_id)
  where estado = 'pendiente';

alter table public.solicitudes_asesor enable row level security;

drop policy if exists "solicitudes_asesor_select" on public.solicitudes_asesor;
create policy "solicitudes_asesor_select" on public.solicitudes_asesor
  for select using (
    user_id = auth.uid() or public.get_my_role() = 'admin'
  );

drop policy if exists "solicitudes_asesor_insert_propia" on public.solicitudes_asesor;
create policy "solicitudes_asesor_insert_propia" on public.solicitudes_asesor
  for insert with check (user_id = auth.uid());

-- Solo un admin marca la solicitud como atendida (después de asignar el
-- gestor a mano desde AdminUserTable).
drop policy if exists "solicitudes_asesor_update_admin" on public.solicitudes_asesor;
create policy "solicitudes_asesor_update_admin" on public.solicitudes_asesor
  for update using (public.get_my_role() = 'admin');
