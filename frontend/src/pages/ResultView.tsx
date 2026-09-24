// src/pages/ResultView.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { History as HistoryIcon, Plus, CheckCircle2, Info } from "lucide-react";
import { useQueryStore } from "@/store/useQueryStore";
import { fetchConsultaById } from "@/lib/queryHistoryService";
import { VerdictCard } from "@/components/verdict/VerdictCard";
import { NextStepsCard } from "@/components/verdict/NextStepsCard";
import { JustificationCard } from "@/components/verdict/JustificationCard";
import { DocumentChecklist } from "@/components/verdict/DocumentChecklist";
import { TaxBreakdownCard } from "@/components/verdict/TaxBreakdownCard";
import { Button } from "@/components/ui/Button";
import type { DiagnosticoEnvio } from "@/lib/types";

export function ResultView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const getConsultaById = useQueryStore((s) => s.getConsultaById);
  const addConsulta = useQueryStore((s) => s.addConsulta);

  const [diagnostico, setDiagnostico] = useState<DiagnosticoEnvio | null | undefined>(
    id ? getConsultaById(id) : undefined
  );
  const [isLoading, setIsLoading] = useState(!diagnostico);

  useEffect(() => {
    if (diagnostico || !id) return;

    let cancelado = false;
    setIsLoading(true);

    fetchConsultaById(id).then((result) => {
      if (cancelado) return;
      if (result) {
        addConsulta(result);
        setDiagnostico(result);
      } else {
        setDiagnostico(null);
      }
      setIsLoading(false);
    });

    return () => {
      cancelado = true;
    };
  }, [id, diagnostico, addConsulta]);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 text-center text-slate-400">
        Cargando consulta...
      </div>
    );
  }

  if (!diagnostico) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 text-center text-slate-500">
        <p className="mb-4">No encontramos esta consulta.</p>
        <Link to="/consulta/nueva" className="text-cobalt underline">
          Iniciar una nueva consulta
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <VerdictCard diagnostico={diagnostico} />

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <p>
          Este resultado es una estimación orientativa generada con asistencia de IA, no una
          liquidación oficial de la DIAN. El valor final de tributos y la clasificación
          arancelaria definitiva los determina la autoridad aduanera o tu agencia de aduanas al
          momento de la nacionalización.
        </p>
      </div>

      <NextStepsCard acciones={diagnostico.accionesSugeridas} />

      <div className="grid sm:grid-cols-2 gap-4">
        <JustificationCard
          justificacion={diagnostico.justificacion}
          fuenteNormativa={diagnostico.fuenteNormativa}
        />
        <DocumentChecklist
          documentos={diagnostico.documentosRequeridos}
          nivel={diagnostico.nivel}
        />
      </div>

      <TaxBreakdownCard
        desglose={diagnostico.desgloseImpuestos}
        partidaArancelariaTentativa={diagnostico.partidaArancelariaTentativa}
        deMinimis={diagnostico.deMinimis}
      />

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <CheckCircle2 className="w-3.5 h-3.5" /> Guardado en tu historial
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={() => navigate("/dashboard/historial")}
          className="flex items-center gap-2"
        >
          <HistoryIcon className="w-4 h-4" /> Ver historial
        </Button>
        <Button
          onClick={() => navigate("/consulta/nueva")}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nueva consulta
        </Button>
      </div>
    </div>
  );
}