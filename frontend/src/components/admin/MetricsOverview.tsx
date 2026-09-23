import { useEffect } from "react";
import { fetchMetricasGlobales, type MetricasGlobales } from "@/lib/adminService";
import { toast } from "@/lib/toast";
import { useAsyncData } from "@/hooks/useAsyncData";

export function MetricsOverview() {
  const { data: metricas, loading, error } = useAsyncData<MetricasGlobales | null>(
    fetchMetricasGlobales,
    null,
    [],
    { mensajeError: "Error al cargar métricas" }
  );

  useEffect(() => {
    if (error) toast.error("No se pudieron cargar las métricas", error);
  }, [error]);

  if (loading) {
    return (
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        ))}
      </div>
    );
  }

  if (error || !metricas) {
    return (
      <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        {error || "No hay métricas disponibles."}
      </div>
    );
  }

  return (
    <div className="mb-8 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total consultas</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{metricas.totalConsultas}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Aprobados</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">{metricas.porcentajeAprobados}%</p>
          <p className="text-xs text-slate-500">{metricas.aprobados} de {metricas.totalConsultas}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Bloqueados</p>
          <p className="mt-1 text-3xl font-bold text-red-600">{metricas.porcentajeBloqueados}%</p>
          <p className="text-xs text-slate-500">{metricas.bloqueados} de {metricas.totalConsultas}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
          Casos atendidos por agente
        </p>
        {metricas.casosPorAgente.length === 0 ? (
          <p className="text-sm text-slate-400">Todavía no hay casos resueltos por agentes.</p>
        ) : (
          <ul className="space-y-2">
            {metricas.casosPorAgente.map((a) => (
              <li key={a.agentId} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{a.nombre}</span>
                <span className="font-medium text-slate-900">{a.total} caso{a.total !== 1 && "s"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}