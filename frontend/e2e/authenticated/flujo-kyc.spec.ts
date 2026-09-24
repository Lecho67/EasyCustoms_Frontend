import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Flujo KYC de punta a punta: el cliente sube su documento de identidad
 * desde /verificar-identidad, un agente lo aprueba desde /panel-agente/kyc,
 * y el cliente ve el cambio reflejado sin depender de Realtime (recarga la
 * página, que igual es lo que vería un usuario real).
 *
 * Escribe de verdad en Supabase (profiles.kyc_status/kyc_document_path y un
 * archivo real en el bucket kyc-documents) con las cuentas dedicadas
 * e2e.cliente@/e2e.agente@bordercheck.test. No pasa por el motor de reglas,
 * así que no depende del mock.
 *
 * Determinista sin teardown: subirDocumentoIdentidad siempre pone
 * kyc_status en "pendiente" sin importar el estado anterior (es una
 * verificación nueva), así que correr esto repetidas veces no rompe nada.
 * Sí deja un archivo nuevo en el bucket en cada corrida (kycService.ts no
 * borra el anterior al reemplazar) — aceptable para una cuenta E2E
 * dedicada, no sería aceptable para una cuenta real.
 *
 * Dos browser contexts manuales (no `test.use`) porque el flujo necesita
 * cliente y agente en la MISMA prueba, cada uno con su propia sesión.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCUMENTO_FIXTURE = path.join(__dirname, "..", "fixtures", "documento-identidad.png");
const EMAIL_CLIENTE = "e2e.cliente@bordercheck.test";

test("cliente sube KYC, agente lo aprueba, cliente ve el cambio reflejado", async ({ browser }) => {
  test.slow();

  const clienteContext = await browser.newContext({ storageState: "e2e/.auth/cliente.json" });
  const cliente = await clienteContext.newPage();

  await cliente.goto("/verificar-identidad");
  await expect(cliente.getByRole("heading", { name: "Verificar identidad" })).toBeVisible();

  await cliente.getByLabel("Número de documento").fill(`E2E-${Date.now()}`);
  await cliente.getByRole("button", { name: "Guardar datos" }).click();
  await expect(cliente.getByText("Datos guardados correctamente")).toBeVisible({ timeout: 10_000 });

  await cliente.locator('input[type="file"]').setInputFiles(DOCUMENTO_FIXTURE);
  await expect(cliente.getByText("Documento recibido")).toBeVisible({ timeout: 15_000 });
  await expect(cliente.getByText("En revisión", { exact: true })).toBeVisible();

  // --- Agente revisa y aprueba ---
  const agenteContext = await browser.newContext({ storageState: "e2e/.auth/agente.json" });
  const agente = await agenteContext.newPage();

  await agente.goto("/panel-agente/kyc");
  await expect(agente.getByRole("heading", { name: /Verificación de Identidad/ })).toBeVisible();

  // El panel solo se refresca solo cada 30s; "Actualizar" fuerza el
  // refresh sin esperar. Filtro por email para no depender de que sea la
  // única verificación pendiente en la cola (otras cuentas de QA manual
  // pueden tener la suya).
  await agente.getByRole("button", { name: "Actualizar" }).click();
  await agente.getByLabel("Buscar").fill(EMAIL_CLIENTE);
  // El correo aparece 2 veces en la tarjeta (nombre completo cae al correo
  // cuando no hay full_name, más la línea de correo propiamente dicha).
  await expect(agente.getByText(EMAIL_CLIENTE).first()).toBeVisible({ timeout: 15_000 });

  await agente.getByRole("button", { name: "Aprobar" }).click();
  // No busca el email (el toast de éxito lo repite como subtítulo un
  // instante): la tarjeta sale de la lista, así que "Aprobar" desaparece.
  await expect(agente.getByRole("button", { name: "Aprobar" })).toHaveCount(0);

  await agenteContext.close();

  // --- El cliente ve el cambio reflejado ---
  await cliente.reload();
  await expect(cliente.getByText("Verificado", { exact: true })).toBeVisible({ timeout: 15_000 });

  await clienteContext.close();
});
