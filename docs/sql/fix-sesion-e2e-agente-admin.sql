-- Fix para el hallazgo de docs/sql/diagnostico-sesion-e2e-agente-admin.sql:
-- e2e.agente@ (30 filas) y e2e.admin@bordercheck.test (31 filas) acumularon
-- sesiones en auth.sessions que registrar_sesion() nunca limpió, dejando
-- sesiones_activas apuntando a una sesión vieja -- cualquier login nuevo
-- pierde la comparación en sesion_vigente() y se autodeslogea.
--
-- OJO -- esto cierra sesión de verdad: si alguien tiene una pestaña real
-- abierta logueado con e2e.agente@ o e2e.admin@ ahora mismo, la va a perder.
-- Son cuentas dedicadas a Playwright, así que en principio no debería haber
-- nadie usándolas interactivamente -- confirmá antes de correr.

-- Paso 1: borra todas las sesiones de auth.sessions para esas 2 cuentas.
delete from auth.sessions
where user_id in (
  select id from auth.users
  where email in ('e2e.agente@bordercheck.test', 'e2e.admin@bordercheck.test')
);

-- Paso 2: borra también la fila stale de sesiones_activas -- si no, el
-- próximo login la actualiza igual (on conflict do update), pero por las
-- dudas queda explícito y limpio.
delete from public.sesiones_activas
where user_id in (
  select id from auth.users
  where email in ('e2e.agente@bordercheck.test', 'e2e.admin@bordercheck.test')
);

-- Verificación: debería devolver 0 filas para ambas cuentas.
select u.email, count(*) as sesiones_restantes
from auth.sessions s
join auth.users u on u.id = s.user_id
where u.email in ('e2e.agente@bordercheck.test', 'e2e.admin@bordercheck.test')
group by u.email;
