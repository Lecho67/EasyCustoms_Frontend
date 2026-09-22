import { Receipt } from "lucide-react";
import type { DesgloseImpuestos } from "@/lib/types";

interface TaxBreakdownCardProps {
  desglose: DesgloseImpuestos | null;
  partidaArancelariaTentativa: string;
}

export function TaxBreakdownCard({ desglose, partidaArancelariaTentativa }: TaxBreakdownCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <p className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <Receipt className="w-4 h-4" /> Desglose de impuestos estimados
      </p>

      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
        <span className="text-slate-500">Partida arancelaria tentativa</span>
        <span className="font-mono-data min-w-0 break-words text-slate-700">{partidaArancelariaTentativa}</span>
      </div>

      {desglose ? (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Flete estimado</span>
            <span className="font-mono-data">${desglose.flete.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Arancel estimado ({(desglose.tasaArancelAplicada * 100).toFixed(0)}%)</span>
            <span className="font-mono-data">${desglose.arancel.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-slate-900 pt-2 border-t border-slate-200">
            <span>Total estimado</span>
            <span className="font-mono-data">${desglose.total.toFixed(2)}</span>
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