import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, Package, Truck } from "lucide-react";
import type { DiagnosticoEnvio } from "@/lib/types";
import { TRANSPORT_TYPE_LABELS, SHIPMENT_MODALITY_LABELS } from "@/lib/shipmentMapping";

const config = {
  verde: {
    bg: "bg-verdict-green-bg",
    border: "border-verdict-green-border",
    text: "text-emerald-900",
    iconBg: "bg-verdict-green-text",
    Icon: CheckCircle2,
  },
  amarillo: {
    bg: "bg-verdict-amber-bg",
    border: "border-verdict-amber-border",
    text: "text-amber-900",
    iconBg: "bg-verdict-amber-text",
    Icon: AlertTriangle,
  },
  rojo: {
    bg: "bg-verdict-red-bg",
    border: "border-verdict-red-border",
    text: "text-red-900",
    iconBg: "bg-verdict-red-text",
    Icon: XCircle,
  },
};

export function VerdictCard({ diagnostico }: { diagnostico: DiagnosticoEnvio }) {
  const { bg, border, text, iconBg, Icon } = config[diagnostico.nivel];

  // Consultas guardadas antes de que input.transportType/shipmentModality
  // existieran no tienen este dato — el pill simplemente no aparece.
  const regimenDeclarado =
    diagnostico.input.transportType && diagnostico.input.shipmentModality
      ? `${SHIPMENT_MODALITY_LABELS[diagnostico.input.shipmentModality]} · ${
          TRANSPORT_TYPE_LABELS[diagnostico.input.transportType]
        }`
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-xl border-l-4 ${bg} ${border} p-6`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          {/* Era un <p>: la página del veredicto no tenía ningún heading —
              un lector de pantalla navegando por encabezados no encontraba
              nada acá. */}
          <h1 className={`text-2xl font-semibold ${text} mb-1`}>{diagnostico.titulo}</h1>
          <p className={`text-sm ${text} opacity-80`}>{diagnostico.resumen}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 text-xs text-slate-600 font-mono-data">
              <Package className="w-3.5 h-3.5" />
              {diagnostico.input.descripcionItem}
            </div>
            {regimenDeclarado && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 text-xs text-slate-600">
                <Truck className="w-3.5 h-3.5" />
                {regimenDeclarado}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
