// src/pages/NewQuery.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock } from "lucide-react";
import { useQueryStore } from "@/store/useQueryStore";
import { evaluarEnvio } from "@/lib/api";
import { segundosEsperaConsulta } from "@/lib/esperaConsulta";
import type { WizardFormData } from "@/lib/types";
import { ShipmentForm } from "@/components/ShipmentForm";
import { LoadingSkeleton } from "@/components/wizard/LoadingSkeleton";

export function NewQuery() {
  const navigate = useNavigate();
  const addConsulta = useQueryStore((s) => s.addConsulta);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Segundos que faltan para poder enviar otra consulta (0 = ya puede).
  const [espera, setEspera] = useState(0);

  // Al entrar: si acaba de enviar otra consulta, arranca ya con la cuenta regresiva.
  useEffect(() => {
    let cancelado = false;
    segundosEsperaConsulta().then((segundos) => {
      if (!cancelado) setEspera(segundos);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (espera <= 0) return;
    const id = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [espera]);

  async function handleSubmit(data: WizardFormData) {
    setError(null);

    // Se verifica ANTES de pasar a isSubmitting: ese estado desmonta el
    // formulario y, si se rechazara después, el usuario perdería lo que llenó.
    const restante = await segundosEsperaConsulta();
    if (restante > 0) {
      setEspera(restante);
      return;
    }

    setIsSubmitting(true);

    try {
      const diagnostico = await evaluarEnvio(data);
      addConsulta(diagnostico);
      navigate(`/consulta/${diagnostico.id}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo completar el análisis. Inténtalo de nuevo."
      );
      setIsSubmitting(false);
    }
  }

  if (isSubmitting) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Error:</strong> {error}
          </span>
        </div>
      )}

      {espera > 0 && (
        <div
          role="status"
          className="mb-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Acabas de enviar una consulta. Podrás enviar otra en <strong>{espera} s</strong>.
          </span>
        </div>
      )}

      <ShipmentForm
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        esperaSegundos={espera}
      />
    </div>
  );
}