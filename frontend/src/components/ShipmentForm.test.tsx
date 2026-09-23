import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShipmentForm } from "./ShipmentForm";
import { sugerirHsCode } from "@/lib/api";

// ShipmentForm dispara sugerirHsCode() directamente (no vía prop) al pasar
// del Paso 2 al 3 — sin mockear @/lib/api estos tests harían un fetch real
// a VITE_API_BASE_URL (http://localhost:3000 en .env.test).
vi.mock("@/lib/api", () => ({
  sugerirHsCode: vi.fn(),
}));

const sugerirHsCodeMock = vi.mocked(sugerirHsCode);

beforeEach(() => {
  sugerirHsCodeMock.mockReset().mockResolvedValue({ status: "error" });
});

function setup(isSubmitting = false) {
  const onSubmit = vi.fn();
  render(<ShipmentForm onSubmit={onSubmit} isSubmitting={isSubmitting} />);
  return { onSubmit };
}

async function elegirSelect(
  user: ReturnType<typeof userEvent.setup>,
  triggerActual: string | RegExp,
  opcion: string
) {
  await user.click(screen.getAllByRole("button", { name: triggerActual })[0]);
  await user.click(screen.getByRole("button", { name: opcion }));
}

/** Completa los pasos 1 a 3 con datos válidos (sin declaraciones especiales)
 * y deja el wizard parado en el paso 4. */
async function completarLogisticaYProducto(user: ReturnType<typeof userEvent.setup>) {
  await elegirSelect(user, "Selecciona un país", "Estados Unidos");
  await elegirSelect(user, "Selecciona una opción", "Aéreo");
  await elegirSelect(user, "Selecciona una opción", "Envío personal / regalo");
  await user.click(screen.getByRole("button", { name: "Siguiente" }));

  await user.type(
    screen.getByPlaceholderText("Ej. Audífonos inalámbricos con estuche de carga"),
    "Camiseta de algodón"
  );
  await user.click(screen.getByRole("button", { name: "Siguiente" }));

  await user.type(screen.getByLabelText("Peso (kg) *"), "1.5");
  await user.type(screen.getByLabelText("Valor declarado (USD) *"), "40");
  await user.click(screen.getByRole("button", { name: "Siguiente" }));
}

/** Desde el paso 4 (las 4 declaraciones especiales, todas en "No" por
 * default) avanza al paso 5 — como ya no son pasos separados, alcanza con
 * un solo "Siguiente" para llegar al último paso. */
async function responderNoHastaElFinal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Siguiente" }));
}

describe("ShipmentForm — navegación por pasos", () => {
  it("arranca en el paso 1 de 5 y no muestra el botón Anterior", () => {
    setup();
    expect(screen.getByText("Paso 1 de 5")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anterior" })).not.toBeInTheDocument();
  });

  it("bloquea 'Siguiente' en el paso 1 y muestra los errores del paso", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByText("Paso 1 de 5")).toBeInTheDocument();
    expect(screen.getByText("Selecciona un país de origen.")).toBeInTheDocument();
    expect(screen.getByText("Selecciona un tipo de transporte.")).toBeInTheDocument();
    expect(screen.getByText("Selecciona una modalidad de envío.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("al avanzar a un paso nuevo no muestra errores de campos que todavía no se tocaron", async () => {
    const user = userEvent.setup();
    setup();

    await elegirSelect(user, "Selecciona un país", "Estados Unidos");
    await elegirSelect(user, "Selecciona una opción", "Aéreo");
    await elegirSelect(user, "Selecciona una opción", "Envío personal / regalo");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByText("Paso 2 de 5")).toBeInTheDocument();
    expect(screen.queryByText("Selecciona un país de destino.")).not.toBeInTheDocument();
    expect(screen.queryByText("Describe el producto.")).not.toBeInTheDocument();
  });

  it("el botón 'Evaluar envío' solo aparece en el último paso", async () => {
    const user = userEvent.setup();
    setup();

    expect(screen.queryByRole("button", { name: /evaluar envío/i })).not.toBeInTheDocument();

    await completarLogisticaYProducto(user);
    await responderNoHastaElFinal(user);

    expect(screen.getByText("Paso 5 de 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /evaluar envío/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Siguiente" })).not.toBeInTheDocument();
  });

  it("'Anterior' vuelve al paso previo sin perder los datos ya escritos", async () => {
    const user = userEvent.setup();
    setup();

    await elegirSelect(user, "Selecciona un país", "Estados Unidos");
    await elegirSelect(user, "Selecciona una opción", "Aéreo");
    await elegirSelect(user, "Selecciona una opción", "Envío personal / regalo");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    await user.click(screen.getByRole("button", { name: "Electrónica" }));
    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(screen.getByText("Paso 1 de 5")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByPlaceholderText("Ej. Electrónica")).toHaveValue("Electrónica");
  });

  it("completa el wizard entero y envía el WizardFormData al final", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await completarLogisticaYProducto(user);
    await responderNoHastaElFinal(user);

    await user.click(screen.getByRole("button", { name: /evaluar envío/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const enviado = onSubmit.mock.calls[0][0];
    expect(enviado.paisOrigen).toBe("Estados Unidos");
    expect(enviado.paisDestino).toBe("Colombia");
    expect(enviado.descripcionItem).toBe("Camiseta de algodón");
    expect(enviado.pesoKg).toBe(1.5);
    expect(enviado.valorDeclaradoUsd).toBe(40);
  });

  it("mientras evalúa, el botón final queda deshabilitado y con el texto de carga", async () => {
    const user = userEvent.setup();
    setup(true);

    await completarLogisticaYProducto(user);
    await responderNoHastaElFinal(user);

    const boton = screen.getByRole("button", { name: /evaluando envío/i });
    expect(boton).toBeDisabled();
  });
});

describe("ShipmentForm — paso 2 (destino y producto)", () => {
  it("un chip de categoría rellena el campo Categoría", async () => {
    const user = userEvent.setup();
    setup();

    await elegirSelect(user, "Selecciona un país", "Estados Unidos");
    await elegirSelect(user, "Selecciona una opción", "Aéreo");
    await elegirSelect(user, "Selecciona una opción", "Envío personal / regalo");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    await user.click(screen.getByRole("button", { name: "Electrónica" }));

    expect(screen.getByPlaceholderText("Ej. Electrónica")).toHaveValue("Electrónica");
  });
});

describe("ShipmentForm — declaraciones especiales por paso", () => {
  it("responder 'Sí' en baterías despliega los sub-campos y los valida", async () => {
    const user = userEvent.setup();
    setup();

    await completarLogisticaYProducto(user);

    expect(screen.getByText("Paso 4 de 5")).toBeInTheDocument();
    expect(screen.queryByText("Tipo de batería")).not.toBeInTheDocument();

    // Las 4 declaraciones especiales conviven en el mismo paso, así que hay
    // 4 pares de botones "Sí"/"No" en pantalla — se acota al grupo de
    // baterías por su aria-label (ver YesNoToggle/DeclarationBlock).
    const grupoBateria = screen.getByRole("group", {
      name: "¿Tu envío contiene baterías de litio?",
    });
    await user.click(within(grupoBateria).getByRole("button", { name: "Sí" }));
    expect(screen.getByText("Tipo de batería")).toBeInTheDocument();

    // Sin elegir el tipo, "Siguiente" debe quedarse en el paso 4.
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Paso 4 de 5")).toBeInTheDocument();
    expect(screen.getByText("Selecciona el tipo de batería.")).toBeInTheDocument();

    await elegirSelect(user, "Selecciona un tipo", "Litio-ion");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Paso 5 de 5")).toBeInTheDocument();
  });

  it("las 4 declaraciones especiales viven en el mismo paso", async () => {
    const user = userEvent.setup();
    setup();

    await completarLogisticaYProducto(user);

    expect(screen.getByText("Paso 4 de 5")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "¿Tu envío contiene baterías de litio?" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "¿Contiene líquidos, geles o aerosoles?" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "¿Es un producto orgánico o biológico?" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "¿Es un medicamento o producto médicamente regulado?" })
    ).toBeInTheDocument();
  });

  it("responder 'No' no exige sub-campos y avanza directo", async () => {
    const user = userEvent.setup();
    setup();

    await completarLogisticaYProducto(user);
    const grupoBateria = screen.getByRole("group", {
      name: "¿Tu envío contiene baterías de litio?",
    });
    await user.click(within(grupoBateria).getByRole("button", { name: "No" }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByText("Paso 5 de 5")).toBeInTheDocument();
  });
});

describe("ShipmentForm — paso 5 (otras mercancías peligrosas)", () => {
  it("sigue permitiendo selección múltiple sin pregunta Sí/No", async () => {
    const user = userEvent.setup();
    setup();

    await completarLogisticaYProducto(user);
    await responderNoHastaElFinal(user);

    expect(screen.getByText("Paso 5 de 5")).toBeInTheDocument();
    const gasComprimido = screen.getByLabelText("Gas comprimido");
    await user.click(gasComprimido);
    expect(gasComprimido).toBeChecked();
  });
});

async function llegarAPaso2(user: ReturnType<typeof userEvent.setup>) {
  await elegirSelect(user, "Selecciona un país", "Estados Unidos");
  await elegirSelect(user, "Selecciona una opción", "Aéreo");
  await elegirSelect(user, "Selecciona una opción", "Envío personal / regalo");
  await user.click(screen.getByRole("button", { name: "Siguiente" }));
}

describe("ShipmentForm — sugerencia de HS code (Paso 2 -> Paso 3)", () => {
  it("dispara sugerirHsCode con descripción y categoría al salir del Paso 2, sin bloquear el avance", async () => {
    const user = userEvent.setup();
    setup();

    await llegarAPaso2(user);
    await user.click(screen.getByRole("button", { name: "Electrónica" }));
    await user.type(
      screen.getByPlaceholderText("Ej. Audífonos inalámbricos con estuche de carga"),
      "audífonos inalámbricos"
    );
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    // El avance a Paso 3 no espera la promesa (sugerirHsCode nunca se resuelve
    // sincrónicamente) — si esto pasa, es porque no se bloqueó la navegación.
    expect(screen.getByText("Paso 3 de 5")).toBeInTheDocument();
    expect(sugerirHsCodeMock).toHaveBeenCalledWith("audífonos inalámbricos", "Electrónica");
  });

  it("mientras la sugerencia está en curso, deshabilita el campo y muestra el indicador de carga", async () => {
    let resolver: (v: Awaited<ReturnType<typeof sugerirHsCode>>) => void = () => {};
    sugerirHsCodeMock.mockReset().mockReturnValue(
      new Promise((r) => {
        resolver = r;
      })
    );
    const user = userEvent.setup();
    setup();

    await llegarAPaso2(user);
    await user.type(
      screen.getByPlaceholderText("Ej. Audífonos inalámbricos con estuche de carga"),
      "cargador USB-C"
    );
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByText("Generando...")).toBeInTheDocument();
    const hsInput = screen.getByPlaceholderText("Generando sugerencia...");
    expect(hsInput).toBeDisabled();

    resolver({
      status: "success",
      hsCode: "854370",
      hsDescription: "Aparato eléctrico",
      confidence: 0.85,
      possibleHazmat: false,
    });

    await waitFor(() => expect(hsInput).not.toBeDisabled());
    expect(hsInput).toHaveValue("854370");
    expect(screen.getByText("Sugerido por IA")).toBeInTheDocument();
  });

  it("no sobreescribe un HS code que el usuario ya escribió a mano", async () => {
    sugerirHsCodeMock.mockResolvedValueOnce({ status: "error" });
    const user = userEvent.setup();
    setup();

    // Primer paso por el wizard: sin sugerencia, el usuario escribe su
    // propio código en el Paso 3.
    await llegarAPaso2(user);
    await user.type(
      screen.getByPlaceholderText("Ej. Audífonos inalámbricos con estuche de carga"),
      "producto genérico"
    );
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    const hsInput = await screen.findByPlaceholderText("Ej. 851762");
    await user.type(hsInput, "123456");

    // Vuelve al Paso 2, cambia la descripción (dispara una NUEVA sugerencia,
    // esta vez con resultado) y avanza de nuevo.
    await user.click(screen.getByRole("button", { name: "Anterior" }));
    sugerirHsCodeMock.mockResolvedValueOnce({
      status: "success",
      hsCode: "999888",
      hsDescription: "Otra cosa",
      confidence: 0.7,
      possibleHazmat: false,
    });
    const descripcion = screen.getByPlaceholderText(
      "Ej. Audífonos inalámbricos con estuche de carga"
    );
    await user.type(descripcion, " actualizado");
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    await waitFor(() => expect(sugerirHsCodeMock).toHaveBeenCalledTimes(2));
    // El valor manual sigue ahí — la sugerencia que llegó después no lo pisó.
    expect(screen.getByPlaceholderText("Ej. 851762")).toHaveValue("123456");
    expect(screen.queryByText("Sugerido por IA")).not.toBeInTheDocument();
  });

  it("no relanza la petición si se vuelve al Paso 2 y se avanza de nuevo sin cambiar la descripción", async () => {
    sugerirHsCodeMock.mockResolvedValue({ status: "error" });
    const user = userEvent.setup();
    setup();

    await llegarAPaso2(user);
    await user.type(
      screen.getByPlaceholderText("Ej. Audífonos inalámbricos con estuche de carga"),
      "producto sin cambios"
    );
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(sugerirHsCodeMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Anterior" }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(sugerirHsCodeMock).toHaveBeenCalledTimes(1);
  });

  it("baja confianza: no pre-llena, no muestra el badge de IA, y avisa que se complete a mano", async () => {
    sugerirHsCodeMock.mockResolvedValueOnce({ status: "low_confidence" });
    const user = userEvent.setup();
    setup();

    await llegarAPaso2(user);
    await user.type(
      screen.getByPlaceholderText("Ej. Audífonos inalámbricos con estuche de carga"),
      "asdasdasd"
    );
    await user.click(screen.getByRole("button", { name: "Siguiente" }));

    const hsInput = await waitFor(() => {
      const input = screen.getByPlaceholderText("Ej. 851762");
      expect(
        screen.getByText("No se pudo inferir la partida arancelaria. Ingresa una manualmente.")
      ).toBeInTheDocument();
      return input;
    });

    expect(hsInput).toHaveValue("");
    expect(hsInput).not.toBeDisabled();
    expect(screen.queryByText("Sugerido por IA")).not.toBeInTheDocument();
  });
});
