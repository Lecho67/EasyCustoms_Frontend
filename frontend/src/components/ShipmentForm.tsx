// src/components/ShipmentForm.tsx
//
// Wizard multi-paso para /consulta/nueva: un paso a la vez, con validación
// propia por paso y navegación Anterior/Siguiente.
//
// IMPORTANTE — por qué está tipado así:
// Este componente produce exactamente un `WizardFormData` (src/lib/types.ts),
// el mismo objeto que ya consume `evaluarEnvio()` en src/lib/api.ts, que a su
// vez lo transforma al contrato real del backend en
// `buildShipmentEvaluationRequest()` (src/lib/shipmentMapping.ts).
//
// Esto es intencional: NO reconstruyo el payload del backend aquí. Si algún
// día el motor de reglas cambia su contrato, el único archivo que hay que
// tocar sigue siendo shipmentMapping.ts — este formulario no se entera. El
// wizard tampoco cambia la forma de `WizardFormData`: solo reparte los mismos
// campos en pasos distintos y valida por paso en vez de todo junto.
//
// origin_country / transport_type / shipment_modality dejaron de estar fijos
// por el modelo de casillero: ahora son campos editables del formulario (ver
// Paso 1 "Logística" más abajo), y se validan/mapean 1:1 en
// shipmentMapping.ts (ya no hay constantes hardcodeadas ahí).

import { useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { paisesDisponibles, chipsSugeridos } from "@/lib/mockData";
import { sugerirHsCode } from "@/lib/api";
import {
  declaracionesEspecialesVacias,
  type WizardFormData,
  type TipoBateriaLitio,
  type CategoriaLiquido,
  type OtraMercanciaPeligrosa,
  type TipoProductoOrganico,
  type TipoRegulacionMedica,
  type TransportType,
  type ShipmentModality,
} from "@/lib/types";

/* ============================================================================
 * Catálogos label <-> código.
 * El código (value) es exactamente lo que shipmentMapping.ts reenvía al
 * motor de reglas sin transformar — por eso NUNCA se guarda el label en el
 * estado del formulario, solo se usa para mostrarlo en el Select.
 * ==========================================================================*/

const BATTERY_TYPE_OPTIONS: { value: TipoBateriaLitio; label: string }[] = [
  { value: "lithium_ion", label: "Litio-ion" },
  { value: "lithium_metal", label: "Litio-metal" },
  { value: "installed_in_equipment", label: "Instalada dentro del equipo" },
  { value: "packed_with_equipment", label: "Empacada junto al equipo" },
];

const LIQUID_CATEGORY_OPTIONS: { value: CategoriaLiquido; label: string }[] = [
  { value: "cosmetic", label: "Cosmético" },
  { value: "alcoholic_beverage", label: "Bebida alcohólica" },
  { value: "perfume", label: "Perfume" },
  { value: "cleaning_product", label: "Producto de limpieza" },
  { value: "medicinal", label: "Medicinal" },
  { value: "food_liquid", label: "Líquido alimenticio" },
  { value: "other", label: "Otro" },
];

const OTHER_DANGEROUS_GOODS_OPTIONS: { value: OtraMercanciaPeligrosa; label: string }[] = [
  { value: "compressed_gas", label: "Gas comprimido" },
  { value: "corrosive", label: "Corrosivo" },
  { value: "magnetic_material", label: "Material magnético" },
  { value: "flammable_solid", label: "Sólido inflamable" },
  { value: "oxidizer", label: "Oxidante" },
  { value: "radioactive", label: "Radiactivo" },
  { value: "explosive", label: "Explosivo" },
  { value: "other", label: "Otro" },
];

const ORGANIC_TYPE_OPTIONS: { value: TipoProductoOrganico; label: string }[] = [
  { value: "fresh_food", label: "Alimento fresco" },
  { value: "processed_food", label: "Alimento procesado" },
  { value: "untreated_wood", label: "Madera sin tratar" },
  { value: "treated_wood", label: "Madera tratada" },
  { value: "live_plant", label: "Planta viva" },
  { value: "seeds", label: "Semillas" },
  { value: "animal_origin_product", label: "Producto de origen animal" },
  { value: "vegetal_origin_product", label: "Producto de origen vegetal" },
  { value: "other", label: "Otro" },
];

const TRANSPORT_TYPE_OPTIONS: { value: TransportType; label: string }[] = [
  { value: "air", label: "Aéreo" },
  { value: "sea", label: "Marítimo" },
  { value: "land", label: "Terrestre" },
  { value: "postal_courier", label: "Mensajería" },
];

const SHIPMENT_MODALITY_OPTIONS: { value: ShipmentModality; label: string }[] = [
  { value: "commercial_shipment", label: "Envío comercial" },
  { value: "personal_shipment_gift", label: "Envío personal / regalo" },
  { value: "checked_baggage", label: "Equipaje facturado" },
  { value: "carry_on_baggage", label: "Equipaje de mano" },
];

const MEDICAL_TYPE_OPTIONS: { value: TipoRegulacionMedica; label: string }[] = [
  { value: "otc_medication", label: "Medicamento de venta libre" },
  { value: "prescription_medication", label: "Medicamento con receta" },
  { value: "cosmetic", label: "Cosmético regulado" },
  { value: "medical_device", label: "Dispositivo médico" },
  { value: "controlled_substance", label: "Sustancia controlada" },
  { value: "supplement", label: "Suplemento" },
];

/** Envuelve el <Select> genérico del design system (options: string[]) para
 * que trabaje con pares {value, label} sin cambiar ui/Select.tsx. */
function EnumSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: T | undefined;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
}) {
  const currentLabel = options.find((o) => o.value === value)?.label ?? "";
  return (
    <Select
      options={options.map((o) => o.label)}
      value={currentLabel}
      onChange={(label) => {
        const found = options.find((o) => o.label === label);
        if (found) onChange(found.value);
      }}
      placeholder={placeholder}
    />
  );
}

/* ============================================================================
 * Wizard: pasos, metadata y mapeo de errores por paso
 * ==========================================================================*/

const TOTAL_STEPS = 8;

const STEP_META: { title: string; description: string }[] = [
  { title: "Logística", description: "Origen, transporte y modalidad del envío" },
  { title: "Destino y producto", description: "¿A dónde va el envío y qué contiene?" },
  { title: "Detalles del envío", description: "Peso, valor y cantidad declarados" },
  {
    title: "¿Tu envío contiene baterías de litio?",
    description: "Incluye power banks, equipos con batería recargable integrada y baterías sueltas.",
  },
  {
    title: "¿Contiene líquidos, geles o aerosoles?",
    description: "Cosméticos, perfumes, productos de limpieza o líquidos alimenticios.",
  },
  {
    title: "¿Es un producto orgánico o biológico?",
    description: "Alimentos, plantas, semillas o productos de origen animal o vegetal.",
  },
  {
    title: "¿Es un medicamento o producto médicamente regulado?",
    description: "Medicamentos, dispositivos médicos o sustancias controladas.",
  },
  {
    title: "Otras mercancías peligrosas",
    description: "Selecciona las que apliquen a tu envío (opcional)",
  },
];

/* ============================================================================
 * Estado inicial
 * ==========================================================================*/

function emptyFormData(): WizardFormData {
  return {
    paisOrigen: "",
    transportType: "",
    shipmentModality: "",
    paisDestino: "",
    categoria: "",
    descripcionItem: "",
    pesoKg: undefined,
    valorDeclaradoUsd: undefined,
    cantidadUnidades: 1,
    partidaArancelariaTentativa: "",
    declaracionesEspeciales: declaracionesEspecialesVacias(),
  };
}

type ErrorKey =
  | "paisOrigen"
  | "transportType"
  | "shipmentModality"
  | "paisDestino"
  | "descripcionItem"
  | "pesoKg"
  | "valorDeclaradoUsd"
  | "bateriaTipo"
  | "liquidoCategoria"
  | "organicoTipo"
  | "medicoTipo";

type FormErrors = Partial<Record<ErrorKey, string>>;

/** Estado de la sugerencia de HS code en segundo plano (Paso 2 -> Paso 3).
 * "low_confidence" es una respuesta válida del backend (no un error): la
 * clasificación no llegó al umbral mínimo de confianza, así que se muestra
 * un aviso discreto en vez del badge de IA. "error" es un fallo real (red,
 * timeout, backend caído) y se maneja en silencio, sin aviso visible. */
type HsSuggestionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; hsCode: string }
  | { status: "low_confidence" }
  | { status: "error" };

/** Qué claves de error bloquean el avance de cada paso — usado tanto para
 * decidir si "Siguiente" avanza como para saltar de vuelta al primer paso
 * inválido si "Evaluar envío" se dispara con algo roto. */
const STEP_ERROR_KEYS: Record<number, ErrorKey[]> = {
  1: ["paisOrigen", "transportType", "shipmentModality"],
  2: ["paisDestino", "descripcionItem"],
  3: ["pesoKg", "valorDeclaradoUsd"],
  4: ["bateriaTipo"],
  5: ["liquidoCategoria"],
  6: ["organicoTipo"],
  7: ["medicoTipo"],
  8: [],
};

function validate(data: WizardFormData): FormErrors {
  const errors: FormErrors = {};
  if (!data.paisOrigen) errors.paisOrigen = "Selecciona un país de origen.";
  if (!data.transportType) errors.transportType = "Selecciona un tipo de transporte.";
  if (!data.shipmentModality) errors.shipmentModality = "Selecciona una modalidad de envío.";
  if (!data.paisDestino) errors.paisDestino = "Selecciona un país de destino.";
  if (!data.descripcionItem.trim()) errors.descripcionItem = "Describe el producto.";
  if (data.pesoKg == null || data.pesoKg <= 0) errors.pesoKg = "El peso debe ser mayor a 0.";
  if (data.valorDeclaradoUsd == null || data.valorDeclaradoUsd < 0)
    errors.valorDeclaradoUsd = "El valor declarado (USD) es obligatorio.";

  const decl = data.declaracionesEspeciales ?? declaracionesEspecialesVacias();
  if (decl.contieneBateriaLitio && !decl.bateria?.tipo) {
    errors.bateriaTipo = "Selecciona el tipo de batería.";
  }
  if (decl.contieneLiquidos && !decl.liquido?.categoria) {
    errors.liquidoCategoria = "Selecciona la categoría del líquido.";
  }
  if (decl.esOrganicoOBiologico && !decl.organico?.tipo) {
    errors.organicoTipo = "Selecciona el tipo de producto.";
  }
  if (decl.esMedicamentoRegulado && !decl.medico?.tipo) {
    errors.medicoTipo = "Selecciona el tipo de regulación.";
  }
  return errors;
}

/* ============================================================================
 * UI helpers
 * ==========================================================================*/

const SectionCard: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({
  title,
  description,
  children,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 mb-6">
    <h3 className="text-base font-semibold text-slate-800">{title}</h3>
    {description && <p className="text-sm text-slate-500 mt-0.5 mb-4">{description}</p>}
    <div className="space-y-4 mt-4">{children}</div>
  </div>
);

const StepProgress: React.FC<{ step: number }> = ({ step }) => (
  <div className="mb-6">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-medium text-slate-500">
        Paso {step} de {TOTAL_STEPS}
      </span>
      <span className="text-xs font-medium text-slate-500">
        {Math.round((step / TOTAL_STEPS) * 100)}%
      </span>
    </div>
    <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
      <div
        className="h-full bg-cian rounded-full transition-all duration-300"
        style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
      />
    </div>
  </div>
);

const YesNoToggle: React.FC<{
  value: boolean;
  onChange: (value: boolean) => void;
}> = ({ value, onChange }) => (
  <div className="flex gap-3" role="group">
    <button
      type="button"
      aria-pressed={value}
      onClick={() => onChange(true)}
      className={`flex-1 sm:flex-none sm:min-w-[8rem] px-6 py-3 rounded-xl border font-medium transition-colors ${
        value
          ? "bg-cobalt text-white border-cobalt"
          : "border-slate-300 text-slate-600 hover:border-cobalt"
      }`}
    >
      Sí
    </button>
    <button
      type="button"
      aria-pressed={!value}
      onClick={() => onChange(false)}
      className={`flex-1 sm:flex-none sm:min-w-[8rem] px-6 py-3 rounded-xl border font-medium transition-colors ${
        !value
          ? "bg-cobalt text-white border-cobalt"
          : "border-slate-300 text-slate-600 hover:border-cobalt"
      }`}
    >
      No
    </button>
  </div>
);

const SubfieldsGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6 border-l-2 border-cobalt/20">
    {children}
  </div>
);

/* ============================================================================
 * Componente principal
 * ==========================================================================*/

interface ShipmentFormProps {
  onSubmit: (data: WizardFormData) => void | Promise<void>;
  isSubmitting: boolean;
  /** Segundos que faltan para poder enviar otra consulta; con > 0 el envío se
   * deshabilita y el botón muestra la cuenta regresiva. */
  esperaSegundos?: number;
}

export function ShipmentForm({ onSubmit, isSubmitting, esperaSegundos = 0 }: ShipmentFormProps) {
  const [form, setForm] = useState<WizardFormData>(emptyFormData());
  const [errors, setErrors] = useState<FormErrors>({});
  const [step, setStep] = useState(1);
  const [hsSuggestion, setHsSuggestion] = useState<HsSuggestionState>({ status: "idle" });

  // Descripción con la que ya se pidió (o se está pidiendo) una sugerencia —
  // evita relanzar la petición al ir y volver del Paso 2 sin haber
  // modificado descripcionItem.
  const hsSuggestionRequestedFor = useRef<string | null>(null);

  const decl = form.declaracionesEspeciales ?? declaracionesEspecialesVacias();

  function update(patch: Partial<WizardFormData>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function updateDecl(patch: Partial<typeof decl>) {
    update({ declaracionesEspeciales: { ...decl, ...patch } });
  }

  function toggleOtraMercancia(code: OtraMercanciaPeligrosa) {
    const actuales = decl.otrasMercanciasPeligrosas;
    const yaEsta = actuales.includes(code);
    updateDecl({
      otrasMercanciasPeligrosas: yaEsta
        ? actuales.filter((c) => c !== code)
        : [...actuales, code],
    });
  }

  function handleBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  /** Recorta un `FormErrors` completo a solo las claves de un paso — así el
   * paso al que se llega nunca hereda en rojo errores de campos que
   * pertenecen a otro paso y que el usuario ni siquiera ha visto todavía. */
  function errorsDelPaso(validation: FormErrors, paso: number): FormErrors {
    const recorte: FormErrors = {};
    for (const key of STEP_ERROR_KEYS[paso]) {
      if (validation[key]) recorte[key] = validation[key];
    }
    return recorte;
  }

  /**
   * Dispara en segundo plano la sugerencia de HS code al salir del Paso 2
   * (Destino y producto) — sin bloquear el avance al Paso 3: no se espera
   * esta promesa antes de cambiar de paso, solo se lanza y se deja que
   * resuelva mientras el usuario ya está viendo el Paso 3.
   *
   * No relanza la petición si la descripción no cambió desde la última vez
   * (ida y vuelta con "Anterior"/"Siguiente" sin editar nada), y nunca
   * pisa un HS code que el usuario ya haya escrito a mano en el campo.
   */
  function triggerHsCodeSuggestion() {
    const descripcion = form.descripcionItem.trim();
    if (!descripcion || hsSuggestionRequestedFor.current === descripcion) {
      return;
    }
    hsSuggestionRequestedFor.current = descripcion;
    setHsSuggestion({ status: "loading" });

    sugerirHsCode(descripcion, form.categoria || undefined)
      .then((resultado) => {
        if (resultado.status !== "success") {
          setHsSuggestion({ status: resultado.status });
          return;
        }
        setHsSuggestion({ status: "success", hsCode: resultado.hsCode });
        // Si el usuario ya escribió algo (a mano, o mientras la sugerencia
        // viajaba), no se pisa su valor.
        setForm((prev) =>
          prev.partidaArancelariaTentativa
            ? prev
            : { ...prev, partidaArancelariaTentativa: resultado.hsCode }
        );
      })
      .catch(() => setHsSuggestion({ status: "error" }));
  }

  function handleNext() {
    const validation = validate(form);
    const erroresPaso = errorsDelPaso(validation, step);
    setErrors(erroresPaso);
    if (Object.keys(erroresPaso).length === 0) {
      if (step === 2) {
        triggerHsCodeSuggestion();
      }
      setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validate(form);

    const primerPasoInvalido = Object.entries(STEP_ERROR_KEYS).find(([, keys]) =>
      keys.some((key) => validation[key])
    )?.[0];

    if (primerPasoInvalido) {
      const paso = Number(primerPasoInvalido);
      setErrors(errorsDelPaso(validation, paso));
      setStep(paso);
      return;
    }
    setErrors({});
    onSubmit(form);
  }

  const meta = STEP_META[step - 1];

  // El badge "Sugerido por IA" solo se muestra mientras el campo siga
  // mostrando exactamente el valor que sugirió la IA — si el usuario lo
  // edita después, deja de coincidir y el badge desaparece solo, sin
  // necesidad de un flag aparte para distinguir "IA" de "manual".
  const hsCodeEsSugerenciaVigente =
    hsSuggestion.status === "success" &&
    !!form.partidaArancelariaTentativa &&
    hsSuggestion.hsCode === form.partidaArancelariaTentativa;

  return (
    <form onSubmit={handleSubmit}>
      <StepProgress step={step} />

      {step === 1 && (
        <SectionCard title={meta.title} description={meta.description}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                País de origen <span className="text-red-500">*</span>
              </label>
              <Select
                options={paisesDisponibles}
                value={form.paisOrigen}
                onChange={(paisOrigen) => update({ paisOrigen })}
                placeholder="Selecciona un país"
              />
              {errors.paisOrigen && <p className="text-xs text-red-600 mt-1">{errors.paisOrigen}</p>}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Tipo de transporte <span className="text-red-500">*</span>
              </label>
              <EnumSelect
                value={form.transportType || undefined}
                onChange={(transportType) => update({ transportType })}
                options={TRANSPORT_TYPE_OPTIONS}
                placeholder="Selecciona una opción"
              />
              {errors.transportType && (
                <p className="text-xs text-red-600 mt-1">{errors.transportType}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                Modalidad de envío <span className="text-red-500">*</span>
              </label>
              <EnumSelect
                value={form.shipmentModality || undefined}
                onChange={(shipmentModality) => update({ shipmentModality })}
                options={SHIPMENT_MODALITY_OPTIONS}
                placeholder="Selecciona una opción"
              />
              {errors.shipmentModality && (
                <p className="text-xs text-red-600 mt-1">{errors.shipmentModality}</p>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {step === 2 && (
        <SectionCard title={meta.title} description={meta.description}>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              País de destino <span className="text-red-500">*</span>
            </label>
            <Select
              options={paisesDisponibles}
              value={form.paisDestino}
              onChange={(paisDestino) => update({ paisDestino })}
              placeholder="Selecciona un país"
            />
            {errors.paisDestino && <p className="text-xs text-red-600 mt-1">{errors.paisDestino}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Categoría</label>
            <Input
              value={form.categoria ?? ""}
              onChange={(e) => update({ categoria: e.target.value })}
              placeholder="Ej. Electrónica"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {chipsSugeridos.map((chip) => (
                <button
                  type="button"
                  key={chip}
                  onClick={() => update({ categoria: chip })}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    form.categoria === chip
                      ? "bg-cobalt text-white border-cobalt"
                      : "border-slate-300 text-slate-600 hover:border-cobalt"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              Descripción del producto <span className="text-red-500">*</span>
            </label>
            <Textarea
              rows={3}
              maxLength={1000}
              value={form.descripcionItem}
              onChange={(e) => update({ descripcionItem: e.target.value })}
              placeholder="Ej. Audífonos inalámbricos con estuche de carga"
              error={errors.descripcionItem}
            />
          </div>
        </SectionCard>
      )}

      {step === 3 && (
        <SectionCard title={meta.title} description={meta.description}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Peso (kg) *"
              type="number"
              step="0.01"
              min={0.01}
              value={form.pesoKg ?? ""}
              onChange={(e) =>
                update({ pesoKg: e.target.value === "" ? undefined : Number(e.target.value) })
              }
              error={errors.pesoKg}
            />
            <Input
              label="Valor declarado (USD) *"
              type="number"
              step="0.01"
              min={0}
              value={form.valorDeclaradoUsd ?? ""}
              onChange={(e) =>
                update({
                  valorDeclaradoUsd: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              error={errors.valorDeclaradoUsd}
            />
            <Input
              label="Cantidad de unidades"
              type="number"
              min={1}
              value={form.cantidadUnidades ?? 1}
              onChange={(e) => update({ cantidadUnidades: Number(e.target.value) || 1 })}
            />
            <div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                <label className="text-xs font-medium text-slate-500">
                  Partida arancelaria (HS Code) — opcional
                </label>
                {hsSuggestion.status === "loading" && (
                  <span className="flex items-center gap-1 text-[11px] text-cobalt shrink-0">
                    <Loader2 className="w-3 h-3 animate-spin text-cian" />
                    Generando...
                  </span>
                )}
                {hsCodeEsSugerenciaVigente && (
                  <span className="flex items-center gap-1 text-[11px] text-cobalt bg-cian/10 rounded-full px-2 py-0.5 shrink-0">
                    <Sparkles className="w-3 h-3 text-cian" />
                    Sugerido por IA
                  </span>
                )}
              </div>
              <Input
                value={form.partidaArancelariaTentativa ?? ""}
                onChange={(e) => update({ partidaArancelariaTentativa: e.target.value })}
                placeholder={
                  hsSuggestion.status === "loading" ? "Generando sugerencia..." : "Ej. 851762"
                }
                disabled={hsSuggestion.status === "loading"}
              />
              {hsSuggestion.status === "low_confidence" && (
                <p className="text-[11px] text-slate-500 mt-1">
                  No se pudo inferir la partida arancelaria. Ingresa una manualmente.
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Si dejas la partida arancelaria en blanco, la IA la inferirá a partir de la categoría y la
            descripción.
          </p>
        </SectionCard>
      )}

      {step === 4 && (
        <SectionCard title={meta.title} description={meta.description}>
          <YesNoToggle
            value={decl.contieneBateriaLitio}
            onChange={(contieneBateriaLitio) => updateDecl({ contieneBateriaLitio })}
          />
          {decl.contieneBateriaLitio && (
            <SubfieldsGrid>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  Tipo de batería <span className="text-red-500">*</span>
                </label>
                <EnumSelect
                  value={decl.bateria?.tipo}
                  onChange={(tipo) => updateDecl({ bateria: { ...decl.bateria, tipo } })}
                  options={BATTERY_TYPE_OPTIONS}
                  placeholder="Selecciona un tipo"
                />
                {errors.bateriaTipo && (
                  <p className="text-xs text-red-600 mt-1">{errors.bateriaTipo}</p>
                )}
              </div>
              <Input
                label="Watt-hora (Wh)"
                type="number"
                min={0}
                value={decl.bateria?.wattHora ?? ""}
                onChange={(e) =>
                  updateDecl({
                    bateria: {
                      ...decl.bateria,
                      wattHora: e.target.value === "" ? undefined : Number(e.target.value),
                    },
                  })
                }
              />
              <Input
                label="Contenido de litio (g)"
                type="number"
                min={0}
                value={decl.bateria?.gramosLitio ?? ""}
                onChange={(e) =>
                  updateDecl({
                    bateria: {
                      ...decl.bateria,
                      gramosLitio: e.target.value === "" ? undefined : Number(e.target.value),
                    },
                  })
                }
              />
              <Input
                label="Cantidad de baterías"
                type="number"
                min={1}
                value={decl.bateria?.cantidad ?? ""}
                onChange={(e) =>
                  updateDecl({
                    bateria: {
                      ...decl.bateria,
                      cantidad: e.target.value === "" ? undefined : Number(e.target.value),
                    },
                  })
                }
              />
            </SubfieldsGrid>
          )}
        </SectionCard>
      )}

      {step === 5 && (
        <SectionCard title={meta.title} description={meta.description}>
          <YesNoToggle
            value={decl.contieneLiquidos}
            onChange={(contieneLiquidos) => updateDecl({ contieneLiquidos })}
          />
          {decl.contieneLiquidos && (
            <SubfieldsGrid>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  Categoría del líquido <span className="text-red-500">*</span>
                </label>
                <EnumSelect
                  value={decl.liquido?.categoria}
                  onChange={(categoria) => updateDecl({ liquido: { ...decl.liquido, categoria } })}
                  options={LIQUID_CATEGORY_OPTIONS}
                  placeholder="Selecciona una categoría"
                />
                {errors.liquidoCategoria && (
                  <p className="text-xs text-red-600 mt-1">{errors.liquidoCategoria}</p>
                )}
              </div>
              <Input
                label="Volumen total (ml)"
                type="number"
                min={0}
                value={decl.liquido?.volumenTotalMl ?? ""}
                onChange={(e) =>
                  updateDecl({
                    liquido: {
                      ...decl.liquido,
                      volumenTotalMl: e.target.value === "" ? undefined : Number(e.target.value),
                    },
                  })
                }
              />
              <div className="sm:col-span-2">
                <Checkbox
                  label="Es inflamable"
                  checked={decl.liquido?.esInflamable ?? false}
                  onChange={() =>
                    updateDecl({
                      liquido: { ...decl.liquido, esInflamable: !decl.liquido?.esInflamable },
                    })
                  }
                />
              </div>
            </SubfieldsGrid>
          )}
        </SectionCard>
      )}

      {step === 6 && (
        <SectionCard title={meta.title} description={meta.description}>
          <YesNoToggle
            value={decl.esOrganicoOBiologico}
            onChange={(esOrganicoOBiologico) => updateDecl({ esOrganicoOBiologico })}
          />
          {decl.esOrganicoOBiologico && (
            <SubfieldsGrid>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  Tipo de producto <span className="text-red-500">*</span>
                </label>
                <EnumSelect
                  value={decl.organico?.tipo}
                  onChange={(tipo) => updateDecl({ organico: { ...decl.organico, tipo } })}
                  options={ORGANIC_TYPE_OPTIONS}
                  placeholder="Selecciona un tipo"
                />
                {errors.organicoTipo && (
                  <p className="text-xs text-red-600 mt-1">{errors.organicoTipo}</p>
                )}
              </div>
              <div className="flex flex-col gap-2 justify-center">
                <Checkbox
                  label="Es perecedero"
                  checked={decl.organico?.esPerecedero ?? false}
                  onChange={() =>
                    updateDecl({
                      organico: { ...decl.organico, esPerecedero: !decl.organico?.esPerecedero },
                    })
                  }
                />
                <Checkbox
                  label="Tiene certificado fitosanitario"
                  checked={decl.organico?.tieneCertificadoFitosanitario ?? false}
                  onChange={() =>
                    updateDecl({
                      organico: {
                        ...decl.organico,
                        tieneCertificadoFitosanitario: !decl.organico?.tieneCertificadoFitosanitario,
                      },
                    })
                  }
                />
              </div>
            </SubfieldsGrid>
          )}
        </SectionCard>
      )}

      {step === 7 && (
        <SectionCard title={meta.title} description={meta.description}>
          <YesNoToggle
            value={decl.esMedicamentoRegulado}
            onChange={(esMedicamentoRegulado) => updateDecl({ esMedicamentoRegulado })}
          />
          {decl.esMedicamentoRegulado && (
            <SubfieldsGrid>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  Tipo de regulación <span className="text-red-500">*</span>
                </label>
                <EnumSelect
                  value={decl.medico?.tipo}
                  onChange={(tipo) => updateDecl({ medico: { ...decl.medico, tipo } })}
                  options={MEDICAL_TYPE_OPTIONS}
                  placeholder="Selecciona un tipo"
                />
                {errors.medicoTipo && (
                  <p className="text-xs text-red-600 mt-1">{errors.medicoTipo}</p>
                )}
              </div>
              <div className="flex items-center">
                <Checkbox
                  label="Es sustancia controlada"
                  checked={decl.medico?.esSustanciaControlada ?? false}
                  onChange={() =>
                    updateDecl({
                      medico: { ...decl.medico, esSustanciaControlada: !decl.medico?.esSustanciaControlada },
                    })
                  }
                />
              </div>
            </SubfieldsGrid>
          )}
        </SectionCard>
      )}

      {step === 8 && (
        <SectionCard title={meta.title} description={meta.description}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {OTHER_DANGEROUS_GOODS_OPTIONS.map((opt) => (
              <Checkbox
                key={opt.value}
                label={opt.label}
                checked={decl.otrasMercanciasPeligrosas.includes(opt.value)}
                onChange={() => toggleOtraMercancia(opt.value)}
              />
            ))}
          </div>
        </SectionCard>
      )}

      <div className="flex items-center justify-between pt-2">
        {step > 1 ? (
          <Button type="button" variant="secondary" onClick={handleBack}>
            Anterior
          </Button>
        ) : (
          <span />
        )}

        {step < TOTAL_STEPS ? (
          // key distinta a la del botón de abajo: evita que React reutilice
          // el mismo nodo <button> y le mute el atributo type de "button" a
          // "submit" dentro del propio click que avanza de paso — eso hacía
          // que el navegador interpretara la mutación como parte de la
          // acción por defecto de ESE click y enviara el formulario un paso
          // antes de tiempo.
          <Button key="siguiente" type="button" onClick={handleNext}>
            Siguiente
          </Button>
        ) : (
          <Button
            key="evaluar"
            type="submit"
            disabled={isSubmitting || esperaSegundos > 0}
            className="w-full sm:w-auto"
          >
            {isSubmitting
              ? "Evaluando envío..."
              : esperaSegundos > 0
                ? `Espera ${esperaSegundos} s`
                : "Evaluar envío"}
          </Button>
        )}
      </div>
    </form>
  );
}
