import { Receipt } from "lucide-react";
import type { DesgloseImpuestos, InfoDeMinimis } from "@/lib/types";

interface TaxBreakdownCardProps {
  desglose: DesgloseImpuestos | null;
  partidaArancelariaTentativa: string;
  deMinimis: InfoDeMinimis | null;
}

export function TaxBreakdownCard({ desglose, partidaArancelariaTentativa, deMinimis }: TaxBreakdownCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <p className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <Receipt className="w-4 h-4" /> Desglose de impuestos estimados
      </p>

      {/* La pregunta #1 de cualquier importador: "¿pago impuestos o no?".
          El motor de reglas ya calcula esto (tax_estimation.de_minimis_*)
          pero hasta ahora se descartaba en el mapeo y nunca llegaba acá. */}
      {deMinimis && (
        <div
          className={`mb-4 rounded-lg px-3 py-2 text-xs font-medium ${
            deMinimis.superado ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {deMinimis.superado
            ? `Tu envío supera el tope libre de impuestos${
                deMinimis.valorTope != null ? ` (USD ${deMinimis.valorTope})` : ""
              }.`
            : `Tu envío está dentro del tope libre de impuestos${
                deMinimis.valorTope != null ? ` (hasta USD ${deMinimis.valorTope})` : ""
              }.`}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
        <span className="text-slate-500">Partida arancelaria (HS Code) tentativa</span>
        <span className="font-mono-data min-w-0 break-words text-slate-700">{partidaArancelariaTentativa}</span>
      </div>

      {desglose ? (
        <div className="space-y-2">
          <div className="flex justify-between text-base font-semibold text-slate-900">
            <span>Arancel estimado ({(desglose.tasaArancelAplicada * 100).toFixed(0)}%)</span>
            <span className="font-mono-data">${desglose.arancel.toFixed(2)}</span>
          </div>
          <p className="text-xs text-slate-400">
            Es lo que aduana calcularía sobre tu envío — no incluye el costo de transporte.
          </p>

          {/* El flete NO se suma al monto de arriba: es un cálculo interno de
              referencia (8% del valor, mínimo USD 8), no una cotización real
              de ningún transportista. Mostrarlo sumado como "total" hacía
              parecer una cifra inventada como si fuera parte del monto que
              cobra aduana. */}
          <div className="flex justify-between border-t border-dashed border-slate-200 pt-2 text-xs text-slate-500">
            <span>Flete (referencia interna, no es una cotización)</span>
            <span className="font-mono-data">${desglose.flete.toFixed(2)}</span>
          </div>

          <p className="text-xs text-slate-400 pt-1">
            Estimación preliminar — sujeta a clasificación arancelaria final.
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          Agrega el valor declarado en el formulario para ver el desglose de impuestos.
        </p>
      )}
    </div>
  );
}