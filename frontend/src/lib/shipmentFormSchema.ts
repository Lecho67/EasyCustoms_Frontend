import { z } from "zod";
import type { WizardFormData } from "./types";

/**
 * Única fuente de verdad para las reglas de validación del wizard de
 * `/consulta/nueva`. Antes vivían separadas: la forma en la interface
 * `WizardFormData` (types.ts) y las reglas en una función `validate()` a
 * mano en ShipmentForm.tsx — nada obligaba a mantenerlas sincronizadas si
 * cambiaba un campo.
 *
 * La anotación `z.ZodType<WizardFormData>` hace que TypeScript rechace este
 * archivo si el schema deja de calzar con la interface: un campo nuevo en
 * `WizardFormData` sin declarar acá es un error de compilación, no un bug
 * silencioso.
 *
 * Los mensajes son exactamente los que devolvía `validate()` — no se
 * cambió ninguna copia visible para el usuario.
 */

const declaracionBateriaSchema = z.object({
  tipo: z
    .enum(["lithium_ion", "lithium_metal", "installed_in_equipment", "packed_with_equipment"])
    .optional(),
  wattHora: z.number().optional(),
  gramosLitio: z.number().optional(),
  cantidad: z.number().optional(),
});

const declaracionLiquidoSchema = z.object({
  categoria: z
    .enum(["cosmetic", "alcoholic_beverage", "perfume", "cleaning_product", "medicinal", "food_liquid", "other"])
    .optional(),
  volumenTotalMl: z.number().optional(),
  esInflamable: z.boolean().optional(),
});

const declaracionOrganicaSchema = z.object({
  tipo: z
    .enum([
      "fresh_food",
      "processed_food",
      "untreated_wood",
      "treated_wood",
      "live_plant",
      "seeds",
      "animal_origin_product",
      "vegetal_origin_product",
      "other",
    ])
    .optional(),
  esPerecedero: z.boolean().optional(),
  tieneCertificadoFitosanitario: z.boolean().optional(),
});

const declaracionMedicaSchema = z.object({
  tipo: z
    .enum(["otc_medication", "prescription_medication", "cosmetic", "medical_device", "controlled_substance", "supplement"])
    .optional(),
  esSustanciaControlada: z.boolean().optional(),
});

const declaracionesEspecialesSchema = z.object({
  contieneBateriaLitio: z.boolean(),
  bateria: declaracionBateriaSchema.optional(),

  contieneLiquidos: z.boolean(),
  liquido: declaracionLiquidoSchema.optional(),

  otrasMercanciasPeligrosas: z.array(
    z.enum(["compressed_gas", "corrosive", "magnetic_material", "flammable_solid", "oxidizer", "radioactive", "explosive", "other"])
  ),

  esOrganicoOBiologico: z.boolean(),
  organico: declaracionOrganicaSchema.optional(),

  esMedicamentoRegulado: z.boolean(),
  medico: declaracionMedicaSchema.optional(),
});

export const wizardFormDataSchema: z.ZodType<WizardFormData> = z
  .object({
    paisOrigen: z.string(),
    transportType: z.union([z.enum(["air", "sea", "land", "postal_courier"]), z.literal("")]),
    shipmentModality: z.union([
      z.enum(["carry_on_baggage", "checked_baggage", "commercial_shipment", "personal_shipment_gift"]),
      z.literal(""),
    ]),
    paisDestino: z.string(),
    categoria: z.string().optional(),
    descripcionItem: z.string(),
    pesoKg: z.number().optional(),
    valorDeclaradoUsd: z.number().optional(),
    cantidadUnidades: z.number().optional(),
    partidaArancelariaTentativa: z.string().optional(),
    declaracionesEspeciales: declaracionesEspecialesSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.paisOrigen) {
      ctx.addIssue({ code: "custom", path: ["paisOrigen"], message: "Selecciona un país de origen." });
    }
    if (!data.transportType) {
      ctx.addIssue({ code: "custom", path: ["transportType"], message: "Selecciona un tipo de transporte." });
    }
    if (!data.shipmentModality) {
      ctx.addIssue({ code: "custom", path: ["shipmentModality"], message: "Selecciona una modalidad de envío." });
    }
    if (!data.descripcionItem.trim()) {
      ctx.addIssue({ code: "custom", path: ["descripcionItem"], message: "Describe el producto." });
    }
    if (data.pesoKg == null || data.pesoKg <= 0) {
      ctx.addIssue({ code: "custom", path: ["pesoKg"], message: "El peso debe ser mayor a 0." });
    }
    if (data.valorDeclaradoUsd == null || data.valorDeclaradoUsd < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["valorDeclaradoUsd"],
        message: "El valor declarado (USD) es obligatorio.",
      });
    }

    // Rutas planas a propósito (["bateriaTipo"], no la ruta real anidada
    // declaracionesEspeciales.bateria.tipo): así el resultado se traduce
    // 1:1 a las claves de ErrorKey que ya usa ShipmentForm.tsx para decidir
    // qué paso bloquear, sin tener que aplanar rutas anidadas después.
    const decl = data.declaracionesEspeciales;
    if (decl?.contieneBateriaLitio && !decl.bateria?.tipo) {
      ctx.addIssue({ code: "custom", path: ["bateriaTipo"], message: "Selecciona el tipo de batería." });
    }
    if (decl?.contieneLiquidos && !decl.liquido?.categoria) {
      ctx.addIssue({ code: "custom", path: ["liquidoCategoria"], message: "Selecciona la categoría del líquido." });
    }
    if (decl?.esOrganicoOBiologico && !decl.organico?.tipo) {
      ctx.addIssue({ code: "custom", path: ["organicoTipo"], message: "Selecciona el tipo de producto." });
    }
    if (decl?.esMedicamentoRegulado && !decl.medico?.tipo) {
      ctx.addIssue({ code: "custom", path: ["medicoTipo"], message: "Selecciona el tipo de regulación." });
    }
  });

export type ErrorKey =
  | "paisOrigen"
  | "transportType"
  | "shipmentModality"
  | "descripcionItem"
  | "pesoKg"
  | "valorDeclaradoUsd"
  | "bateriaTipo"
  | "liquidoCategoria"
  | "organicoTipo"
  | "medicoTipo";

export type FormErrors = Partial<Record<ErrorKey, string>>;

export function validateWizardFormData(data: WizardFormData): FormErrors {
  const result = wizardFormDataSchema.safeParse(data);
  if (result.success) return {};

  const errors: FormErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as ErrorKey;
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
