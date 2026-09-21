# Easy CUSTOMS — brief para portafolio

> Documento para pegar en otro chat (p. ej. mientras se arma la entrada de portafolio).
> Contiene el qué, el porqué, el stack, las decisiones técnicas y los puntos de venta,
> más caveats honestos para que el texto del portafolio no sobre-venda.

---

## 1. Qué es (elevator pitch)

**Easy CUSTOMS** es una plataforma web B2C de asesoría aduanera. Un usuario que
importa mercancía describe su envío internacional y la app le dice, en segundos, si
va a pasar la aduana: un veredicto **Apto / Advertencia / Bloqueado** con la
justificación legal, los documentos requeridos y un desglose estimado de tributos.
Suma un casillero virtual con pre-alertas de paquetes, verificación de identidad
(KYC) y un flujo de auditoría humana donde un agente puede revisar y corregir
cualquier veredicto de la IA.

**Una línea:** "Sabé si tu envío pasa la aduana antes de despacharlo — IA anclada a
normativa real, con revisión humana."

- **Demo en vivo:** https://easycustoms.vercel.app
- **Repo (frontend):** https://github.com/Lecho67/BorderCheck-AI_Frontend
- **Estado:** MVP funcional, en desarrollo activo.

---

## 2. El problema

Los envíos internacionales se retienen, devuelven o destruyen en aduana por
restricciones de transporte aéreo (baterías de litio, aerosoles, productos
regulados) que el remitente desconoce. Resolverlo manualmente toma días y genera
multas y costos evitables. BorderCheck se consume **antes del despacho**: no
reemplaza la operación logística, la protege.

---

## 3. Rol de Simon

- **Diseño e implementación completa del frontend** (React + TypeScript + Vite).
- **Modelo de datos y capa de seguridad en Supabase**: esquema, políticas RLS,
  funciones `SECURITY DEFINER` (RPCs), triggers.
- **Infra de calidad**: suite de tests (unitarios + componente + E2E), CI, auditoría
  de pre-despliegue, despliegue en Vercel.
- El **motor de reglas aduaneras** (Node/Express + inferencia de códigos HS con un
  LLM) lo mantiene un colaborador en un repo separado. El frontend está diseñado
  para funcionar de forma autónoma: si el motor no está disponible usa un mock
  determinístico, así que la demo desplegada funciona sin ese backend.

---

## 4. Stack técnico

| Área | Tecnología |
|---|---|
| Framework / build | React 18 + TypeScript (`strict`) + Vite 5 |
| Estilos | Tailwind CSS 3 |
| Ruteo | React Router 7 (code-splitting por ruta con `React.lazy`) |
| Estado | Zustand (caché puntual) + Context para sesión/perfil |
| Backend-as-a-Service | Supabase — Auth, PostgreSQL con RLS, Storage, Realtime |
| Gráficos / reportes | Recharts (vista nativa) + `powerbi-client` (embed) |
| Testing | Vitest + Testing Library (unit/componente), Playwright (E2E) |
| CI | GitHub Actions — lint + test + build en cada push y PR |
| Deploy | Vercel (SPA estático), `vercel.json` con rewrite + CSP + headers |

Comunicación con el motor de reglas: `POST {API_BASE_URL}/api/v1/shipments/evaluate`
(contrato REST tipado). Sin `API_BASE_URL` → mock local.

---

## 5. Funcionalidades

**Cliente**
- Asistente de evaluación de envíos (formulario tipado → request al motor de reglas).
- Vista de veredicto: badge de color, justificación con fuente normativa, checklist
  de documentos, desglose de tributos (arancel + flete + total).
- Historial de consultas (con búsqueda) y dashboard.
- Casillero virtual: código de casillero + pre-alertas de paquetes (CRUD).
- KYC: carga del documento de identidad; el casillero y la documentación quedan
  bloqueados hasta la aprobación.
- Cumplimiento normativo (Ley 1581 de 2012 de Colombia): aceptación de Términos y
  Habeas Data como gate.
- Centro de ayuda con FAQ (búsqueda + acordeón).
- Notificaciones en vivo (campana con contador + dropdown + toast, vía Supabase
  Realtime) y preferencias editables.

**Agente / Gestor / Admin (RBAC, 4 roles)**
- Cola de revisión de casos: filtros, orden, paginación; auditar un caso y
  **confirmar o sobrescribir** el veredicto de la IA con justificación obligatoria
  (operación atómica vía RPC, trazada).
- Revisión de documentos de envío y de verificaciones KYC (aprobar/rechazar con motivo).
- Panel de admin: gestión de usuarios y roles, asignación de gestores, métricas
  globales (total de consultas, tasa de aprobación, casos modificados por agente).
- Gestor: cartera de clientes asignados con su actividad.

---

## 6. Decisiones técnicas destacables (material para case study / entrevista)

**IA con guardrails, no generación libre.**
El modelo no responde en abierto: consulta una base de reglas normativas y **cada
veredicto cita su fuente legal**. Ante datos insuficientes no fuerza un "verde" por
defecto — marca el caso para revisión manual.

**Humano en el bucle, auditable.**
Todo veredicto de IA puede ser revisado por un agente. El override es una sola
operación atómica (RPC `SECURITY DEFINER`) que preserva el veredicto original real
y no cuenta una simple confirmación como "modificación" en las métricas. Cada
consulta queda trazada con su justificación e historial.

**Seguridad: RLS como frontera real, no el frontend.**
- La autorización de verdad vive en políticas Row-Level Security de PostgreSQL; el
  `ProtectedRoute` del frontend es solo UX.
- Se usó un helper `get_my_role()` `SECURITY DEFINER` para evitar la recursión
  infinita clásica de RLS sobre la propia tabla de perfiles.
- **Se encontró y corrigió una escalación de privilegios**: un usuario podía
  auto-asignarse `role: "admin"` o auto-aprobar su propio KYC vía la API REST.
  Se cerró con un trigger `SECURITY DEFINER` que bloquea la auto-edición de campos
  sensibles, verificado con pruebas `PATCH` reales.
- Aislamiento entre agentes por fila (un agente no ve ni modifica un caso asignado
  a otro), verificado con dos cuentas de prueba.
- El gating de KYC se refuerza en la base (`kyc_aprobado()` en las políticas de
  `INSERT`), no solo en la UI.

**Disciplina de testing.**
- ~137 tests unitarios/componente + ~32 E2E (Playwright), corriendo en CI.
- Los E2E autenticados **encontraron un bug real de carrera**: `ProtectedRoute`
  hacía una redirección irreversible en la ventana en que la sesión estaba cargada
  pero el perfil aún no; se documentó y corrigió con un test de regresión.
- Pruebas de seguridad (RLS) reproducibles con cuentas dedicadas.

**Despliegue endurecido.**
- Vercel estático con `vercel.json`: rewrite SPA, Content-Security-Policy
  (script-src `'self'`, connect-src acotado a Supabase REST + WebSocket de Realtime,
  frame-src solo Power BI), HSTS, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`.
- Se hizo una **auditoría de readiness pre-despliegue** documentada
  (`docs/DEPLOYMENT_READINESS.md`): build de producción, variables de entorno,
  migraciones, monitoreo, pipeline.
- Bundle inicial ~130 kB gzip; las librerías pesadas (Recharts, Power BI) quedan
  fuera de la carga inicial por code-splitting.

**Resiliencia de sesión.**
La carga del perfil reintenta con backoff, descarta respuestas obsoletas en
login/logout rápidos, y **no expulsa** al usuario ante un fallo transitorio de red
(muestra una pantalla de "Reintentar" en vez de mandarlo a `/login`).

---

## 7. Caveats honestos (para no sobre-vender en el portafolio)

- Es un **MVP en desarrollo activo**, no un producto en producción con usuarios reales.
- El **motor de reglas de IA es de un colaborador** y vive en otro repo; la demo
  desplegada corre contra un **mock determinístico**, no contra el LLM.
- Pendientes conocidos: el esquema de Supabase todavía no está versionado como
  migraciones; falta integrar monitoreo de errores (Sentry); el export a PDF no
  está implementado.
- El proyecto corre **100% en capas gratuitas** (Vercel Hobby, Supabase free).

---

## 8. Qué mostrar (capturas sugeridas)

1. Landing / pitch (hero + los 3 badges de veredicto).
2. El asistente de evaluación de envíos (formulario).
3. Una vista de veredicto: badge de color + justificación legal + desglose de tributos.
4. La cola de revisión del agente (tabla con filtros) + el drawer de auditoría de un caso.
5. El dashboard de métricas del admin (gráfico de volumen mensual).
6. El panel de aprobación de KYC.

---

## 9. Formato sugerido para el portafolio

**Blurb (card):**
> Plataforma B2C de asesoría aduanera con IA. React + TypeScript + Supabase.
> Evaluación de envíos con veredicto y justificación legal, casillero virtual, KYC,
> RBAC de 4 roles y auditoría humana de los veredictos de IA. RLS como capa de
> seguridad, ~170 tests, CI y despliegue endurecido en Vercel.

**Case study (secciones):** Problema → Solución → Mi rol → Stack → Decisiones
técnicas (IA con guardrails / humano en el bucle / seguridad RLS / testing) →
Resultados/aprendizajes → Caveats.

**Talking points para entrevista:**
- Por qué la autorización va en RLS y no en el frontend, y cómo se rompe la
  recursión con `SECURITY DEFINER`.
- La escalación de privilegios que se encontró y cómo se cerró.
- El bug de carrera que encontró el E2E y por qué el test unitario no lo veía.
- Cómo se diseñó el frontend para funcionar sin el backend (mock + contrato tipado).
