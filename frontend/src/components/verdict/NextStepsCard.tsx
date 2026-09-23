import { ListChecks } from "lucide-react";

interface NextStepsCardProps {
  acciones: string[];
}

/**
 * `diagnostico.accionesSugeridas` lo calcula el motor de reglas
 * (`buildDiagnosticoEnvio` en shipmentMapping.ts) pero hasta ahora no se
 * mostraba en ninguna pantalla — el cliente nunca veía qué hacer con su
 * veredicto. Va primero en ResultView, justo después de VerdictCard.
 */
export function NextStepsCard({ acciones }: NextStepsCardProps) {
  if (acciones.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 border-l-4 border-l-cobalt bg-white p-6">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-cobalt">
        <ListChecks className="h-4 w-4" /> Qué hacer ahora
      </p>
      <ol className="space-y-2.5 text-sm text-slate-700">
        {acciones.map((accion, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cobalt/10 text-xs font-semibold text-cobalt">
              {i + 1}
            </span>
            <span className="pt-0.5">{accion}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
