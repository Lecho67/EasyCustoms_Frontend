import type { WizardFormData, DiagnosticoEnvio, DesgloseImpuestos, InfoDeMinimis } from "./types";
import { getCountryInfo } from "./countryCodes";

// ----------------------------------------------------------------------------
// Estos tipos replican (solo lo que necesitamos) el contrato real del
// backend de tu compañero: src/request.types.ts en BorderCheck-AI_Backend.
// Si el backend cambia su esquema, este es el único archivo que hay que
// tocar — api.ts no debería conocer estos detalles.
// ----------------------------------------------------------------------------

export interface ShipmentEvaluationRequest {
  id: string;
  metadata: {
    created_at: string;
    updated_at: string;
    status: "pending_evaluation";
    rules_engine_version: string;
    locale?: string;
    channel?: "web" | "mobile_ios" | "mobile_android" | "api" | "internal_admin";
    user_id?: string | null;
  };
  logistics: {
    origin_country: string;
    destination_country: string;
    transport_type: "air" | "sea" | "land" | "postal_courier";
    shipment_modality:
      | "carry_on_baggage"
      | "checked_baggage"
      | "commercial_shipment"
      | "personal_shipment_gift";
    is_transit?: boolean;
  };
  financial_dimensional: {
    declared_value: number;
    currency: string;
    gross_weight: number;
    weight_unit: "kg" | "g" | "lb" | "oz";
    unit_quantity: number;
  };
  product_classification: {
    category: string;
    hs_code?: string;
    hs_code_confidence?: "declared_by_user" | null;
    product_description?: string;
    has_hazmat_content: boolean;
    hazmat_attributes?: {
      lithium_battery?: {
        contains_battery: boolean;
        battery_type?: string;
        watt_hours?: number | null;
        lithium_content_grams?: number | null;
        battery_quantity?: number | null;
      };
      liquids_gels_aerosols?: {
        contains_liquid: boolean;
        individual_container_volume_ml?: number | null;
        total_volume_ml?: number | null;
        is_flammable?: boolean | null;
        liquid_category?: string | null;
      };
      other_dangerous_goods?: { type: string }[];
    };
    organic_phytosanitary?: {
      is_organic_or_biological: boolean;
      is_perishable?: boolean | null;
      product_type?: string | null;
      requires_phytosanitary_certificate?: boolean | null;
    };
    medical_regulation?: {
      is_medically_regulated: boolean;
      regulation_type?: string | null;
      is_controlled_substance?: boolean | null;
    };
  };
}

export interface DecisionEngineAlert {
  alert_code: string;
  severity: "info" | "warning" | "critical";
  user_description: string;
  legal_reference?: string | null;
  related_field?: string | null;
}

export interface DecisionEngineResult {
  final_status: "APROBADO" | "PRECAUCION" | "BLOQUEO";
  evaluated_at: string;
  alerts: DecisionEngineAlert[];
  tax_estimation: {
    requires_taxes: boolean;
    estimated_percentage?: number | null;
    de_minimis_threshold_exceeded?: boolean | null;
    de_minimis_threshold_value?: number | null;
    estimated_tax_amount?: number | null;
  };
  requires_manual_review?: boolean;
}

// ----------------------------------------------------------------------------
// origin_country / transport_type / shipment_modality YA NO son fijos.
// Hasta esta versión, BorderCheck-AI operaba solo como servicio de casillero
// (origen US, aéreo, envío personal) y estos 3 valores estaban hardcodeados
// aquí. El negocio ahora permite que el usuario los declare, así que se leen
// de wizardData (ver validaciones más abajo).
// ----------------------------------------------------------------------------
const RULES_ENGINE_VERSION = "1.0.0"; // debe coincidir con la del backend

const HS_CODE_PATTERN = /^\d{4}(\.\d{2}){0,2}$/;

function sanitizeHsCode(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return HS_CODE_PATTERN.test(trimmed) ? trimmed : undefined;
}

export function buildShipmentEvaluationRequest(
  wizardData: WizardFormData,
  userId: string | null
): ShipmentEvaluationRequest {
  // Validaciones primero: `getCountryInfo` lanza con un mensaje técnico si
  // el país viene vacío, así que estos chequeos amigables van antes.
  if (!wizardData.paisDestino) {
    throw new Error("El país de destino es obligatorio.");
  }
  if (!wizardData.paisOrigen) {
    throw new Error("El país de origen es obligatorio.");
  }
  if (!wizardData.transportType) {
    throw new Error("El tipo de transporte es obligatorio.");
  }
  if (!wizardData.shipmentModality) {
    throw new Error("La modalidad de envío es obligatoria.");
  }
  if (wizardData.pesoKg == null || wizardData.pesoKg <= 0) {
    throw new Error("El peso (kg) es obligatorio y debe ser mayor a 0.");
  }
  if (wizardData.valorDeclaradoUsd == null || wizardData.valorDeclaradoUsd < 0) {
    throw new Error("El valor declarado (USD) es obligatorio.");
  }

  const { alpha2: destinationCountry } = getCountryInfo(wizardData.paisDestino);
  const { alpha2: originCountry } = getCountryInfo(wizardData.paisOrigen);
  const now = new Date().toISOString();
  const decl = wizardData.declaracionesEspeciales;

  const hasHazmat =
    !!decl?.contieneBateriaLitio ||
    !!decl?.contieneLiquidos ||
    (decl?.otrasMercanciasPeligrosas.length ?? 0) > 0;

  return {
    id: crypto.randomUUID(),
    metadata: {
      created_at: now,
      updated_at: now,
      status: "pending_evaluation",
      rules_engine_version: RULES_ENGINE_VERSION,
      locale: `es-${destinationCountry}`,
      channel: "web",
      user_id: userId,
    },
    logistics: {
      origin_country: originCountry,
      destination_country: destinationCountry,
      transport_type: wizardData.transportType as ShipmentEvaluationRequest["logistics"]["transport_type"],
      shipment_modality: wizardData.shipmentModality as ShipmentEvaluationRequest["logistics"]["shipment_modality"],
      is_transit: false,
    },
    financial_dimensional: {
      declared_value: wizardData.valorDeclaradoUsd,
      currency: "USD",
      gross_weight: wizardData.pesoKg,
      weight_unit: "kg",
      unit_quantity: wizardData.cantidadUnidades ?? 1,
    },
    product_classification: {
      category: wizardData.categoria?.trim() || "general_merchandise",
      hs_code: sanitizeHsCode(wizardData.partidaArancelariaTentativa),
      hs_code_confidence: sanitizeHsCode(wizardData.partidaArancelariaTentativa)
        ? "declared_by_user"
        : null,
      product_description: wizardData.descripcionItem.slice(0, 1000),
      has_hazmat_content: hasHazmat,
      hazmat_attributes: hasHazmat
        ? {
            lithium_battery: decl?.contieneBateriaLitio
              ? {
                  contains_battery: true,
                  battery_type: decl.bateria?.tipo,
                  watt_hours: decl.bateria?.wattHora ?? null,
                  lithium_content_grams: decl.bateria?.gramosLitio ?? null,
                  battery_quantity: decl.bateria?.cantidad ?? null,
                }
              : undefined,
            liquids_gels_aerosols: decl?.contieneLiquidos
              ? {
                  contains_liquid: true,
                  total_volume_ml: decl.liquido?.volumenTotalMl ?? null,
                  is_flammable: decl.liquido?.esInflamable ?? null,
                  liquid_category: decl.liquido?.categoria ?? null,
                }
              : undefined,
            other_dangerous_goods: decl?.otrasMercanciasPeligrosas.length
              ? decl.otrasMercanciasPeligrosas.map((type) => ({ type }))
              : undefined,
          }
        : undefined,
      organic_phytosanitary: decl?.esOrganicoOBiologico
        ? {
            is_organic_or_biological: true,
            is_perishable: decl.organico?.esPerecedero ?? null,
            product_type: decl.organico?.tipo ?? null,
            requires_phytosanitary_certificate:
              decl.organico?.tieneCertificadoFitosanitario ?? null,
          }
        : undefined,
      medical_regulation: decl?.esMedicamentoRegulado
        ? {
            is_medically_regulated: true,
            regulation_type: decl.medico?.tipo ?? null,
            is_controlled_substance: decl.medico?.esSustanciaControlada ?? null,
          }
        : undefined,
    },
  };
}

// ----------------------------------------------------------------------------
// Respuesta del motor -> forma que ya consume la UI (VerdictCard,
// JustificationCard, DocumentChecklist, TaxBreakdownCard...).
// El motor NO devuelve id, hs_code ni textos narrativos — los reconstruimos
// aquí a partir de las alertas reales, sin inventar justificaciones.
// ----------------------------------------------------------------------------

const NIVEL_POR_ESTADO = {
  APROBADO: "verde",
  PRECAUCION: "amarillo",
  BLOQUEO: "rojo",
} as const;

const TITULO_POR_ESTADO = {
  APROBADO: "Tu envío puede pasar sin problema",
  PRECAUCION: "Puedes enviarlo, pero falta un documento",
  BLOQUEO: "Este envío no se puede hacer así",
} as const;

function inferDocumentosRequeridos(alerts: DecisionEngineAlert[]): string[] {
  const docs = new Set<string>();
  for (const alert of alerts) {
    const text = alert.user_description.toLowerCase();
    if (text.includes("dgd") || text.includes("declaración de mercancía peligrosa")) {
      docs.add("Declaración de Mercancía Peligrosa (DGD)");
    }
    if (text.includes("ficha de seguridad") || text.includes("msds")) {
      docs.add("Ficha de seguridad del producto (MSDS)");
    }
    if (text.includes("certificado fitosanitario")) {
      docs.add("Certificado fitosanitario");
    }
    if (text.includes("receta") || text.includes("prescripción")) {
      docs.add("Prescripción médica / receta");
    }
  }
  return Array.from(docs);
}

export function mapDecisionResultToDiagnostico(
  requestId: string,
  request: ShipmentEvaluationRequest,
  result: DecisionEngineResult,
  wizardData: WizardFormData
): DiagnosticoEnvio {
  const nivel = NIVEL_POR_ESTADO[result.final_status];
  const criticalOrWarning = result.alerts.filter((a) => a.severity !== "info");
  const primary = criticalOrWarning[0] ?? result.alerts[0];

  const resumen =
    nivel === "verde"
      ? `Tu envío cumple con la normativa de transporte hacia ${wizardData.paisDestino}.`
      : primary?.user_description ??
        "No se encontraron restricciones aplicables para este envío.";

  const justificacion =
    criticalOrWarning.length > 0
      ? criticalOrWarning.map((a) => a.user_description).join(" ")
      : "El ítem descrito no presenta restricciones conocidas para el transporte declarado.";

  const fuenteNormativa =
    result.alerts.find((a) => a.legal_reference)?.legal_reference ??
    "Normativa aduanera general aplicable al país de destino.";

  const deMinimis: InfoDeMinimis | null =
    result.tax_estimation.de_minimis_threshold_exceeded == null
      ? null
      : {
          superado: result.tax_estimation.de_minimis_threshold_exceeded,
          valorTope: result.tax_estimation.de_minimis_threshold_value ?? null,
        };

  const valor = wizardData.valorDeclaradoUsd ?? 0;
  let desgloseImpuestos: DesgloseImpuestos | null = null;
  if (valor > 0) {
    const flete = Number(Math.max(8, valor * 0.08).toFixed(2));
    const tasa = (result.tax_estimation.estimated_percentage ?? 0) / 100;
    const arancel = Number(
      (result.tax_estimation.estimated_tax_amount ?? valor * tasa).toFixed(2)
    );
    desgloseImpuestos = {
      flete,
      arancel,
      total: Number((flete + arancel).toFixed(2)),
      tasaArancelAplicada: tasa,
    };
  }

  return {
    id: requestId,
    nivel,
    titulo: TITULO_POR_ESTADO[result.final_status],
    resumen,
    justificacion,
    fuenteNormativa,
    documentosRequeridos: inferDocumentosRequeridos(result.alerts),
    accionesSugeridas: criticalOrWarning.map((a) => a.user_description),
    partidaArancelariaTentativa:
      request.product_classification.hs_code ?? "Sin partida tentativa declarada",
    desgloseImpuestos,
    deMinimis,
    createdAt: result.evaluated_at,
    input: {
      paisDestino: wizardData.paisDestino,
      descripcionItem: wizardData.descripcionItem,
      pesoKg: wizardData.pesoKg,
      valorDeclaradoUsd: wizardData.valorDeclaradoUsd,
      partidaArancelariaTentativa: wizardData.partidaArancelariaTentativa,
      transportType: wizardData.transportType || undefined,
      shipmentModality: wizardData.shipmentModality || undefined,
    },
  };
}

/** Etiquetas legibles para mostrarle al usuario lo que declaró (transporte y
 * modalidad) junto al veredicto — no representan cómo el motor de reglas
 * evalúa internamente cada régimen, solo confirman el dato enviado. Mismas
 * 8 opciones que ofrece el wizard (ver ShipmentForm.tsx). */
export const TRANSPORT_TYPE_LABELS: Record<Exclude<WizardFormData["transportType"], "">, string> = {
  air: "Aéreo",
  sea: "Marítimo",
  land: "Terrestre",
  postal_courier: "Mensajería",
};

export const SHIPMENT_MODALITY_LABELS: Record<
  Exclude<WizardFormData["shipmentModality"], "">,
  string
> = {
  commercial_shipment: "Envío comercial",
  personal_shipment_gift: "Envío personal / regalo",
  checked_baggage: "Equipaje facturado",
  carry_on_baggage: "Equipaje de mano",
};