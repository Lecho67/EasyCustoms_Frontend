# Auditoría de Readiness para Producción — Easy CUSTOMS (Frontend)

> Estado general: **casi listo.** Host decidido (Vercel, plan gratuito, proyecto
> independiente). Los archivos de despliegue del frontend ya están; faltan la
> conexión del proyecto en Vercel, el versionado del esquema de la DB y el
> backfill de datos.
>
> Convención de estado: ✅ hecho · 🔷 listo para tomar · ⏳ requiere decisión previa · ❌ bloqueante abierto

## Decisión de host

**Vercel**, cuenta gratuita, proyecto nuevo e independiente (aparte del portafolio).
El frontend se buildea desde el repo (`npm ci && vite build`), se sirve como
estáticos con `frontend/vercel.json` (rewrite SPA + headers + CSP). El `Dockerfile`
y el `docker-compose.yml` quedan **solo para desarrollo local**.

Alcance: este repo es **solo el frontend** (SPA React + Vite servida como estáticos).
El motor de reglas y su Docker/Ollama viven en otro repo (colaborador). El esquema
de la base y su configuración viven en el proyecto Supabase.

---

## 0. Lo que ya está sólido

- `package-lock.json` versionado; CI usa `npm ci`.
- Code-splitting por ruta (`React.lazy`); ningún chunk de build supera los 500 kB.
- `ErrorBoundary` en la raíz (`src/main.tsx`).
- 137 tests unit/componente + 32 E2E; CI (`.github/workflows/ci.yml`) corre
  `lint` + `test:run` + `build` en cada push a `main` y en cada PR.
- La anon key de Supabase es correctamente pública; la frontera de seguridad real
  es RLS, endurecida y verificada iterativamente (ver `CLAUDE.md`).
- `src/lib/supabase.ts` falla rápido si faltan las envs obligatorias.
- `AuthContext` resiliente (reintento con backoff, no expulsa ante fallo transitorio).
- Gating de KYC/cumplimiento en frontend **y** en RLS (`kyc_aprobado()`).
- `tsconfig` con `strict: true`; ESLint limpio.

---

## 1. Bloqueantes

| ID | Hallazgo | Estado |
|---|---|---|
| B1 | No había build de producción (el `Dockerfile` corría el dev server). | ✅ Resuelto por Vercel: buildea `npm ci && vite build` y sirve `dist/` como estáticos. El `Dockerfile`/`compose` quedan solo para dev local. |
| B2 | Sin fallback SPA → deep-links daban 404. | ✅ `frontend/vercel.json` con `rewrites: /(.*) → /index.html`. |
| B3 | **El esquema de la DB no tiene fuente de verdad.** Cero migraciones; tablas, RLS, ~10 RPCs `SECURITY DEFINER`, triggers solo en el proyecto Supabase vivo. Sin recrear, revisar en PR ni rollback. | ❌ Abierto — Simon / DB. Exportar a `supabase/migrations/*.sql`. |
| B4 | Backfill de `customs_queries.ai_verdict` (`MEJORAS_PENDIENTES.md §9b`). | ✅ Aplicado en producción con el trigger de notificaciones desactivado (0 notificaciones creadas). 55 filas con veredicto válido. |
| B5 | `.dockerignore` no excluía `.env.e2e` ni artefactos de test. | ✅ Corregido: ignora `.env*`, `e2e/.auth`, `test-results/`, etc. |

---

## 2. Alto — antes de usuarios reales

| ID | Hallazgo | Estado |
|---|---|---|
| A1 | **Sin monitoreo de errores.** Solo `console.error`. Falta Sentry/GlitchTip con gate `import.meta.env.PROD` + sourcemaps + release tagging. El build no emite sourcemaps. | 🔷 Pendiente (tarea aparte). |
| A2 | Sin headers de seguridad / CSP. | ✅ En `frontend/vercel.json`: CSP (`frame-src` de Power BI, `connect-src` de Supabase REST+WSS), `HSTS`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control` inmutable para `/assets`. Probado sin violaciones en páginas públicas + shell. **Verificar en el preview** las páginas autenticadas, sobre todo `/reportes` (Recharts + Power BI). |
| A3 | **Allowlist de redirect de Supabase Auth.** Reset de contraseña y `detectSessionInUrl` necesitan el dominio de prod **y** los de preview (`*.vercel.app`) en Supabase → Auth → URL Configuration. | ❌ Abierto — Simon (§9). |
| A4 | Sin pipeline de deploy. | ✅ Vercel despliega en push a `main` + preview por PR. `ci.yml` sigue como gate de calidad. |
| A5 | **CORS del motor de reglas + `connect-src`.** El backend debe allowlistear el origen de prod y de preview para el preflight de `/api/v1/shipments/evaluate`. **Y** el `connect-src` de la CSP debe sumar la URL del backend cuando exista. | ✅ Resuelto (con matiz de riesgo aceptado a propósito). Frontend: `src/lib/api.ts` manda `X-API-Key` (`VITE_X_API_KEY`), no `Authorization` (el backend no lo incluye en `allowedHeaders`). Backend: `CORS_ORIGINS` lista el origen de prod, `http://localhost:5173`, y un comodín para previews de Vercel (`https://easycustoms-*-lecho.vercel.app`, ver `src/lib/corsOriginMatcher.ts`). El proyecto de Vercel se renombró (`border-check-ai-frontend` → `easycustoms`): el dominio viejo devuelve `404 DEPLOYMENT_NOT_FOUND` y su nombre quedó liberado, así que se **reemplazó** en el allowlist en vez de conservarlo. `connect-src` de `frontend/vercel.json` suma `https://*.trycloudflare.com` y `https://*.ngrok-free.dev` — sin URL de prod estable todavía (decisión #2 sigue abierta), esto es el atajo para poder probar contra un backend real mientras tanto. **Riesgo aceptado deliberadamente**: cualquiera de esos dos dominios es compartido/gratuito — un atacante también puede levantar un túnel ahí, así que un XSS en el sitio podría exfiltrar datos a un túnel ajeno bajo ese mismo dominio. Reemplazar por el origen exacto (sin comodín) en cuanto haya una URL de backend estable. |
| A6 | **Matiz de RLS abierto.** Un agente puede sobrescribir un caso `assigned_agent_id IS NULL` sin "tomarlo" antes (`CLAUDE.md`). | ⏳ Decisión de launch. |
| A7 | **Envs en build-time.** `VITE_*` se inlinea en `vite build`. Cargar `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y (cuando existan) `VITE_API_BASE_URL` + `VITE_X_API_KEY` en Vercel → Environment Variables **antes** del primer deploy. Sin `VITE_API_BASE_URL` la app corre con el mock. | ❌ Abierto — Simon (§9). |

---

## 3. Medio

- ✅ `index.html` con `<meta description>`, favicon (`public/favicon.svg`), Open Graph / Twitter, `theme-color`. `public/` con `favicon.svg` y `robots.txt` (bloquea las rutas privadas de los crawlers). Falta `public/og-image.png` (1200×630) y `og:url` con el dominio final.
- ✅ Pin de Node: `engines.node: "20.x"` + `.nvmrc`.
- Vulnerabilidades: `npm audit --omit=dev` → **0** (prod limpio). 1 crítica + 1 alta, **todas en el toolchain de dev** (vite/vitest/esbuild), solo explotables con dev server / Vitest UI. Roadmap: upgrade mayor a vite 7 / vitest 3.
- 🔷 E2E no corre en CI (necesita creds `e2e.*` como secrets de GitHub).
- 🔷 `tsc -b` no chequea `vite.config.ts`, `tailwind.config.ts` ni `e2e/`.
- 🔷 Índices de DB: verificar índices sobre `assigned_agent_id`, `user_id`, `ai_verdict`, `overridden_by` (columnas de filtro de RLS). `EXPLAIN` sobre la query de la cola de agentes.
- 🔷 `ErrorBoundary` usa el emoji `⚠` (rompe la convención "solo lucide-react").

---

## 4. Variables de entorno — reglas

Todo lo `VITE_`-prefijado **se inlinea en el bundle y es público**. Nunca poner ahí:
service-role key, contraseña de DB, secreto de proveedor externo, token de Power BI.

| Variable | Sensibilidad | Notas |
|---|---|---|
| `VITE_SUPABASE_URL` | Pública OK | En el bundle. |
| `VITE_SUPABASE_ANON_KEY` | Pública OK | En el bundle; RLS es la frontera. |
| `VITE_API_BASE_URL` | Pública OK | En el bundle. Vacía ⇒ mock local. |
| `VITE_X_API_KEY` | Pública OK (igual que las de arriba: cualquier `VITE_*` es visible en el bundle) | Header `X-API-Key` hacia el motor de reglas. No es un secreto real de protección — es rate-limiting/allowlisting básico, no autenticación de usuario final. Si se filtra, rotar la key en `API_KEYS` del backend. |
| `E2E_*` (`.env.e2e`) | **Secreta** | Contraseñas de cuentas E2E + (a futuro) service-role key. Git-ignored ✅, docker-ignored ✅. Nunca subir a Vercel. |

CORS / rate-limiting / Helmet: no aplican en el SPA — van en el CDN (headers) + Supabase
(rate limit de Auth incorporado) + el backend del motor de reglas.
Sanitización de inputs: React escapa JSX por defecto; no hay `dangerouslySetInnerHTML`.

---

## 5. Base de datos

| Tema | Estado |
|---|---|
| Migraciones | ❌ No existen. Exportar el esquema a `supabase/migrations/*.sql` (dump inicial versionado) o adoptar Supabase CLI. |
| Connection pooling | Supabase provee PgBouncer automático. Verificar que el frontend usa el endpoint correcto (el cliente `supabase-js` va por PostgREST, no conexión directa — OK). |
| Índices | Sin verificar. Revisar los de las columnas de filtro RLS. |
| Backups | Depende del plan. Free = diario, 7 días, sin PITR. Confirmar. |
| Redirect URLs de Auth | Agregar dominio de prod antes del launch. |

---

## 6. CI/CD y despliegue

- **`ci.yml`** = `lint` + `test:run` + `build` en push a `main` y PRs. Queda como gate de calidad.
- **Vercel** despliega solo: push a `main` → producción; cada PR → preview deploy con su URL.
- **Rollback**: Vercel → Deployments → "Promote to Production" sobre el deploy anterior (1 click, instantáneo).
- **Healthcheck / zero-downtime**: no aplican a un SPA estático — el CDN sirve `index.html` siempre y el swap es atómico.
- Opcional: activar en Vercel "Wait for CI" para no promover a producción si `ci.yml` está rojo.
- Opcional: E2E en CI (creds `e2e.*` como secrets de GitHub).

---

## 7. Decisiones pendientes de Simon

| # | Decisión | Estado |
|---|---|---|
| 1 | Host del frontend | ✅ Vercel (gratuito). |
| 2 | URL de producción del backend del motor de reglas → `VITE_API_BASE_URL` + `connect-src` de la CSP | ❌ Abierto (sin ella, la app corre con el mock). |
| 3 | Plan de Supabase (backups / PITR / pausa por inactividad) | ❌ Confirmar. |
| 4 | Dominio propio + certificado | ❌ (Vercel da `*.vercel.app` + TLS gratis mientras tanto). |

---

## 8. Checklist de ejecución

**Frontend — hecho:**
- [x] `frontend/vercel.json` (rewrite SPA + headers + CSP + cache de assets)
- [x] `.dockerignore`: `.env*`, `e2e/.auth`, `test-results/`, etc.
- [x] `index.html`: meta description, favicon, OG/Twitter, `theme-color`
- [x] `public/favicon.svg` + `public/robots.txt`
- [x] `engines.node` + `.nvmrc`

**Frontend — pendiente:**
- [ ] `public/og-image.png` (1200×630) + `og:url` con el dominio final
- [ ] `build.sourcemap: true` + integrar Sentry (gate `PROD`)
- [ ] `ErrorBoundary`: `⚠` → `<AlertTriangle>`
- [ ] (opcional) E2E en CI con secrets; "Wait for CI" en Vercel
- [ ] Reemplazar los comodines de `connect-src` (`*.trycloudflare.com`, `*.ngrok-free.dev`) por el origen exacto del backend cuando haya una URL de prod estable (decisión #2) — hoy son un atajo aceptado a propósito para poder probar contra túneles

**Frontend — hecho (sesión CORS/API key):**
- [x] `src/lib/api.ts`: se dejó de enviar `Authorization: Bearer <jwt>` (no está en `allowedHeaders` del CORS del backend) y se agregó `X-API-Key` desde `VITE_X_API_KEY` (opcional — si no está seteada, el request va sin el header).
- [x] `src/vite-env.d.ts` + `.env.example`: tipado y documentación de `VITE_X_API_KEY`.
- [x] `connect-src` de `frontend/vercel.json` suma `https://*.trycloudflare.com` y `https://*.ngrok-free.dev` (túneles ephemeral usados para desarrollo — la app en Vercel ya puede pegarle a un backend real detrás de cualquiera de los dos sin editar `vercel.json` en cada reinicio del túnel).

**Base de datos (SQL Editor, con verificación):**
- [ ] Esquema versionado en `supabase/migrations/`
- [x] Backfill de `ai_verdict` (`MEJORAS_PENDIENTES.md §9b`) — aplicado, trigger OK, 0 notificaciones
- [ ] Revisar índices de columnas de filtro RLS
- [ ] Confirmar plan/backups
- [x] Agregar el dominio de prod **y** `*.vercel.app` a Auth → URL Configuration

**Cross-equipo (backend):**
- [x] CORS del motor de reglas allowlistea el origen de prod (`https://easycustoms.vercel.app` ya está en `CORS_ORIGINS`; el dominio anterior `border-check-ai-frontend.vercel.app` ya no existe y se sacó)
- [x] Orígenes de **preview** de Vercel: el backend agregó soporte de comodín `*` en `CORS_ORIGINS` (`src/lib/corsOriginMatcher.ts`) y `https://easycustoms-*-lecho.vercel.app` ya está en el `.env`. Supone que el team slug de Vercel sigue siendo `lecho`; si el nombre del proyecto o el slug cambian otra vez, el patrón hay que actualizarlo.
- [x] Entrada de `localhost:5173` en `CORS_ORIGINS` arreglada (tenía un path pegado que nunca matcheaba un `Origin` real)
- [x] Confirmado: `API_KEYS` del backend incluye la key que carga `VITE_X_API_KEY` localmente. Falta confirmar lo mismo una vez que `VITE_X_API_KEY` se cargue en Vercel.
- [x] `connect-src` de la CSP ya acepta túneles (`*.trycloudflare.com`, `*.ngrok-free.dev`) — falta el reemplazo por el origen exacto cuando haya URL de prod
- [ ] Confirmar códigos HS reales en logs
- [ ] URL de producción del backend

---

## 9. Despliegue en Vercel — pasos

1. **Vercel → Add New → Project** → importar el repo `BorderCheck-AI_Frontend`.
2. **Root Directory = `frontend`** (Settings → General). Sin esto, Vercel no encuentra `package.json`.
   Framework preset: Vite (autodetectado). Build/Output los toma de `vercel.json`.
3. **Environment Variables** (Settings → Environment Variables), para *Production* y *Preview*:
   - `VITE_SUPABASE_URL` = `https://jdngmlwutcltdfmkwsag.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (la anon key del proyecto Supabase)
   - `VITE_API_BASE_URL` = *(dejar vacía por ahora ⇒ mock; setear cuando el backend esté desplegado)*
4. **Deploy.** Vercel buildea (`npm ci && npm run build`) y publica.
5. **Supabase → Authentication → URL Configuration**: agregar la URL de producción
   (`https://<proyecto>.vercel.app`) y, para que los previews funcionen con login,
   `https://*.vercel.app` en *Redirect URLs*; setear *Site URL* a la de producción.
6. **Verificar en el deploy**: abrir la consola del navegador y recorrer las páginas
   autenticadas (sobre todo `/reportes`). Si hay `Refused to …` de CSP, aflojar el
   directiva puntual en `frontend/vercel.json` y redeployar.
7. Cuando exista el backend: setear `VITE_API_BASE_URL`, sumar su origen al
   `connect-src` de la CSP, y pedir al colaborador que allowlistee el origen de
   Vercel en el CORS del backend.
