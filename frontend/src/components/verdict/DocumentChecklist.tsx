import { useState } from "react";
import { Check, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import type { NivelVeredicto } from "@/lib/types";

interface DocumentChecklistProps {
  documentos: string[];
  nivel: NivelVeredicto;
}

export function DocumentChecklist({ documentos, nivel }: DocumentChecklistProps) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const toggle = (i: number) => setChecked((prev) => ({ ...prev, [i]: !prev[i] }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4" /> Documentos requeridos
      </p>

      {documentos.length > 0 ? (
        <div className="space-y-2">
          {documentos.map((doc, i) => (
            <Checkbox key={i} label={doc} checked={!!checked[i]} onChange={() => toggle(i)} />
          ))}
          <p className="mt-3 text-xs text-slate-400">
            Estos documentos te los da quien te vendió el producto o el transportista — no los
            genera Easy CUSTOMS.
          </p>
        </div>
      ) : nivel === "verde" ? (
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-verdict-green-text" /> Empaque resistente acorde al valor declarado
          </li>
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-verdict-green-text" /> Etiqueta con descripción precisa del contenido
          </li>
        </ul>
      ) : (
        <p className="text-sm text-slate-400">No aplica — el envío no puede procesarse.</p>
      )}
    </div>
  );
}
