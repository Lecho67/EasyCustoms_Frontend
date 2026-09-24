import { describe, it, expect } from "vitest";
import {
  buildShipmentEvaluationRequest,
  mapDecisionResultToDiagnostico,
  type DecisionEngineResult,
} from "./shipmentMapping";
import { declaracionesEspecialesVacias, type WizardFormData } from "./types";

function baseWizard(over: Partial<WizardFormData> = {}): WizardFormData {
  return {
    paisOrigen: "Estados Unidos",
    transportType: "air",
    shipmentModality: "personal_shipment_gift",
    paisDestino: "Colombia",
    categoria: "Electrónica",
    descripcionItem: "Auriculares inalámbricos",
    pesoKg: 0.5,
    valorDeclaradoUsd: 120,
    cantidadUnidades: 1,
    declaracionesEspeciales: declaracionesEspecialesVacias(),
    ...over,
  };
}

describe("buildShipmentEvaluationRequest", () => {
  it("mapea países a ISO alpha-2 y usa valores por defecto", () => {
    const req = buildShipmentEvaluationRequest(baseWizard(), "user-1");
    expect(req.logistics.origin_country).toBe("US");
    expect(req.logistics.destination_country).toBe("CO");
    expect(req.metadata.user_id).toBe("user-1");
    expect(req.financial_dimensional.currency).toBe("USD");
    expect(req.product_classification.has_hazmat_content).toBe(false);
  });

  it("exige peso mayor a 0", () => {
    expect(() => buildShipmentEvaluationRequest(baseWizard({ pesoKg: 0 }), null)).toThrow(/peso/i);
  });

  it("da un error amigable si falta el país (no el error técnico de getCountryInfo)", () => {
    expect(() =>
      buildShipmentEvaluationRequest(baseWizard({ paisDestino: "" }), null)
    ).toThrow("El país de destino es obligatorio.");
    expect(() =>
      buildShipmentEvaluationRequest(baseWizard({ paisOrigen: "" }), null)
    ).toThrow("El país de origen es obligatorio.");
  });

  it("exige valor declarado", () => {
    expect(() =>
      buildShipmentEvaluationRequest(baseWizard({ valorDeclaradoUsd: undefined }), null)
    ).toThrow(/valor declarado/i);
  });

  it("acepta un HS code válido y marca la confianza como declarada por el usuario", () => {
    const req = buildShipmentEvaluationRequest(
      baseWizard({ partidaArancelariaTentativa: "8518.30" }),
      null
    );
    expect(req.product_classification.hs_code).toBe("8518.30");
    expect(req.product_classification.hs_code_confidence).toBe("declared_by_user");
  });

  it("descarta un HS code con formato inválido", () => {
    const req = buildShipmentEvaluationRequest(
      baseWizard({ partidaArancelariaTentativa: "no-es-un-hs" }),
      null
    );
    expect(req.product_classification.hs_code).toBeUndefined();
    expect(req.product_classification.hs_code_confidence).toBeNull();
  });

  it("marca hazmat y arma los atributos cuando hay batería de litio", () => {
    const decl = declaracionesEspecialesVacias();
    decl.contieneBateriaLitio = true;
    decl.bateria = { tipo: "lithium_ion", wattHora: 50 };
    const req = buildShipmentEvaluationRequest(baseWizard({ declaracionesEspeciales: decl }), null);
    expect(req.product_classification.has_hazmat_content).toBe(true);
    expect(req.product_classification.hazmat_attributes?.lithium_battery).toMatchObject({
      contains_battery: true,
      battery_type: "lithium_ion",
      watt_hours: 50,
    });
  });
});

describe("mapDecisionResultToDiagnostico", () => {
  const request = buildShipmentEvaluationRequest(baseWizard(), null);

  function result(over: Partial<DecisionEngineResult> = {}): DecisionEngineResult {
    return {
      final_status: "APROBADO",
      evaluated_at: "2026-01-01T00:00:00Z",
      alerts: [],
      tax_estimation: { requires_taxes: false },
      ...over,
    };
  }

  it("traduce APROBADO a nivel verde con título apto", () => {
    const d = mapDecisionResultToDiagnostico("req-1", request, result(), baseWizard());
    expect(d.nivel).toBe("verde");
    expect(d.titulo).toBe("Tu envío puede pasar sin problema");
    expect(d.resumen).toContain("Colombia");
  });

  it("toma la alerta crítica como justificación en un BLOQUEO", () => {
    const d = mapDecisionResultToDiagnostico(
      "req-2",
      request,
      result({
        final_status: "BLOQUEO",
        alerts: [
          {
            alert_code: "PROHIBIDO",
            severity: "critical",
            user_description: "Mercancía prohibida en el país de destino.",
          },
        ],
      }),
      baseWizard()
    );
    expect(d.nivel).toBe("rojo");
    expect(d.justificacion).toContain("prohibida");
  });

  it("calcula el desglose de impuestos con el porcentaje estimado", () => {
    const d = mapDecisionResultToDiagnostico(
      "req-3",
      request,
      result({ tax_estimation: { requires_taxes: true, estimated_percentage: 10 } }),
      baseWizard({ valorDeclaradoUsd: 100 })
    );
    expect(d.desgloseImpuestos).not.toBeNull();
    expect(d.desgloseImpuestos?.arancel).toBe(10);
    expect(d.desgloseImpuestos?.flete).toBe(8);
    expect(d.desgloseImpuestos?.total).toBe(18);
  });

  it("no arma desglose de impuestos si el valor declarado es 0", () => {
    const d = mapDecisionResultToDiagnostico(
      "req-4",
      request,
      result(),
      baseWizard({ valorDeclaradoUsd: 0 })
    );
    expect(d.desgloseImpuestos).toBeNull();
  });

  it("mapea el tope de minimis cuando el motor lo informa", () => {
    const superado = mapDecisionResultToDiagnostico(
      "req-6",
      request,
      result({
        tax_estimation: {
          requires_taxes: true,
          de_minimis_threshold_exceeded: true,
          de_minimis_threshold_value: 200,
        },
      }),
      baseWizard()
    );
    expect(superado.deMinimis).toEqual({ superado: true, valorTope: 200 });

    const dentroDelTope = mapDecisionResultToDiagnostico(
      "req-7",
      request,
      result({
        tax_estimation: {
          requires_taxes: false,
          de_minimis_threshold_exceeded: false,
          de_minimis_threshold_value: 200,
        },
      }),
      baseWizard()
    );
    expect(dentroDelTope.deMinimis).toEqual({ superado: false, valorTope: 200 });
  });

  it("deMinimis queda en null si el motor no informa el dato (no inventa nada)", () => {
    const d = mapDecisionResultToDiagnostico("req-8", request, result(), baseWizard());
    expect(d.deMinimis).toBeNull();
  });

  it("le devuelve al usuario el transporte y la modalidad que declaró", () => {
    const d = mapDecisionResultToDiagnostico(
      "req-9",
      request,
      result(),
      baseWizard({ transportType: "air", shipmentModality: "personal_shipment_gift" })
    );
    expect(d.input.transportType).toBe("air");
    expect(d.input.shipmentModality).toBe("personal_shipment_gift");
  });

  it("infiere documentos requeridos a partir del texto de las alertas", () => {
    const d = mapDecisionResultToDiagnostico(
      "req-5",
      request,
      result({
        final_status: "PRECAUCION",
        alerts: [
          {
            alert_code: "FITO",
            severity: "warning",
            user_description: "Se requiere certificado fitosanitario para productos vegetales.",
          },
        ],
      }),
      baseWizard()
    );
    expect(d.documentosRequeridos).toContain("Certificado fitosanitario");
  });
});
