-- Diagnóstico (sesión 2026-09-23, diseño de estrategia de tests): e2e.agente@
-- y e2e.admin@bordercheck.test se desloguean solos segundos después de un
-- login fresco por Playwright (e2e.cliente@ nunca tiene este problema).
-- Reproducido con --workers=1 (sin paralelismo) y con storageState recién
-- regenerado, así que no es expiración de token ni condición de carrera del
-- lado del frontend. Solo lectura, no cambia nada.

-- Paso 1: ¿las 3 cuentas E2E tienen fila en sesiones_activas y su rol es el
-- esperado? (compará user_id con el id real de cada cuenta e2e.* en
-- Authentication -> Users).
select p.id, p.email, p.role, p.updated_at as profile_updated_at,
       sa.session_id, sa.updated_at as sesion_updated_at
from public.profiles p
left join public.sesiones_activas sa on sa.user_id = p.id
where p.email in (
  'e2e.cliente@bordercheck.test',
  'e2e.agente@bordercheck.test',
  'e2e.admin@bordercheck.test'
);

-- Paso 2: para agente/admin, ¿cuántas filas hay en auth.sessions? Si hay más
-- de 1 sesión activa (p.ej. alguien logueado interactivamente con la misma
-- cuenta en un navegador real, o un cron/healthcheck), cada login de
-- Playwright se pelea por el "última gana" contra esa otra sesión.
select u.email, count(*) as sesiones_activas_en_auth
from auth.sessions s
join auth.users u on u.id = s.user_id
where u.email in ('e2e.agente@bordercheck.test', 'e2e.admin@bordercheck.test')
group by u.email;
