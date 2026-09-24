# Mejoras pendientes — Easy CUSTOMS (Frontend)

Registro vivo de mejoras identificadas, priorizadas. Cada entrada indica **qué es**,
**por qué importa**, **dónde toca** y si **necesita SQL** en Supabase.

> Convención de estado: ✅ hecho · 🔷 listo para tomar · ⏳ requiere decisión previa
>
> Para el estado de despliegue (host, CSP, migraciones, backfill) ver
> **`docs/DEPLOYMENT_READINESS.md`**.

---

## 0. Contexto — hecho recientemente

- UI de aprobación de KYC (`/panel-agente/kyc`) con RPCs `SECURITY DEFINER`.
- Gating del casillero por KYC (frontend + RLS en `pre_alerts`).
- Verificación de la "Política 3" del audit de RLS (aislamiento entre agentes).
- Limpieza de código muerto, ESLint 9, infra de tests (Vitest, 32 casos).
- `AuthContext`: reintento de carga de perfil, no expulsa al usuario ante fallo de red, canal Realtime sobre el perfil propio.
- Code-split de rutas con `React.lazy`.
- Integración continua (GitHub Actions) — ver punto 1.
- Bug de la dirección del casillero — ver punto 2.

---

## 1. Integración continua ✅

**Qué:** workflow de GitHub Actions (`.github/workflows/ci.yml`) que corre
`lint` + `test:run` + `build` en cada push a `main` y en cada pull request.

**Por qué:** hay 32 tests automatizados; sin CI nada garantiza que sigan
verdes tras un merge. Es la pieza que hace que la inversión en pruebas valga.

**Dónde:** `.github/workflows/ci.yml`. **SQL:** no.

---

## 2. Bug — dirección del casillero mostraba un literal ✅

**Qué:** `Locker.tsx` renderizaba el string literal `"Suite BC-{USER_ID}"`
(nunca se interpolaba) y lo copiaba roto al portapapeles. Ahora usa
`profile.locker_code` (`Suite <código>`), con fallback
"Suite pendiente de asignación" si el usuario aún no tiene código.

**Dónde:** `src/pages/Locker.tsx`. **SQL:** no.

---

## 3b. Login: recuperar contraseña ✅ · login con Google ⏳ oculto

**Qué:** `Login.tsx` se rediseñó con el sistema de diseño y suma
"¿Olvidaste tu contraseña?" (reutiliza `solicitarCambioContrasena` /
`/restablecer-contrasena`, funcionando).

**Google:** `signInWithGoogle()` ya está implementado en `AuthContext` (y
probado que compila/lintea), pero el botón está **oculto** en `Login.tsx`
hasta activar el proveedor. Evaluamos usar Firebase para esto y se descartó:
duplicaría el sistema de identidad (Supabase Auth ya sostiene RLS, Storage y
Realtime vía `auth.uid()`). Para habilitarlo:
1. Google Cloud Console → OAuth consent screen + credencial "Web application".
2. Redirect URI: `https://<proyecto>.supabase.co/auth/v1/callback`.
3. Supabase Dashboard → Authentication → Providers → Google → pegar Client ID/Secret.
4. Supabase Dashboard → Authentication → URL Configuration → agregar las URLs de `redirectTo` (`/dashboard` en dev y prod).
5. Volver a agregar el botón en `Login.tsx` (se sacó pero el código de `AuthContext` sigue ahí).
6. Verificar que el primer login con Google cree la fila en `profiles` (debería, vía el mismo trigger que usa el signup por email).

**Dónde:** `frontend/src/pages/Login.tsx`, `frontend/src/context/AuthContext.tsx`, `frontend/src/context/auth.ts`.

## 3. `git push` 🔷

Los commits de la sesión están solo en local (`main`). Falta `git push`
(y, si el equipo trabaja con PRs, moverlos a una rama).

---

## 4. Métricas de admin a una vista/RPC de Postgres ✅

**Qué:** la agregación se movió a la RPC `metricas_globales()`
(`SECURITY DEFINER`, solo admin) que devuelve `total_consultas`,
`aprobados`, `bloqueados` y `casos_por_agente`. `fetchMetricasGlobales`
ahora hace una sola llamada y solo calcula los porcentajes.

**Pendiente relacionado:** `casos_por_agente` sigue contando por
`overridden_by`, así que incluye las confirmaciones "Confirmar IA" hasta
que se aplique el § 5.

---

## 5. `overrideVerdict` atómico + "Confirmar IA" ✅

**Qué:** `overrideVerdict` (SELECT + UPDATE sin transacción) se reemplazó por
`revisarCaso`, que llama al RPC `SECURITY DEFINER` `revisar_caso()`: una sola
operación atómica, con el mismo filtro de fila que tenía la política RLS
(admin, o agente sin caso asignado o asignado a él).

**Cómo distingue confirmar de sobrescribir:** sin columna nueva — el RPC usa
`original_ai_verdict = coalesce(original_ai_verdict, ai_verdict)`. Una
confirmación (mismo veredicto) deja `original_ai_verdict = ai_verdict`; un
cambio real los deja distintos. `metricas_globales` cuenta "modificado" solo
cuando son distintos, así que "Confirmar IA" ya no infla `casos_por_agente`.

**De paso:** `fetchColaDeRevision` filtra `overridden_by is null`, así que un
caso ya confirmado o sobrescrito sale de la cola de revisión.

---

## 6. Gating de KYC para `/documentos` ✅

**Qué:** el "Centro de Documentación Aduanera" (`/documentos`) ahora tiene el
mismo gate que el casillero: `RequireCompliance` en la ruta + política
`insert_own_documents` con `AND public.kyc_aprobado()`. En estado `pendiente`,
`Documents.tsx` entra en modo lectura (banner, sin subir ni eliminar).

**De paso:** `RequireCompliance` ya no aplica a roles internos
(`agente`/`gestor`/`admin` pasan siempre) — evita bloquear al admin en
`/casillero` y `/documentos`.

---

## 7. Pruebas extremo a extremo (E2E) 🔷 · parcial

**Hecho — públicas:** Playwright en `frontend/e2e/` (`@playwright/test`,
`playwright.config.ts`, scripts `test:e2e` / `test:e2e:ui`). 12 casos que
cubren páginas públicas (carga, `<h1>`, sin errores de runtime, navegación
del navbar, validación del formulario de login).

**Hecho — autenticadas (guardas + solo lectura):** `e2e/authenticated/`.
Entorno decidido: **Supabase real + cuentas dedicadas `e2e.*@bordercheck.test`**
(descartables, separadas de las QA para poder pisar su estado). El proyecto
`setup` (`e2e/auth.setup.ts`) loguea una vez por rol y cachea el
`storageState` en `e2e/.auth/<rol>.json`. Se agregan a la corrida solo si
está `frontend/.env.e2e` (ver `.env.e2e.example`; setup en
`docs/PLAN_DE_PRUEBAS.md` § 7.1). 18 casos: RBAC de `ProtectedRoute` por rol
+ carga con sesión de `/dashboard`, `/historial`, `/perfil`,
`/consulta/nueva`, `/casillero` + wizard de envío → veredicto (motor de
reglas forzado al mock vía `webServer.env`, veredicto verde y ámbar) + alta y
baja de una pre-alerta en el casillero (escritura real; se limpia sola porque
la política DELETE de `pre_alerts` es permisiva para el dueño) + **flujo KYC
completo** (`flujo-kyc.spec.ts`): cliente sube documento desde
`/verificar-identidad`, agente lo aprueba desde `/panel-agente/kyc`, cliente
ve "Verificado" al recargar — escritura real (perfil + archivo en el bucket
`kyc-documents`), determinístico sin teardown porque subir un documento
nuevo siempre resetea `kyc_status` a `pendiente`.

**Bug de infra encontrado y arreglado (sesión 2026-09-23, diseño de
estrategia de tests):** la suite autenticada era flaky al azar entre
`agente`/`admin`/`cliente` — la app tiene "sesión única por cuenta" (última
gana, ver `docs/sql/limites-de-uso.sql`) y Playwright reusa un mismo
`storageState` cacheado en muchos contextos de navegador a lo largo de una
corrida; `autoRefreshToken` de supabase-js podía emitir un `session_id`
nuevo en cada contexto sin pasar por `registrar_sesion()` (eso solo corre en
`signIn()`), así que la sesión única terminaba peleando contra sí misma y
expulsando cuentas sin que nadie externo se haya logueado. Fix: nueva var
`VITE_E2E` (seteada en `playwright.config.ts` `webServer.env`) que
`AuthContext.tsx` usa para saltarse ese efecto — no toca producción. De
paso se limpiaron ~30 sesiones viejas acumuladas en `auth.sessions` para
`e2e.agente@`/`e2e.admin@` (`docs/sql/diagnostico-sesion-e2e-agente-admin.sql`
y `fix-sesion-e2e-agente-admin.sql`) que agravaban el problema. Verificado
con 5+ corridas completas seguidas, 100% determinista.

**Pendiente — necesitan más que la infra actual:**
- **Veredicto → historial guardado en `customs_queries`** y **revisión/override
  de un caso desde `/panel-agente`** (`revision-agente.spec.ts`): el mock del
  motor de reglas no escribe en `customs_queries`, así que no hay forma de
  sembrar un caso real en la cola desde el propio E2E. Necesitan una
  service-role key en `.env.e2e` para insertar/borrar filas por corrida.
- **Aislamiento de datos entre clientes** (`aislamiento-datos.spec.ts`): cliente
  A no debería poder ver `/consulta/:id` de cliente B —
  `queryHistoryService.fetchConsultaById`/`fetchConsultas` hacen `select("*")`
  sin filtrar por `user_id`, así que hoy depende 100% de RLS, sin ningún test
  que lo verifique. Mismo bloqueo: necesita sembrar una fila real (service-role
  key) o una segunda cuenta cliente dedicada.
- **Cartera de gestor** ✅ código listo, 🔷 falta la cuenta. `rbac.spec.ts`
  ya tiene 4 casos de gestor (`/gestor`, `/reportes`, redirecciones desde
  `/admin` y `/panel-agente`); `auth.setup.ts` y `playwright.config.ts` ya
  saben levantar la sesión si `E2E_GESTOR_EMAIL/PASSWORD` están en
  `.env.e2e` (opcional a propósito — sin esas 2 variables, esos 4 casos
  quedan `skipped` sin afectar al resto de la suite). Falta un solo paso
  manual: crear `e2e.gestor@bordercheck.test` en Supabase con rol `gestor`
  (`docs/PLAN_DE_PRUEBAS.md` § 7.1) y completar las 2 variables — en cuanto
  eso exista, los 4 casos corren solos, sin tocar código.

**CI:** el E2E **no corre en CI** todavía (requiere guardar las credenciales
`e2e.*` como secretos). El `ci.yml` sigue siendo solo `lint` + `test:run` + `build`.

---

## 8. Ampliar cobertura de tests unitarios/componente 🔷 · servicios completos

Hecho: todos los servicios de datos tienen test (`kycReviewService`,
`adminService`, `agentService` completo — `revisarCaso`/`tomarCaso`/
`fetchColaDeRevision` —, `documentReviewService`, `preAlertService`),
`AuthContext.test.tsx` (reintento con backoff, descarte de respuestas
obsoletas, no borra el perfil ante un refresh fallido, canal Realtime) y
`useFocusTrap`. Helper compartido `src/test/supabaseQueryMock.ts` para
mockear los query builders encadenables de supabase-js. **61 tests en 12
archivos.**

Falta cubrir:
- Componentes: `NewQuery`, `ResultView`, `Locker`, `Documents`, paneles de agente/admin, pasos del wizard.
- Automatizar las pruebas de RLS (runner que autentique cada cuenta QA contra la API REST).

Ver `docs/PLAN_DE_PRUEBAS.md` § 10 para el detalle.

---

## 9. Centro de notificaciones ✅ (frontend) · parcial (backend)

**Hallazgo:** la tabla `notifications` **ya existía** en Supabase (la armó el
colaborador de backend) con `id, user_id, tipo, titulo, mensaje, leida,
created_at`, RLS correcta (`user_id = auth.uid()`), y **dos triggers ya
funcionando**: `trg_paquete_recibido` → `notify_paquete_recibido()` y
`trg_veredicto_aduana` → `notify_veredicto_aduana()`. El `CHECK` limita
`tipo` a `paquete_recibido` / `aprobado_aduana` / `impuesto_pendiente`.
Nunca se conectó al frontend.

**Hecho:** `src/lib/notificationService.ts` + `NotificationBell` en el
`Navbar` (campanita con contador de no leídas, dropdown, marcar
leída/todas, Realtime sobre `notifications` filtrado por `user_id`, toast
al llegar una nueva). Se agregó `notifications` a la publicación
`supabase_realtime`. Tests: `notificationService.test.ts`,
`NotificationBell.test.tsx`.

**Pendiente (necesita coordinar con el backend):**
- No hay trigger para `impuesto_pendiente` todavía.
- No hay tipo para "KYC resuelto" — el `CHECK` no lo permite; agregarlo es
  seguro (`alter ... drop constraint` + re-add ampliado, 0 filas, no rompe
  nada) pero conviene avisar al colaborador.
- `canal_whatsapp_sms` (entrega por SMS/WhatsApp) sigue fuera de alcance —
  requiere un proveedor externo.
- ~~Sin UI para editar `notification_preferences`~~ ✅ — `NotificationPreferencesCard`
  en `/perfil` con toggles para los 3 tipos in-app. `canal_whatsapp_sms` queda
  fuera de la UI hasta que exista la entrega por SMS/WhatsApp.

---

## 9b. Backfill de `customs_queries.ai_verdict` ✅ · aplicado

**Qué era:** `api.ts` guardaba el `nivel` de color (`verde`/`amarillo`/`rojo`)
en `ai_verdict` en vez del veredicto del motor. Roto en el código (ya
arreglado) **y** en las 49 filas viejas — la cola de agentes, las métricas
de admin y los reportes las contaban mal (`/reportes` mostraba 5% de
aprobación en vez de ~45%).

**Aplicado** (SQL Editor, proyecto de producción):
1. Se desactivó `trg_veredicto_aduana` durante el `update` para no disparar
   notificaciones (verificado después: 0 notificaciones creadas).
2. `update` con `case`: `verde → APROBADO`, `rojo → BLOQUEO`, `amarillo →
   REQUIERE_DOCUMENTACION` si `raw_response->>'titulo' ilike '%document%'`,
   si no `PRECAUCION`. (De 16 `amarillo`: 14 → REQUIERE_DOCUMENTACION, 2 → PRECAUCION.)
3. Se reactivó el trigger (`tgenabled = 'O'`).

Resultado: `APROBADO 25 · REQUIERE_DOCUMENTACION 15 · PRECAUCION 4 · BLOQUEO 11`
(55 total, cero `verde/amarillo/rojo`).

## 10. Deuda técnica

| Ítem | Detalle |
|---|---|
| `react-router` 6.30.6 | Vulnerabilidad de open-redirect (moderada); el parche está en react-router 7 (migración major). Ver `docs/PLAN_DE_PRUEBAS.md` no aplica; correr como tarea propia. |
| `vite` 5 / `vitest` 2 | La advisory del dev-server de esbuild solo se resuelve subiendo a vite 8 + vitest 5 (majors). Sin superficie en producción; hacerlo deliberadamente, no con `npm audit fix --force`. |
| ~~`frontend/dist/assets/Reports-*.js` (~622 kB)~~ ✅ | `Reports.tsx` cargaba `NativeReportsView` (recharts) y `PowerBiEmbed` (powerbi-client) juntos aunque solo una pestaña se ve a la vez. Se separaron con `React.lazy`: entrar a `/reportes` ahora solo baja `NativeReportsView` (384 kB / 112 kB gz); `PowerBiEmbed` (236 kB / 41 kB gz) se carga recién al abrir esa pestaña. Ya no queda ningún chunk sobre 500 kB. |
| `frontend/tsconfig.tsbuildinfo` versionado | Artefacto de build; debería estar en `.gitignore`. |
| Warning de lint en `AuthContext` | Resuelto — `useAuth` se movió a `src/hooks/useAuth.ts`. |

---

## 11. UX / accesibilidad

- **Foco en modales y drawers ✅.** Hook compartido `useFocusTrap`
  (`src/hooks/useFocusTrap.ts`, con test propio) aplicado en `Modal`,
  `KycModal`, `CasoRevisionCard` y el drawer móvil del `Navbar`: enfoca el
  primer elemento al abrir, cicla Tab/Shift+Tab sin escapar del contenedor,
  y devuelve el foco a lo que estaba activo antes al cerrar. De paso:
  `KycModal` y `CasoRevisionCard` ahora cierran con Escape (ya lo tenía
  `Modal`) y el `✕` de `CasoRevisionCard` pasó a `<X>` de lucide.
- **`AgentKycPanel`:** ✅ ahora se refresca solo cada 30s y al volver el foco
  a la pestaña, más un botón "Actualizar" manual. **No usa Realtime a
  propósito:** la política RLS de SELECT de agente sobre `profiles` solo
  cubre clientes con un caso (`customs_queries`) asignado o sin asignar; un
  cliente que recién sube su KYC sin haber hecho ninguna consulta no
  entraría por ahí, así que una suscripción `postgres_changes` se perdería
  esos casos en silencio. Polling sobre el RPC (que sí es `SECURITY
  DEFINER` y los ve a todos) evita ese hueco.
- **Filtros / orden / paginación en las colas de agente ✅.**
  `AgentKycPanel` (búsqueda por nombre/correo/documento, filtro por tipo de
  documento, orden por antigüedad) y `AgentDocumentsPanel` (búsqueda por
  cliente/archivo, filtro por asignación —sin asignar / asignadas a mí—,
  orden por fecha). Ambas paginan en cliente de a 8 con el hook compartido
  `usePagination` + el componente `ui/Pagination`. La barra de filtros
  reusa el patrón visual de `AgentPanel` (`rounded-xl border bg-slate-50`).

---

## 12. Brechas de producto/normativa en el veredicto (audit comercio exterior)

Del audit de un experto en comercio exterior + product manager (sesión
2026-09-23) sobre si el wizard y el veredicto resuelven el problema real del
importador persona natural en Colombia. Detalle completo (matriz de brechas,
RICE) en la conversación de esa sesión — acá solo el resumen accionable.

**Hecho:**
- **Tope de minimis ✅.** El motor ya calculaba
  `tax_estimation.de_minimis_threshold_exceeded/value` pero se descartaba en
  `mapDecisionResultToDiagnostico` — nunca llegaba a la UI. Ahora
  `DiagnosticoEnvio.deMinimis` lo trae y `TaxBreakdownCard` lo muestra como
  primer dato ("¿tu envío queda libre de impuestos o no?").
- **Disclaimer legal ✅.** `ResultView.tsx` deja explícito que el resultado es
  una estimación con IA, no una liquidación oficial de la DIAN.
- **Régimen declarado ✅.** `VerdictCard` le confirma al usuario la modalidad
  y el transporte que declaró (no afirma cómo el motor evalúa cada régimen
  puertas adentro, solo refleja el dato que el propio usuario envió).

**Pendiente — necesitan verificar algo externo antes de tocar código (no son
solo cambios de UI):**
- **Base de cálculo FOB vs. CIF.** `TaxBreakdownCard` dice "no incluye el
  costo de transporte", lo que sugiere que el arancel se calcula sobre el
  valor del producto solo (FOB), no sobre costo+seguro+flete (CIF). Hay que
  confirmar con el backend real (repo del colaborador) qué base usa antes de
  aclarar esto en la UI — afirmar la base incorrecta sería peor que no decir
  nada.
- **Conversión a COP con la TRM usada.** Todo el flujo es en USD
  (`currency: "USD"` fijo en `shipmentMapping.ts`); el usuario piensa y paga
  en pesos. Requiere decidir una fuente de tasa de cambio (API externa o
  manual) — implica una decisión de infraestructura nueva, no solo de copy.
- **Producto nuevo vs. usado.** No existe el campo en `WizardFormData`.
  Bajo valor si el backend no tiene todavía una regla que lo use — coordinar
  primero con el colaborador de backend antes de agregarlo al wizard.
- **Checklist de documentos por categoría.** `inferDocumentosRequeridos`
  (`shipmentMapping.ts`) solo detecta 4 substrings fijos en el texto de las
  alertas (DGD, MSDS, certificado fitosanitario, receta) — no cubre INVIMA,
  ICA, licencias de importación DIAN, etc. Necesita una base de conocimiento
  categoría→requisito verificada contra fuente oficial, no otro regex.
- **Comparador de modalidades de envío.** No existe ninguna función que
  compare el resultado del mismo ítem bajo distintas modalidades (regalo
  personal vs. envío comercial, por ejemplo). Alto esfuerzo — depende de que
  primero exista claridad de bajo qué régimen se evalúa cada modalidad.
- **Estados vacío/carga/error** poco pulidos en varios paneles.
