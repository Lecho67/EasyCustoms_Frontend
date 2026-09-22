import { test as setup } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Inicia sesión una vez por rol contra las cuentas dedicadas
 * `e2e.*@bordercheck.test` y guarda el `storageState` (localStorage con el
 * token de Supabase) en `e2e/.auth/<rol>.json`. Las specs autenticadas lo
 * reusan con `test.use({ storageState })` — no vuelven a pasar por el login.
 *
 * Este archivo solo se ejecuta si están las 6 variables `E2E_*` (ver
 * `playwright.config.ts`).
 */

const AUTH_DIR = "e2e/.auth";

const ROLES = [
  {
    nombre: "cliente",
    email: process.env.E2E_CLIENTE_EMAIL!,
    password: process.env.E2E_CLIENTE_PASSWORD!,
  },
  {
    nombre: "agente",
    email: process.env.E2E_AGENTE_EMAIL!,
    password: process.env.E2E_AGENTE_PASSWORD!,
  },
  {
    nombre: "admin",
    email: process.env.E2E_ADMIN_EMAIL!,
    password: process.env.E2E_ADMIN_PASSWORD!,
  },
];

for (const rol of ROLES) {
  setup(`autenticar ${rol.nombre}`, async ({ page }) => {
    mkdirSync(AUTH_DIR, { recursive: true });

    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(rol.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(rol.password);
    await page.locator('form button[type="submit"]').click();

    // Login.tsx navega a /dashboard cuando el AuthContext confirma la sesión.
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    await page.context().storageState({ path: `${AUTH_DIR}/${rol.nombre}.json` });
  });
}
