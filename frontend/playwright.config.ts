import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

/**
 * Dos suites:
 *
 *  - **Públicas** (`e2e/*.spec.ts`): carga, navegación y validación de
 *    formularios sin sesión. Corren siempre.
 *  - **Autenticadas** (`e2e/authenticated/*.spec.ts`): guardas de ruta por
 *    rol y vistas con sesión. Solo se agregan si están las credenciales de
 *    las cuentas dedicadas `e2e.*@bordercheck.test` (ver `.env.e2e.example`).
 *    El proyecto `setup` inicia sesión una vez por rol y guarda el
 *    `storageState` en `e2e/.auth/<rol>.json` (git-ignored).
 *
 * Requiere el binario del navegador: `npx playwright install chromium`.
 * Ejecutar: `npm run test:e2e` (o `npm run test:e2e:ui`).
 */

const env = loadEnv("e2e", process.cwd(), "");
const CREDS = [
  "E2E_CLIENTE_EMAIL",
  "E2E_CLIENTE_PASSWORD",
  "E2E_AGENTE_EMAIL",
  "E2E_AGENTE_PASSWORD",
  "E2E_ADMIN_EMAIL",
  "E2E_ADMIN_PASSWORD",
] as const;
// Gestor es opcional a propósito: todavía no existe la cuenta `e2e.gestor@`
// en Supabase. Si se exige junto a las demás, agregarla a CREDS bloquearía
// TODA la suite autenticada (incluidos cliente/agente/admin, que ya
// funcionan) hasta que alguien cree esa cuenta. Se resuelve solo, sin
// tocar este archivo de nuevo, en cuanto `.env.e2e` tenga las 2 variables.
const CREDS_GESTOR = ["E2E_GESTOR_EMAIL", "E2E_GESTOR_PASSWORD"] as const;

// `loadEnv` lee `.env` + `.env.e2e` (+ `.local`); las pasamos a `process.env`
// para que `auth.setup.ts` y los specs las usen.
for (const clave of [...CREDS, ...CREDS_GESTOR]) if (env[clave]) process.env[clave] = env[clave];
const hayCredsAuth = CREDS.every((clave) => process.env[clave]);

const chrome = { ...devices["Desktop Chrome"] };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    // Puerto propio del E2E (5173 lo usa el `npm run dev` manual): así el
    // servidor de pruebas siempre arranca fresco con el mock forzado y no
    // pisa ni reusa la sesión de desarrollo.
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "publicas",
      testMatch: "e2e/*.spec.ts",
      use: chrome,
    },
    ...(hayCredsAuth
      ? [
          {
            name: "setup",
            testMatch: "e2e/auth.setup.ts",
            use: chrome,
          },
          {
            name: "autenticadas",
            testMatch: "e2e/authenticated/**/*.spec.ts",
            dependencies: ["setup"],
            use: chrome,
          },
        ]
      : []),
  ],
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Fuerza el motor de reglas mock (`evaluarEnvioMock`) aunque el `.env`
      // local apunte a un backend: el E2E no debe depender de que el
      // servicio de reglas esté corriendo. `api.ts` usa el mock cuando
      // `VITE_API_BASE_URL` es vacío.
      VITE_API_BASE_URL: "",
      // Desactiva la "sesión única por cuenta" (ver AuthContext.tsx): reusar
      // un mismo storageState en muchos contextos de navegador distintos
      // hacía que supabase-js refrescara el token con session_id distintos
      // en cada uno, y la sesión única terminaba expulsando cuentas al azar
      // sin que nadie externo se haya logueado.
      VITE_E2E: "1",
    },
  },
});
