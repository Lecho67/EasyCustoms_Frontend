import { describe, it, expect } from "vitest";
import { validateWizardFormData } from "./shipmentFormSchema";
import { declaracionesEspecialesVacias, type WizardFormData } from "./types";

function formValido(over: Partial<WizardFormData> = {}): WizardFormData {
  return {
    paisOrigen: "Estados Unidos",
    transportType: "air",
    shipmentModality: "personal_shipment_gift",
    paisDestino: "Colombia",
    categoria: "Electrónica",
    descripcionItem: "Audífonos inalámbricos",
    pesoKg: 1.5,
    valorDeclaradoUsd: 40,
    cantidadUnidades: 1,
    partidaArancelariaTentativa: "",
    declaracionesEspeciales: declaracionesEspecialesVacias(),
    ...over,
  };
}

describe("validateWizardFormData — formulario completo", () => {
  it("no devuelve errores con un formulario válido", () => {
    expect(validateWizardFormData(formValido())).toEqual({});
  });
});

describe("validateWizardFormData — campos base", () => {
  it("exige país de origen, transporte y modalidad con los mismos textos que antes", () => {
    const errores = validateWizardFormData(
      formValido({ paisOrigen: "", transportType: "", shipmentModality: "" })
    );
    expect(errores.paisOrigen).toBe("Selecciona un país de origen.");
    expect(errores.transportType).toBe("Selecciona un tipo de transporte.");
    expect(errores.shipmentModality).toBe("Selecciona una modalidad de envío.");
  });

  it("exige descripción del producto (incluso si es solo espacios)", () => {
    expect(validateWizardFormData(formValido({ descripcionItem: "   " })).descripcionItem).toBe(
      "Describe el producto."
    );
  });

  it("exige peso mayor a 0", () => {
    expect(validateWizardFormData(formValido({ pesoKg: undefined })).pesoKg).toBe(
      "El peso debe ser mayor a 0."
    );
    expect(validateWizardFormData(formValido({ pesoKg: 0 })).pesoKg).toBe("El peso debe ser mayor a 0.");
    expect(validateWizardFormData(formValido({ pesoKg: -1 })).pesoKg).toBe("El peso debe ser mayor a 0.");
  });

  it("exige valor declarado (0 es válido, negativo no)", () => {
    expect(validateWizardFormData(formValido({ valorDeclaradoUsd: undefined })).valorDeclaradoUsd).toBe(
      "El valor declarado (USD) es obligatorio."
    );
    expect(validateWizardFormData(formValido({ valorDeclaradoUsd: -1 })).valorDeclaradoUsd).toBe(
      "El valor declarado (USD) es obligatorio."
    );
    expect(validateWizardFormData(formValido({ valorDeclaradoUsd: 0 })).valorDeclaradoUsd).toBeUndefined();
  });

  it("no exige país de destino ni categoría (destino es fijo, categoría es opcional)", () => {
    const errores = validateWizardFormData(formValido({ categoria: undefined }));
    expect(errores).not.toHaveProperty("paisDestino");
    expect(errores).not.toHaveProperty("categoria");
  });
});

describe("validateWizardFormData — declaraciones especiales condicionales", () => {
  it("no exige nada si las 4 declaraciones están en 'No'", () => {
    expect(validateWizardFormData(formValido()).bateriaTipo).toBeUndefined();
  });

  it("batería: exige tipo solo si contieneBateriaLitio es true", () => {
    const sinTipo = validateWizardFormData(
      formValido({ declaracionesEspeciales: { ...declaracionesEspecialesVacias(), contieneBateriaLitio: true } })
    );
    expect(sinTipo.bateriaTipo).toBe("Selecciona el tipo de batería.");

    const conTipo = validateWizardFormData(
      formValido({
        declaracionesEspeciales: {
          ...declaracionesEspecialesVacias(),
          contieneBateriaLitio: true,
          bateria: { tipo: "lithium_ion" },
        },
      })
    );
    expect(conTipo.bateriaTipo).toBeUndefined();
  });

  it("líquidos: exige categoría solo si contieneLiquidos es true", () => {
    const sinCategoria = validateWizardFormData(
      formValido({ declaracionesEspeciales: { ...declaracionesEspecialesVacias(), contieneLiquidos: true } })
    );
    expect(sinCategoria.liquidoCategoria).toBe("Selecciona la categoría del líquido.");
  });

  it("orgánico: exige tipo solo si esOrganicoOBiologico es true", () => {
    const sinTipo = validateWizardFormData(
      formValido({ declaracionesEspeciales: { ...declaracionesEspecialesVacias(), esOrganicoOBiologico: true } })
    );
    expect(sinTipo.organicoTipo).toBe("Selecciona el tipo de producto.");
  });

  it("médico: exige tipo solo si esMedicamentoRegulado es true", () => {
    const sinTipo = validateWizardFormData(
      formValido({ declaracionesEspeciales: { ...declaracionesEspecialesVacias(), esMedicamentoRegulado: true } })
    );
    expect(sinTipo.medicoTipo).toBe("Selecciona el tipo de regulación.");
  });

  it("declaracionesEspeciales ausente (undefined) no rompe la validación", () => {
    const errores = validateWizardFormData(formValido({ declaracionesEspeciales: undefined }));
    expect(errores.bateriaTipo).toBeUndefined();
    expect(errores.liquidoCategoria).toBeUndefined();
  });

  it("las 4 declaraciones a la vez acumulan sus 4 errores", () => {
    const errores = validateWizardFormData(
      formValido({
        declaracionesEspeciales: {
          contieneBateriaLitio: true,
          contieneLiquidos: true,
          esOrganicoOBiologico: true,
          esMedicamentoRegulado: true,
          otrasMercanciasPeligrosas: [],
        },
      })
    );
    expect(errores.bateriaTipo).toBeDefined();
    expect(errores.liquidoCategoria).toBeDefined();
    expect(errores.organicoTipo).toBeDefined();
    expect(errores.medicoTipo).toBeDefined();
  });
});
