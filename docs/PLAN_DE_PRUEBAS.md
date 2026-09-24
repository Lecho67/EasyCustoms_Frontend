# Plan de Pruebas — Easy CUSTOMS (Frontend)

| | |
|---|---|
| **Proyecto** | Easy CUSTOMS — cliente web |
| **Componente** | `frontend/` (React + TypeScript + Vite) |
| **Backend bajo prueba** | Supabase (Auth, PostgreSQL con RLS, Storage, Realtime). El motor de reglas aduaneras es un servicio externo y queda fuera de alcance salvo por el contrato de `POST /api/v1/shipments/evaluate`. |
| **Versión del documento** | 1.0 |

---

## 1. Objetivos

- Verificar que la lógica de control de acceso (autenticación, roles, cumplimiento normativo) se comporta según lo especificado.
- Verificar que las reglas de seguridad a nivel de fila (RLS) de Supabase impiden accesos y modificaciones no autorizadas.
- Verificar la traducción de datos entre el asistente de consulta y el contrato del motor de reglas.
- Dejar una base de pruebas automatizadas que corra en cada cambio y detecte regresiones.

## 2. Alcance

### Dentro de alcance

- Guardas de ruta y de cumplimiento (`ProtectedRoute`, `RequireCompliance`).
- Flujo KYC: carga por el cliente, revisión por agente/admin, gating del casillero.
- Aislamiento entre agentes sobre `customs_queries` y `documents` (RLS "Política 3").
- Escalación de privilegios sobre `profiles` (trigger `prevent_self_privilege_escalation`).
- Mapeo `WizardFormData → ShipmentEvaluationRequest` y `DecisionEngineResult → DiagnosticoEnvio`.
- Utilidades puras (`verdictBadge`, `countryCodes`).
- Resiliencia de la carga de perfil ante fallos de red.
- Actualización en vivo del perfil vía Realtime.

### Fuera de alcance

- El motor de reglas aduaneras (repositorio de backend separado).
- Inferencia de códigos HS por IA (Ollama).
- Integración con Power BI (solo se verifica que la ruta carga).
- Pruebas de carga / rendimiento.
- Pruebas de compatibilidad entre navegadores.

## 3. Estrategia y niveles de prueba

| Nivel | Descripción | Herramienta | Estado |
|---|---|---|---|
| Unitarias | Funciones puras: mapeos, utilidades. | Vitest | Automatizado |
| Componente | Componentes React con dependencias mockeadas (`useAuth`). | Vitest + Testing Library | Automatizado |
| Servicios | Servicios de datos con el cliente Supabase mockeado. | Vitest | Automatizado |
| Integración / seguridad (RLS) | Peticiones REST reales contra la API de Supabase con distintas cuentas. | `fetch` desde consola del navegador | Manual, registrado |
| Extremo a extremo (E2E) | Páginas públicas + guardas de ruta por rol y vistas con sesión (cuentas `e2e.*` dedicadas). | Playwright | Automatizado (autenticadas requieren `.env.e2e`) |

## 4. Entorno y herramientas

- **Node.js** 20+, **npm**.
- **Vitest 2** + **jsdom** + **@testing-library/react** + **@testing-library/jest-dom**.
  - Configuración: bloque `test` en `frontend/vite.config.ts`.
  - Setup: `frontend/src/test/setup.ts` (matchers de jest-dom, `cleanup` tras cada test).
  - Los tests usan imports explícitos de `vitest` (sin globals).
- **Cuentas QA permanentes en Supabase** (una por rol, dos de agente para aislamiento):
  - `cliente.prueba@bordercheck.test`
  - un gestor, un admin
  - `agente.prueba@bordercheck.test`, `agente2.prueba@bordercheck.test`
- **Pruebas de RLS:** `fetch` contra `https://<proyecto>.supabase.co/rest/v1/...` con cabeceras `apikey` (anon key de `frontend/.env`) y `Authorization: Bearer <access_token>` tomado de `localStorage['sb-<ref>-auth-token']`.

## 5. Criterios

- **Entrada:** el código compila (`npm run build`), sin errores de ESLint (`npm run lint`).
- **Salida:** el 100 % de los casos automatizados pasa (`npm run test:run`); los casos manuales de seguridad tienen resultado registrado.
- **Aceptación de un cambio:** no introduce regresiones en la suite automatizada; todo caso nuevo de seguridad relevante queda cubierto por un test o registrado como caso manual.

## 6. Casos de prueba automatizados

Ejecutar con `npm run test:run` desde `frontend/`. Total: **136 casos en 27 archivos**.
El entorno de tests toma sus variables de `frontend/.env.test` (valores dummy, commiteado).
El detalle por archivo de abajo cubre los primeros 24; los 3 más nuevos son
`hooks/usePagination.test.ts` (4), `components/ui/Pagination.test.tsx` (4) y
`pages/AgentDocumentsPanel.test.tsx` (8), más los casos que se sumaron a
`AgentKycPanel.test.tsx` (filtros/orden/paginación) y `ProtectedRoute.test.tsx` (PR-07).
Los tests que mockean el query builder de `supabase.from(...)` usan el
helper compartido `src/test/supabaseQueryMock.ts` (un stub encadenable:
`select`/`eq`/`in`/`is`/`order`/`update`/`insert`/`delete`/`single`, y
`then` para que el builder mismo sea "awaitable" cuando el código no llama
a `.single()`).

### 6.1 `src/lib/countryCodes.test.ts` — 2 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| CC-01 | Etiqueta de país conocida | Devuelve `{ alpha2, alpha3 }` correctos |
| CC-02 | Etiqueta sin configurar | Lanza error explícito |

### 6.2 `src/lib/verdictBadge.test.ts` — 2 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| VB-01 | Veredictos conocidos (APROBADO/BLOQUEO/PRECAUCION/REQUIERE_DOCUMENTACION) | Cada uno mapea a su paleta |
| VB-02 | Valor desconocido | Usa `slate` como fallback |

### 6.3 `src/lib/shipmentMapping.test.ts` — 12 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| SM-01 | Mapeo base de países y valores por defecto | `origin_country`/`destination_country` en ISO alpha-2; moneda USD; `has_hazmat_content=false` |
| SM-02 | Peso ≤ 0 | Lanza error de peso |
| SM-03 | Sin valor declarado | Lanza error de valor declarado |
| SM-04 | HS code con formato válido | Se incluye y `hs_code_confidence = "declared_by_user"` |
| SM-05 | HS code con formato inválido | `hs_code` indefinido, `hs_code_confidence = null` |
| SM-06 | Batería de litio declarada | `has_hazmat_content=true` y `lithium_battery` poblado |
| SM-07 | `final_status: APROBADO` | Nivel `verde`, título "Apto para envío", resumen menciona el país |
| SM-08 | `final_status: BLOQUEO` con alerta crítica | Nivel `rojo`, justificación = descripción de la alerta |
| SM-09 | Impuestos con porcentaje estimado (valor 100, 10 %) | `arancel=10`, `flete=8`, `total=18` |
| SM-10 | Valor declarado 0 | `desgloseImpuestos = null` |
| SM-11 | Alerta con texto "certificado fitosanitario" | `documentosRequeridos` incluye "Certificado fitosanitario" |
| SM-12 | Falta `paisDestino` / `paisOrigen` | Error amigable ("El país de destino es obligatorio."), no el error técnico de `getCountryInfo` |

### 6.4 `src/lib/kycReviewService.test.ts` — 6 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| KS-01 | `fetchKycPendientes` con datos | Llama al RPC `listar_kyc_pendientes` y devuelve las filas |
| KS-02 | `fetchKycPendientes` sin datos | Devuelve `[]` |
| KS-03 | `fetchKycPendientes` con error | Lanza el mensaje del RPC |
| KS-04 | `revisarKyc` aprobar | Llama `revisar_kyc` con `p_motivo: null` |
| KS-05 | `revisarKyc` rechazar con motivo | Llama `revisar_kyc` con el motivo |
| KS-06 | `revisarKyc` con error | Propaga el mensaje del RPC |

### 6.4b `src/lib/api.test.ts` — 2 casos

Backend real mockeado (`fetch`, sesión, `insert`). El `.env.test` fuerza el camino "backend real" (no el mock).

| ID | Descripción | Resultado esperado |
|---|---|---|
| API-01 | Consulta con éxito | Guarda en `customs_queries` con `ai_verdict = final_status` del motor (no el `nivel` de color) |
| API-02 | El motor responde error | Propaga el mensaje; **no** guarda nada |

### 6.5 `src/components/RequireCompliance.test.tsx` — 5 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| RC-01 | Términos aceptados + KYC aprobado | Renderiza el contenido del casillero |
| RC-02 | Faltan los términos | Bloquea con encabezado "aceptar los términos" |
| RC-03 | KYC `no_iniciado` | Bloquea con encabezado "verificá tu identidad" |
| RC-04 | KYC `rechazado` | Bloquea con encabezado "fue rechazada" |
| RC-05 | KYC `pendiente` | Deja pasar (el modo lectura lo aplica `Locker`) |

### 6.6 `src/components/ProtectedRoute.test.tsx` — 7 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| PR-01 | `loading = true` | Muestra spinner |
| PR-02 | Sin usuario | Redirige a `/login` |
| PR-03 | Usuario + perfil válidos | Renderiza el contenido protegido |
| PR-04 | Usuario sin perfil + `profileError` | Muestra pantalla "Reintentar", **no** redirige a login |
| PR-05 | Rol no permitido | Redirige a la home del rol |
| PR-06 | Rol permitido | Renderiza el contenido protegido |
| PR-07 | `allowedRoles` + perfil aún cargando (sin error) | Muestra spinner y **espera** — no hace `<Navigate>` (evita el rebote irreversible por la carrera `loading=false / profile=null` de `AuthContext`) |

### 6.7 `src/lib/adminService.test.ts` — 3 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| AD-01 | RPC `metricas_globales` con datos | Mapea el resultado y calcula los porcentajes |
| AD-02 | Sin consultas (`total_consultas: 0`) | No divide por cero; porcentajes en `0` |
| AD-03 | RPC con error | Propaga el mensaje |

### 6.8 `src/lib/agentService.test.ts` — 2 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| AG-01 | `revisarCaso` | Llama al RPC `revisar_caso` con `p_caso_id`/`p_veredicto`/`p_motivo` |
| AG-02 | `revisarCaso` con error | Propaga el mensaje del RPC |

### 6.9 `src/context/AuthContext.test.tsx` — 5 casos

Monta el `AuthProvider` real con Supabase mockeado (sesión, `profiles`, canal Realtime) y un componente de arnés que expone `profile`/`loading`/`profileError`/`refreshProfile`.

| ID | Descripción | Resultado esperado |
|---|---|---|
| AC-01 | Carga exitosa en el primer intento | `profile` con los datos; `single()` llamado 1 vez |
| AC-02 | `PGRST116` (perfil inexistente) | `profileError` seteado; **no** reintenta (`single()` 1 vez) |
| AC-03 | Error transitorio en el 1er intento, éxito en el 2do | Termina con el perfil cargado; `single()` llamado 2 veces |
| AC-04 | Un `refreshProfile()` posterior agota los 3 reintentos | `profileError` seteado, pero el perfil previo **se conserva** (no se borra) |
| AC-05 | Sesión activa | Abre un canal `perfil:<uid>` con `postgres_changes` filtrado por `id=eq.<uid>` |

### 6.10 `src/hooks/useFocusTrap.test.tsx` — 4 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| FT-01 | Se activa | Enfoca el primer elemento focuseable del contenedor |
| FT-02 | Tab desde el último elemento | Vuelve al primero (no escapa del contenedor) |
| FT-03 | Shift+Tab desde el primero | Va al último |
| FT-04 | Se desactiva | Devuelve el foco a lo que estaba activo antes de abrir |

### 6.11 `src/lib/preAlertService.test.ts` — 5 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| PA-01 | `fetchMisPreAlertas` con datos | Devuelve las filas |
| PA-02 | `fetchMisPreAlertas` con error | Lanza el mensaje |
| PA-03 | `crearPreAlerta` sin sesión | Lanza "No hay sesión activa" sin llamar a `from` |
| PA-04 | `crearPreAlerta` con sesión | Inserta con `user_id` de la sesión y `status: "pendiente"` |
| PA-05 | `eliminarPreAlerta` con error | Lanza el mensaje |

### 6.12 `src/lib/documentReviewService.test.ts` — 6 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| DR-01 | `fetchDocumentosPendientes` con datos | Devuelve las filas (con el cliente) |
| DR-02 | `fetchDocumentosPendientes` con error | Lanza el mensaje |
| DR-03 | `obtenerUrlDocumentoParaRevision` | Devuelve la URL firmada |
| DR-04 | `obtenerUrlDocumentoParaRevision` con error | Lanza el mensaje |
| DR-05 | `tomarDocumento` ya tomado (`data: null`) | Lanza "Este documento ya fue tomado por otro agente" |
| DR-06 | `tomarDocumento` disponible | Asigna `assigned_agent_id` al agente de la sesión |

### 6.13 `src/lib/agentService.test.ts` (ampliado) — 3 casos nuevos (5 en total)

| ID | Descripción | Resultado esperado |
|---|---|---|
| AG-03 | `fetchColaDeRevision` | Filtra por `ai_verdict in (...)` y `overridden_by is null` |
| AG-04 | `tomarCaso` ya tomado (`data: null`) | Lanza "Este caso ya fue tomado por otro agente" |
| AG-05 | `tomarCaso` disponible | Asigna `assigned_agent_id` al agente de la sesión |

(AG-01/02 — `revisarCaso` — ya en § 6.8.)

### 6.14 `src/pages/AgentKycPanel.test.tsx` — 6 casos

`KycReviewCard` se mockea (se prueba por separado); el foco es la
orquestación de carga/refresco de la página.

| ID | Descripción | Resultado esperado |
|---|---|---|
| KP-01 | Carga inicial | Muestra las verificaciones pendientes |
| KP-02 | Sin pendientes | Estado vacío |
| KP-03 | Error de carga | Muestra el mensaje |
| KP-04 | Botón "Actualizar" | Vuelve a pedir la lista |
| KP-05 | `onResuelto` de una tarjeta | La saca de la lista |
| KP-06 | Polling (fake timers, +30s) | Vuelve a pedir la lista automáticamente |

### 6.15 `src/lib/notificationService.test.ts` — 5 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| NS-01 | `fetchNotificaciones` | `order('created_at', desc)` + `limit(50)`; devuelve las filas |
| NS-02 | `fetchNotificaciones` sin datos | Devuelve `[]` |
| NS-03 | `fetchNotificaciones` con error | Lanza el mensaje |
| NS-04 | `marcarComoLeida` | `update({ leida: true })` + `eq('id', ...)` |
| NS-05 | `marcarTodasComoLeidas` | `update({ leida: true })` + `eq('leida', false)` |

### 6.16 `src/components/layout/NotificationBell.test.tsx` — 6 casos

`notificationService` y el canal de `supabase` se mockean.

| ID | Descripción | Resultado esperado |
|---|---|---|
| NB-01 | Sin sesión | No renderiza nada |
| NB-02 | Con notificaciones | Badge con la cantidad de no leídas |
| NB-03 | Clic en la campana | Abre el panel y lista las notificaciones |
| NB-04 | Clic en una notificación | `marcarComoLeida`, el badge baja |
| NB-05 | "Marcar todas como leídas" | `marcarTodasComoLeidas`, el badge desaparece |
| NB-06 | Sin notificaciones | Estado vacío |

### 6.17 `src/components/profile/NotificationPreferencesCard.test.tsx` — 4 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| NP-01 | Sin perfil | No renderiza nada |
| NP-02 | Con preferencias guardadas | Los checkboxes reflejan los valores |
| NP-03 | Sin preferencias (`null`) | Usa defaults (todo activo) |
| NP-04 | Destildar una opción | Guarda el valor invertido y llama a `refreshProfile` |

### 6.18 `src/pages/Locker.test.tsx` — 5 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| LK-01 | Perfil con `locker_code` | Muestra "Suite &lt;código&gt;" |
| LK-02 | Sin `locker_code` | Muestra "Suite pendiente de asignación" |
| LK-03 | KYC `pendiente` | Banner, botón de pre-alertar deshabilitado, sin editar/eliminar |
| LK-04 | KYC `aprobado` | Botón habilitado, acciones visibles, sin banner |
| LK-05 | Sin pre-alertas | Estado vacío |

### 6.19 `src/pages/Documents.test.tsx` — 3 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| DC-01 | KYC `pendiente` | Banner, `<label>` de subida con `aria-disabled`, sin botón de eliminar |
| DC-02 | KYC `aprobado` | Sin banner, subida activa (`for="upload-doc"`), botón de eliminar visible |
| DC-03 | Sin documentos | Estado vacío |

### 6.20 `src/pages/NewQuery.test.tsx` — 3 casos

`ShipmentForm`, `evaluarEnvio`, el store y `useNavigate` se mockean.

| ID | Descripción | Resultado esperado |
|---|---|---|
| NQ-01 | Envío con éxito | `addConsulta(diagnostico)` + `navigate('/consulta/:id')` |
| NQ-02 | Envío con error | Banner de error; no navega |
| NQ-03 | Mientras evalúa | Muestra el esqueleto de carga |

### 6.21 `src/pages/ResultView.test.tsx` — 5 casos

Las tarjetas de veredicto se mockean.

| ID | Descripción | Resultado esperado |
|---|---|---|
| RV-01 | Consulta cacheada en el store | Renderiza sin llamar a `fetchConsultaById` |
| RV-02 | No cacheada, existe | La busca por id, `addConsulta`, la renderiza |
| RV-03 | No cacheada, no existe | "No encontramos esta consulta" |
| RV-04 | Botones de acción | Navegan a `/dashboard/historial` y `/consulta/nueva` |
| RV-05 | Botón "Exportar PDF" | Está `disabled` (feature no implementada) |

### 6.22 `src/components/admin/AdminUserTable.test.tsx` — 5 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| AU-01 | Carga | Renderiza las filas de usuarios |
| AU-02 | Cambiar el `<select>` de rol | Abre el modal "Confirmar cambio"; **no** llama a `actualizarRol` |
| AU-03 | Rol nuevo = `admin` | El modal muestra la advertencia de control total |
| AU-04 | "Cancelar" | Cierra el modal sin llamar al servicio |
| AU-05 | "Confirmar" | `actualizarRol(userId, rol)` y cierra el modal |

### 6.23 `src/pages/AgentPanel.test.tsx` — 5 casos

`useAuth`, `fetchColaDeRevision` y `CasoRevisionCard` se mockean.

| ID | Descripción | Resultado esperado |
|---|---|---|
| AP-01 | Carga | Renderiza los casos y el contador "X de Y" |
| AP-02 | Cola vacía | Estado vacío |
| AP-03 | Filtro por país | Reduce la tabla y actualiza el contador |
| AP-04 | "Limpiar filtros" | Restaura la lista completa |
| AP-05 | "Auditar caso" | Abre el drawer de revisión |

### 6.24 `src/components/ShipmentForm.test.tsx` — 4 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| SF-01 | Enviar con campos obligatorios vacíos | No llama a `onSubmit`; muestra los errores de validación |
| SF-02 | `isSubmitting` | Botón deshabilitado + "Evaluando envío..." |
| SF-03 | Clic en un chip de categoría | Rellena el campo Categoría |
| SF-04 | Marcar "Contiene batería de litio" | Despliega los sub-campos |

## 6.bis. E2E — páginas públicas (Playwright)

`frontend/e2e/`, ejecutar con `npm run test:e2e` (requiere `npx playwright
install chromium` una vez). Playwright levanta el dev server solo. **12
casos, solo rutas sin login** — se descartó pegarle a Supabase real con las
cuentas QA para no ensuciar datos de producción.

### `e2e/public-pages.spec.ts` — 8 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| E-PP-01..06 | `/`, `/pitch`, `/herramientas`, `/soporte`, `/login`, `/registro` | Cargan y muestran su `<h1>`; sin errores de runtime (`pageerror`) |
| E-PP-07 | `/landing` | Renderiza un `<h1>` |
| E-PP-08 | Navegación por el navbar | Va a `/herramientas` y vuelve a `/` sin recargar |

### `e2e/login.spec.ts` — 4 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| E-LG-01 | Enviar el form vacío | No navega; el `<input>` de correo queda `:invalid` |
| E-LG-02 | "¿Olvidaste tu contraseña?" | Cambia a "Recuperar contraseña" y vuelve |
| E-LG-03 | Pestaña "Crear cuenta" | Aparece el campo "Nombre completo" |
| E-LG-04 | Link desde `/registro` | Vuelve a `/login` |

## 6.ter. E2E — flujos autenticados (Playwright)

`frontend/e2e/authenticated/`. Se agregan a la corrida **solo si están las 6
variables `E2E_*`** (ver `frontend/.env.e2e.example`); sin ellas `npm run
test:e2e` corre nada más la suite pública. El proyecto `setup`
(`e2e/auth.setup.ts`) inicia sesión una vez por rol contra las cuentas
dedicadas `e2e.*@bordercheck.test` y guarda el `storageState` en
`e2e/.auth/<rol>.json` (git-ignored); cada spec lo reusa con
`test.use({ storageState })`.

**Cuentas dedicadas, no las QA:** las `e2e.*` son descartables — los tests
pueden pisar su estado. Setup en § 7.1.

### `e2e/authenticated/rbac.spec.ts` — 9 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| E-RB-01 | cliente → `/dashboard` | Entra; ve "Hola, …" |
| E-RB-02..04 | cliente → `/admin`, `/panel-agente`, `/gestor` | Redirige a `/dashboard` (nunca ve el contenido) |
| E-RB-05..06 | agente → `/panel-agente`, `/panel-agente/kyc` | Entra |
| E-RB-07 | agente → `/admin` | Redirige a `/panel-agente` |
| E-RB-08 | admin → `/admin` | Entra; ve "Panel de Administración" |
| E-RB-09 | admin → `/panel-agente` | Entra (`admin` está en `allowedRoles`) |

### `e2e/authenticated/vistas-cliente.spec.ts` — 5 casos

| ID | Descripción | Resultado esperado |
|---|---|---|
| E-VC-01..03 | cliente en `/dashboard`, `/dashboard/historial`, `/perfil` | Cargan con sesión, sin `pageerror`, no rebota a `/login` |
| E-VC-04 | cliente en `/consulta/nueva` | Muestra el `<form>` de envío |
| E-VC-05 | cliente en `/casillero` (KYC aprobado) | `RequireCompliance` lo deja pasar; ve "Mi Casillero" |

### `e2e/authenticated/flujo-consulta.spec.ts` — 2 casos

Motor de reglas forzado al **mock** (`webServer.env: { VITE_API_BASE_URL: "" }`
en `playwright.config.ts`) para que el veredicto sea determinístico. El mock
**no** escribe en `customs_queries`, así que no deja filas ni necesita teardown.

| ID | Descripción | Resultado esperado |
|---|---|---|
| E-FC-01 | Wizard completo, descripción de ropa ("Camiseta de algodón…") | Navega a `/consulta/:id`; ve "Apto para envío" + "Guardado en tu historial" |
| E-FC-02 | Wizard completo, descripción con batería de litio ("Power bank…") | Ve "Requiere documentación adicional" (veredicto ámbar) |

### `e2e/authenticated/flujo-casillero.spec.ts` — 1 caso

Escritura real, **self-cleaning** (la política DELETE de `pre_alerts` es
permisiva para el dueño, no hace falta service-role key). `afterEach` barre
las filas de prueba que hayan quedado de una corrida interrumpida.

| ID | Descripción | Resultado esperado |
|---|---|---|
| E-CA-01 | cliente (KYC aprobado) crea una pre-alerta desde `/casillero`, la ve en la lista y la borra | La fila aparece con `carrier — tracking`; tras confirmar el borrado desaparece |

### `e2e/authenticated/flujo-kyc.spec.ts` — 1 caso

Escritura real (perfil + archivo en el bucket `kyc-documents`), sin
teardown: subir un documento nuevo siempre resetea `kyc_status` a
`pendiente` sin importar el estado previo, así que correrlo repetidas veces
no depende de en qué quedó la corrida anterior. Usa dos `browser.newContext`
manuales (cliente y agente) dentro del mismo test.

| ID | Descripción | Resultado esperado |
|---|---|---|
| E-KYC-01 | Cliente sube tipo/número/foto de documento en `/verificar-identidad`; agente lo aprueba desde `/panel-agente/kyc`; cliente recarga | Badge pasa de "En revisión" a "Verificado" |

Pendiente (necesita service-role key en `.env.e2e` para sembrar/borrar
filas): veredicto → historial con persistencia real en `customs_queries`,
override de un caso desde `/panel-agente` (`revision-agente.spec.ts`),
aislamiento de datos entre clientes — cliente A no debería poder ver
`/consulta/:id` de cliente B, y `queryHistoryService.ts` hoy depende 100%
de RLS para eso, sin test que lo verifique (`aislamiento-datos.spec.ts`).

Pendiente aparte (no es de teardown): cobertura RBAC de gestor ya está en
código (`rbac.spec.ts`, ver abajo) y en `.env.e2e.example`/§ 7.1 — falta
que exista la cuenta `e2e.gestor@` en Supabase para que la suite `setup`
la levante. Hasta entonces `hayCredsAuth` da `false` y el proyecto
`autenticadas` completo (los 3 roles existentes incluidos) sigue sin correr.

## 7. Casos de prueba manuales (seguridad / integración)

### 7.1. Setup de las cuentas `e2e.*` (una vez)

1. Supabase → **Authentication → Users → Add user** (con contraseña, "Auto
   Confirm"): `e2e.cliente@`, `e2e.agente@`, `e2e.admin@`, `e2e.gestor@bordercheck.test`.
2. SQL Editor:
   ```sql
   update public.profiles set role = 'agente' where email = 'e2e.agente@bordercheck.test';
   update public.profiles set role = 'admin'  where email = 'e2e.admin@bordercheck.test';
   update public.profiles set role = 'gestor' where email = 'e2e.gestor@bordercheck.test';

   update public.profiles
   set kyc_status = 'aprobado',
       terms_accepted_at = now(),
       habeas_data_accepted_at = now()
   where email = 'e2e.cliente@bordercheck.test';
   ```
   Opcional: para que `/gestor` no muestre la cartera vacía, asignarle el
   cliente E2E — `update public.profiles set gestor_id = (select id from
   auth.users where email = 'e2e.gestor@bordercheck.test') where email =
   'e2e.cliente@bordercheck.test';`. No hace falta para que el test pase
   (el `<h1>Mis clientes</h1>` se ve igual con cartera vacía).
3. `cp frontend/.env.e2e.example frontend/.env.e2e` y completar las 4 contraseñas.
4. `cd frontend && npm run test:e2e` — ahora corre pública + `setup` + autenticadas.

### 7.2. Casos manuales

Registrados durante el desarrollo. Reproducibles con las cuentas QA y `fetch` desde consola.

| ID | Área | Pasos | Resultado esperado | Resultado |
|---|---|---|---|---|
| M-KYC-01 | KYC RPC | Como agente: `rpc('listar_kyc_pendientes')` | 200 con los clientes en estado `pendiente` | ✅ |
| M-KYC-02 | KYC RPC | Como agente: `rpc('revisar_kyc', { p_estado: 'aprobado' })` | 200, fila con `kyc_status = 'aprobado'` | ✅ |
| M-KYC-03 | KYC RPC | Como agente: rechazar sin `p_motivo` | 400 "El rechazo requiere un motivo" | ✅ |
| M-KYC-04 | KYC RPC | Como cliente: cualquiera de los dos RPC | 400 "No autorizado" | ✅ |
| M-KYC-05 | Storage | Como agente: `createSignedUrl` sobre `kyc-documents` | Devuelve URL firmada | ✅ |
| M-KYC-06 | Gating UI | Cliente con KYC `no_iniciado`/`rechazado` entra a `/casillero` | Pantalla de bloqueo, redirige a `/perfil` | ✅ |
| M-KYC-07 | Gating UI | Cliente con KYC `pendiente` entra a `/casillero` | Casillero en modo lectura (banner ámbar, sin pre-alertar/editar/eliminar) | ✅ |
| M-KYC-08 | Gating RLS | Cliente con KYC `pendiente`: `POST /pre_alerts` | 403 "violates row-level security policy" | ✅ |
| M-KYC-09 | Gating RLS | Cliente con KYC `aprobado`: `POST /pre_alerts` | 201, crea la fila | ✅ |
| M-RLS-01 | Aislamiento de agentes | Agente A toma un caso; agente B hace `PATCH` sobre ese caso | 200 `[]` (cero filas modificadas) | ✅ |
| M-RLS-02 | Aislamiento de agentes | Agente B hace `GET` del caso asignado a A | `[]` (no lo ve) | ✅ |
| M-RLS-03 | Escalación de privilegios | Cliente hace `PATCH /profiles` sobre su fila poniendo `role: 'admin'` | 400 con mensaje del trigger | ✅ |
| M-RLS-04 | Escalación de privilegios | Cliente hace `PATCH /profiles` sobre su fila poniendo `kyc_status: 'aprobado'` | 400 con mensaje del trigger | ✅ |
| M-AUTH-01 | Resiliencia de perfil | Con sesión activa, bloquear el dominio de Supabase y navegar a una ruta con rol | Pantalla "No pudimos cargar tu perfil / Reintentar"; **no** expulsa a `/login` | ✅ |
| M-AUTH-02 | Resiliencia de perfil | Desbloquear y pulsar "Reintentar" | Carga el perfil y la ruta | ✅ |
| M-RT-01 | Realtime | Pestaña A: cliente en `/perfil`. Pestaña B: agente aprueba/rechaza su KYC | El badge de KYC en la pestaña A cambia sin recargar (~1 s) | ✅ |

## 8. Pruebas de seguridad (RLS) — resumen

| Superficie | Regla verificada | Método |
|---|---|---|
| `profiles` (UPDATE propio) | Un no-admin no puede cambiar su `role`, `gestor_id`, ni poner `kyc_status` distinto de `pendiente` (trigger `prevent_self_privilege_escalation`). | `fetch` PATCH → 400 |
| `profiles` (revisión KYC) | Solo `agente`/`admin` pueden aprobar/rechazar, y solo vía los RPC `SECURITY DEFINER` (`listar_kyc_pendientes`, `revisar_kyc`). El guard usa `coalesce(get_my_role(), '')` para no fallar abierto ante `NULL`. | `rpc` con cada rol |
| `customs_queries` / `documents` (UPDATE de agente) | `get_my_role() = 'admin' OR (get_my_role() = 'agente' AND (assigned_agent_id IS NULL OR assigned_agent_id = auth.uid()))`. | `fetch` PATCH con 2 cuentas agente |
| `pre_alerts` (INSERT) | `auth.uid() = user_id AND public.kyc_aprobado()`. | `fetch` POST con KYC aprobado / pendiente |
| Storage `kyc-documents` | `agente`/`admin` incluidos en `kyc_own_folder_select`; el resto solo su propia carpeta. | `createSignedUrl` con cada rol |

## 9. Resumen de ejecución

| Suite | Casos | Estado |
|---|---|---|
| Automatizados (Vitest) | 136 | ✅ 136/136 |
| E2E — páginas públicas (Playwright) | 12 | ✅ 12/12 |
| E2E — flujos autenticados (Playwright) | 17 (+3 `setup`) | ✅ 17/17 con `.env.e2e` (§ 7.1) |
| Manuales de seguridad | 17 | ✅ 17/17 |

Comandos: `cd frontend && npm run test:run` (unit) · `npm run test:e2e` (E2E).

## 10. Riesgos y deuda de pruebas

- **E2E autenticado: guardas de ruta, vistas de solo lectura, wizard→veredicto (mock) y crear/borrar pre-alerta ✅ (32/32 con `.env.e2e`); flujos con persistencia más pesada pendientes.** `e2e/authenticated/` cubre RBAC (`ProtectedRoute`), la carga con sesión de las vistas del cliente, el wizard de envío hasta el veredicto (motor de reglas forzado al mock), y el alta+baja de una pre-alerta en el casillero (escritura real self-cleaning). Encontró y verificó el fix de la carrera de `ProtectedRoute` (rebote irreversible con `loading=false / profile=null`). Falta lo que necesita teardown más pesado: veredicto → historial persistido, carga de KYC → aprobación de agente → casillero, revisión/override de un caso — necesitan una service-role key en `.env.e2e`.
- **Cobertura de componentes.** Todas las páginas y componentes con lógica están cubiertos. Sin cubrir (bajo valor): wrappers finos (`AdminPanel`, `GestorPanel`), componentes de solo presentación (`ui/`, tarjetas de veredicto), y los `Step*` del wizard (superados por `ShipmentForm`).
- **RLS sin automatizar.** Las pruebas de seguridad son manuales; un cambio de política podría regresionar sin que la suite lo note. Automatizarlas requiere un runner que autentique cada cuenta QA contra la API REST.
- **`buildShipmentEvaluationRequest`:** la validación `!wizardData.paisOrigen` es inalcanzable porque `getCountryInfo("")` lanza antes con otro mensaje. No es un defecto funcional pero conviene limpiarlo.

## 11. Procedimiento de ejecución

```bash
cd frontend
npm install
npm run lint        # 0 errores, 0 warnings
npm run test:run    # 136/136 (unit + componente)
npm run build       # compila sin warnings de tamaño

# E2E (una vez): descargar el navegador
npx playwright install chromium
npm run test:e2e    # 12/12 (públicas); + 17 autenticadas si existe .env.e2e (§ 7.1)
```

Pruebas manuales de RLS: ver `CLAUDE.md` → "Preferencias de trabajo (Simon)" y "Bugs y decisiones ya resueltas" para el detalle de cuentas y helpers de consola.
