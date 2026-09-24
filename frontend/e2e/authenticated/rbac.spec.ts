import { test, expect } from "@playwright/test";

/**
 * Guardas de ruta de `ProtectedRoute`: un rol que entra a una ruta fuera de
 * su `allowedRoles` es redirigido a su ruta por defecto (`RUTA_POR_DEFECTO`),
 * nunca ve el contenido ni cae en `/login` teniendo sesión válida.
 *
 * La redirección es client-side (`<Navigate>`), así que la URL a la que se
 * navega aparece un instante antes del rebote: por eso las pruebas de "entra"
 * verifican el `<h1>` (señal estable de que la página renderizó) y las de
 * "redirige" usan `waitForURL` (espera la URL final, tolera la transitoria).
 */

// `AgentPanel` muestra un spinner a pantalla completa mientras carga la cola.
const H1_TIMEOUT = 15_000;
const NAV_TIMEOUT = 10_000;

// Cuenta e2e.gestor@ todavía no existe en Supabase (ver .env.e2e.example) —
// a diferencia de cliente/agente/admin, no bloquea el resto de la suite:
// este describe se saltea entero hasta que exista.
const hayGestor = !!(process.env.E2E_GESTOR_EMAIL && process.env.E2E_GESTOR_PASSWORD);

test.describe("cliente", () => {
  test.use({ storageState: "e2e/.auth/cliente.json" });

  test("entra a /dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /^Hola,/ })).toBeVisible({ timeout: H1_TIMEOUT });
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("/admin lo redirige a /dashboard", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL(/\/dashboard$/, { timeout: NAV_TIMEOUT });
    await expect(page.getByRole("heading", { name: "Panel de Administración" })).toBeHidden();
  });

  test("/panel-agente lo redirige a /dashboard", async ({ page }) => {
    await page.goto("/panel-agente");
    await page.waitForURL(/\/dashboard$/, { timeout: NAV_TIMEOUT });
  });

  test("/gestor lo redirige a /dashboard", async ({ page }) => {
    await page.goto("/gestor");
    await page.waitForURL(/\/dashboard$/, { timeout: NAV_TIMEOUT });
  });
});

test.describe("agente", () => {
  test.use({ storageState: "e2e/.auth/agente.json" });

  test("entra a /panel-agente", async ({ page }) => {
    await page.goto("/panel-agente");
    await expect(page.getByRole("heading", { name: "Cola de Revisión" })).toBeVisible({
      timeout: H1_TIMEOUT,
    });
    await expect(page).toHaveURL(/\/panel-agente$/);
  });

  test("entra a /panel-agente/kyc", async ({ page }) => {
    await page.goto("/panel-agente/kyc");
    await expect(
      page.getByRole("heading", { name: /Verificación de Identidad/i }),
    ).toBeVisible({ timeout: H1_TIMEOUT });
    await expect(page).toHaveURL(/\/panel-agente\/kyc$/);
  });

  test("/admin lo redirige a /panel-agente", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL(/\/panel-agente$/, { timeout: NAV_TIMEOUT });
  });
});

(hayGestor ? test.describe : test.describe.skip)("gestor", () => {
  test.use({ storageState: "e2e/.auth/gestor.json" });

  test("entra a /gestor", async ({ page }) => {
    await page.goto("/gestor");
    await expect(page.getByRole("heading", { name: "Mis clientes" })).toBeVisible({
      timeout: H1_TIMEOUT,
    });
    await expect(page).toHaveURL(/\/gestor$/);
  });

  test("entra a /reportes (gestor está en allowedRoles)", async ({ page }) => {
    await page.goto("/reportes");
    await expect(page.getByRole("heading", { name: "Reportes" })).toBeVisible({
      timeout: H1_TIMEOUT,
    });
    await expect(page).toHaveURL(/\/reportes$/);
  });

  test("/admin lo redirige a /gestor", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL(/\/gestor$/, { timeout: NAV_TIMEOUT });
  });

  test("/panel-agente lo redirige a /gestor", async ({ page }) => {
    await page.goto("/panel-agente");
    await page.waitForURL(/\/gestor$/, { timeout: NAV_TIMEOUT });
  });
});

test.describe("admin", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("entra a /admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Panel de Administración" })).toBeVisible({
      timeout: H1_TIMEOUT,
    });
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("entra a /panel-agente (admin está en allowedRoles)", async ({ page }) => {
    await page.goto("/panel-agente");
    await expect(page.getByRole("heading", { name: "Cola de Revisión" })).toBeVisible({
      timeout: H1_TIMEOUT,
    });
    await expect(page).toHaveURL(/\/panel-agente$/);
  });
});
