import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchColaDeRevision, type CasoEnCola } from "@/lib/agentService";
import { CasoRevisionCard } from "@/components/agent/CasoRevisionCard";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";
import type { DiagnosticoEnvio } from "@/lib/types";
import { badgeVerdictoClasses } from "@/lib/verdictBadge";

function paisDeCaso(caso: CasoEnCola): string {
  const input = (caso.raw_response as Partial<DiagnosticoEnvio> | null)?.input;
  return input?.paisDestino || "—";
}



function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function estadoDeCaso(caso: CasoEnCola, currentUserId?: string): { label: string; classes: string } {
  if (!caso.assigned_agent_id) return { label: "Sin asignar", classes: "bg-slate-100 text-slate-600" };
  if (caso.assigned_agent_id === currentUserId)
    return { label: "Asignado a mí", classes: "bg-cobalt/10 text-cobalt" };
  return { label: "Asignado a otro agente", classes: "bg-slate-100 text-slate-500" };
}

export function AgentPanel() {
  const { user } = useAuth();
  const [casos, setCasos] = useState<CasoEnCola[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filtroPais, setFiltroPais] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [casoSeleccionadoId, setCasoSeleccionadoId] = useState<string | null>(null);

  const cargarCola = async () => {
    setLoading(true);
    try {
      const data = await fetchColaDeRevision();
      setCasos(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la cola");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCola();
  }, []);

  const paisesDisponibles = useMemo(() => {
    const set = new Set(casos.map(paisDeCaso).filter((p) => p !== "—"));
    return Array.from(set).sort();
  }, [casos]);

  const casosFiltrados = useMemo(() => {
    return casos.filter((caso) => {
      if (filtroPais !== "todos" && paisDeCaso(caso) !== filtroPais) return false;
      const fechaCaso = caso.created_at.slice(0, 10);
      if (fechaDesde && fechaCaso < fechaDesde) return false;
      if (fechaHasta && fechaCaso > fechaHasta) return false;
      return true;
    });
  }, [casos, filtroPais, fechaDesde, fechaHasta]);

  const { page, setPage, pageCount, pageItems } = usePagination(casosFiltrados);

  const casoSeleccionado = casos.find((c) => c.id === casoSeleccionadoId) ?? null;

  const handleResuelto = (id: string) => {
    setCasos((prev) => prev.filter((c) => c.id !== id));
    setCasoSeleccionadoId(null);
  };

  const limpiarFiltros = () => {
    setFiltroPais("todos");
    setFechaDesde("");
    setFechaHasta("");
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cobalt border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-10 sm:mt-16 px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-cobalt mb-2">Cola de Revisión</h1>
      <p className="text-slate-600 mb-6">
        {casosFiltrados.length} de {casos.length} caso{casos.length !== 1 && "s"} pendiente
        {casos.length !== 1 && "s"} de auditoría
      </p>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-4 mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div>
          <label htmlFor="filtro-pais" className="block text-xs font-medium text-slate-600 mb-1">
            País destino
          </label>
          <select
            id="filtro-pais"
            value={filtroPais}
            onChange={(e) => setFiltroPais(e.target.value)}
            className="w-full sm:w-auto border border-slate-300 rounded-lg px-3 py-2 text-base sm:text-sm bg-white"
          >
            <option value="todos">Todos</option>
            {paisesDisponibles.map((pais) => (
              <option key={pais} value={pais}>
                {pais}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filtro-desde" className="block text-xs font-medium text-slate-600 mb-1">
            Desde
          </label>
          <input
            id="filtro-desde"
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="w-full sm:w-auto border border-slate-300 rounded-lg px-3 py-2 text-base sm:text-sm bg-white"
          />
        </div>
        <div>
          <label htmlFor="filtro-hasta" className="block text-xs font-medium text-slate-600 mb-1">
            Hasta
          </label>
          <input
            id="filtro-hasta"
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="w-full sm:w-auto border border-slate-300 rounded-lg px-3 py-2 text-base sm:text-sm bg-white"
          />
        </div>
        {(filtroPais !== "todos" || fechaDesde || fechaHasta) && (
          <button onClick={limpiarFiltros} className="text-sm text-cobalt hover:underline">
            Limpiar filtros
          </button>
        )}
      </div>

      {casosFiltrados.length === 0 ? (
        <div className="border rounded p-4 bg-slate-50 text-sm text-slate-500">
          {casos.length === 0
            ? "No hay casos pendientes en este momento."
            : "Ningún caso coincide con los filtros aplicados."}
        </div>
      ) : (
        <>
          {/* Mobile: tarjetas. La tabla de 7 columnas es inusable a 360px. */}
          <ul className="space-y-3 md:hidden">
            {pageItems.map((caso) => {
              const estado = estadoDeCaso(caso, user?.id);
              return (
                <li key={caso.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 break-words font-medium text-slate-800">
                      {caso.cliente?.full_name || caso.cliente?.email || caso.user_id}
                    </p>
                    <span className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${estado.classes}`}>
                      {estado.label}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-sm text-slate-600">{caso.product_description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className={`rounded px-2 py-1 font-medium ${badgeVerdictoClasses(caso.ai_verdict)}`}>
                      {caso.ai_verdict}
                    </span>
                    <span>{paisDeCaso(caso)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatearFecha(caso.created_at)}</span>
                  </div>
                  <button
                    onClick={() => setCasoSeleccionadoId(caso.id)}
                    className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border border-cobalt text-sm font-medium text-cobalt transition-colors hover:bg-cobalt/5"
                  >
                    Auditar caso
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium">País</th>
                  <th className="px-4 py-3 font-medium">Veredicto IA</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((caso) => {
                  const estado = estadoDeCaso(caso, user?.id);
                  return (
                    <tr key={caso.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">
                          {caso.cliente?.full_name || caso.cliente?.email || caso.user_id}
                        </p>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-slate-600">
                        {caso.product_description}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{paisDeCaso(caso)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded ${badgeVerdictoClasses(caso.ai_verdict)}`}
                        >
                          {caso.ai_verdict}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatearFecha(caso.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${estado.classes}`}>
                          {estado.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setCasoSeleccionadoId(caso.id)}
                          className="text-sm font-medium text-cobalt hover:underline"
                        >
                          Auditar caso
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </>
      )}

      {casoSeleccionado && (
        <CasoRevisionCard
          caso={casoSeleccionado}
          currentUserId={user?.id}
          onClose={() => setCasoSeleccionadoId(null)}
          onResuelto={() => handleResuelto(casoSeleccionado.id)}
        />
      )}
    </div>
  );
}