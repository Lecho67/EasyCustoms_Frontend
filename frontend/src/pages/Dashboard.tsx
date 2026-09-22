import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { VerdictBadge } from "@/components/verdict/VerdictBadge";
import { Button } from "@/components/ui/Button";
import { fetchConsultas } from "@/lib/queryHistoryService";
import { useAuth } from "@/hooks/useAuth";
import type { DiagnosticoEnvio } from "@/lib/types";

export function Dashboard() {
  const { user, profile } = useAuth();
  const [consultas, setConsultas] = useState<DiagnosticoEnvio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConsultas()
      .then(setConsultas)
      .finally(() => setLoading(false));
  }, []);

  const recientes = consultas.slice(0, 5);

  const displayName =
    profile?.full_name?.trim() || user?.email?.split("@")[0] || "usuario";

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-cobalt mb-1">Hola, {displayName}</h1>
      <p className="text-slate-500 mb-8">
        {loading ? "Cargando tus consultas..." : `Tienes ${consultas.length} consultas registradas.`}
      </p>

      <div className="mb-8 flex flex-col gap-4 rounded-xl border-2 border-cobalt bg-cobalt/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="font-semibold text-slate-900">¿Nuevo envío?</p>
          <p className="text-sm text-slate-600">Obtén tu diagnóstico en menos de 1 minuto.</p>
        </div>
        <Link to="/consulta/nueva" className="shrink-0">
          <Button className="w-full sm:w-auto">Nueva consulta</Button>
        </Link>
      </div>

      <h2 className="font-semibold text-slate-900 mb-3">Consultas recientes</h2>
      {loading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : recientes.length === 0 ? (
        <p className="text-sm text-slate-400">Aún no tienes consultas.</p>
      ) : (
        <div className="space-y-2">
          {recientes.map((c) => (
            <Link
              key={c.id}
              to={`/consulta/${c.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-cobalt"
            >
              <div className="flex min-w-0 items-center gap-3">
                <VerdictBadge nivel={c.nivel} />
                <span className="truncate text-sm text-slate-700">{c.input.descripcionItem}</span>
              </div>
              <span className="shrink-0 text-xs text-slate-400">{c.input.paisDestino}</span>
            </Link>
          ))}
        </div>
      )}

      <Link to="/dashboard/historial" className="inline-block mt-6 text-sm text-cobalt font-medium">
        Ver todo el historial →
      </Link>
    </main>
  );
}