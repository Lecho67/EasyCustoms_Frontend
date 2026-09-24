import { test, expect, type Page } from "@playwright/test";

/**
 * Flujo: el cliente completa el wizard de envío y llega al veredicto.
 *
 * El motor de reglas está forzado al mock (`evaluarEnvioMock`) vía
 * `webServer.env` en `playwright.config.ts`, así que el resultado es
 * determinístico: una descripción de ropa cae en "Tu envío puede pasar sin
 * problema" (verde).
 *
 * El mock NO escribe en `customs_queries` (solo el backend real lo hace), así
 * que este flujo no deja filas y no necesita teardown. La parte
 * "veredicto -> historial" con persistencia real queda pendiente hasta tener
 * limpieza por corrida (service-role key).
 */

test.use({ storageState: "e2e/.auth/cliente.json" });

async function elegirSelect(page: Page, triggerActual: string | RegExp, opcion: string) {
  await page.getByRole("button", { name: triggerActual }).first().click();
  await page.getByPlaceholder("Buscar...").fill(opcion);
  await page.getByRole("option", { name: opcion, exact: true }).click();
}

async function siguiente(page: Page) {
  await page.getByRole("button", { name: "Siguiente" }).click();
}

/** Del paso 4 (baterías) al 8 (otras mercancías peligrosas) respondiendo
 * "No" en cada pregunta Sí/No, hasta dejar visible "Evaluar envío". */
async function responderNoHastaElFinal(page: Page) {
  for (let i = 0; i < 4; i++) {
    await siguiente(page);
  }
}

test("el wizard de envío llega a un veredicto", async ({ page }) => {
  // El wizard por pasos encadena muchas más interacciones (5 selects + 7
  // "Siguiente"/submit) que el formulario de una sola página que reemplazó;
  // el timeout default de 30s queda justo bajo 3 workers en paralelo.
  test.slow();

  const errores: string[] = [];
  page.on("pageerror", (err) => errores.push(String(err)));

  await page.goto("/consulta/nueva");
  await expect(page.locator("form")).toBeVisible();

  // Paso 1 — Logística
  await elegirSelect(page, "País de origen", "Estados Unidos");
  await elegirSelect(page, "Tipo de transporte", "Aéreo");
  await elegirSelect(page, "Modalidad de envío", "Envío personal / regalo");
  await siguiente(page);

  // Paso 2 — Destino y producto (el país de destino está fijo en Colombia,
  // ya no es un select)
  await page
    .getByPlaceholder("Ej. Audífonos inalámbricos con estuche de carga")
    .fill("Camiseta de algodón, regalo personal");
  await siguiente(page);

  // Paso 3 — Detalles del envío
  await page.getByLabel("Peso (kg) *").fill("1.5");
  await page.getByLabel("Valor declarado (USD) *").fill("40");
  await siguiente(page);

  // Pasos 4-8 — declaraciones especiales, todas "No"
  await responderNoHastaElFinal(page);

  await page.getByRole("button", { name: "Evaluar envío" }).click();

  // El mock demora ~3s y navega a /consulta/:id
  await page.waitForURL(/\/consulta\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await expect(page.getByText("Tu envío puede pasar sin problema")).toBeVisible();
  await expect(page.getByText("Guardado en tu historial")).toBeVisible();
  await expect(page.getByRole("button", { name: /Ver historial/ })).toBeVisible();

  expect(errores, errores.join("\n")).toEqual([]);
});

test("una descripción con batería de litio pide documentación (veredicto ámbar)", async ({
  page,
}) => {
  test.slow();

  await page.goto("/consulta/nueva");

  await elegirSelect(page, "País de origen", "México");
  await elegirSelect(page, "Tipo de transporte", "Aéreo");
  await elegirSelect(page, "Modalidad de envío", "Envío comercial");
  await siguiente(page);

  await page
    .getByPlaceholder("Ej. Audífonos inalámbricos con estuche de carga")
    .fill("Power bank con batería de litio de 20000 mAh");
  await siguiente(page);

  await page.getByLabel("Peso (kg) *").fill("0.4");
  await page.getByLabel("Valor declarado (USD) *").fill("35");
  await siguiente(page);

  await responderNoHastaElFinal(page);

  await page.getByRole("button", { name: "Evaluar envío" }).click();

  await page.waitForURL(/\/consulta\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await expect(page.getByText("Puedes enviarlo, pero falta un documento")).toBeVisible();
});
