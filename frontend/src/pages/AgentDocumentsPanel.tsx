import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchDocumentosPendientes, type DocumentoConCliente } from "@/lib/documentReviewService";
import { DocumentReviewCard } from "@/components/documents/DocumentReviewCard";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { useAsyncData } from "@/hooks/useAsyncData";

type Asignacion = "todas" | "sin_asignar" | "mias";
type Orden = "antiguos" | "recientes";

export function AgentDocumentsPanel() {
  const { user } = useAuth();
  const {
    data: docs,
    loading,
    error,
    setData: setDocs,
  } = useAsyncData(fetchDocumentosPendientes, [] as DocumentoConCliente[], [], {
    mensajeError: "Error al cargar documentos",
  });

  const [busqueda, setBusqueda] = useState("");
  const [asignacion, setAsignacion] = useState<Asignacion>("todas");
  const [orden, setOrden] = useState<Orden>("antiguos");

  const handleResuelto = (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return docs
      .filter((d) => {
        if (asignacion === "sin_asignar" && d.assigned_agent_id) return false;
        if (asignacion === "mias" && d.assigned_agent_id !== user?.id) return false;
        if (!q) return true;
        return (
          d.file_name.toLowerCase().includes(q) ||
          (d.cliente?.full_name ?? "").toLowerCase().includes(q) ||
          (d.cliente?.email ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const cmp = a.created_at.localeCompare(b.created_at);
        return orden === "antiguos" ? cmp : -cmp;
      });
  }, [docs, busqueda, asignacion, orden, user?.id]);

  const { page, setPage, pageCount, pageItems } = usePagination(filtrados);

  const hayFiltros = busqueda !== "" || asignacion !== "todas" || orden !== "antiguos";
  const limpiarFiltros = () => {
    setBusqueda("");
    setAsignacion("todas");
    setOrden("antiguos");
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 sm:mt-16 px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-cobalt mb-2">Revisión de Documentos</h1>
      <p className="text-sm text-slate-500 mb-6">
        {filtrados.length} de {docs.length} documento{docs.length !== 1 && "s"} pendiente
        {docs.length !== 1 && "s"} de revisión
      </p>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {docs.length > 0 && (
        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <label htmlFor="doc-busqueda" className="mb-1 block text-xs font-medium text-slate-600">
              Buscar
            </label>
            <input
              id="doc-busqueda"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Cliente o nombre de archivo"
              className="w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="doc-asignacion" className="mb-1 block text-xs font-medium text-slate-600">
              Asignación
            </label>
            <select
              id="doc-asignacion"
              value={asignacion}
              onChange={(e) => setAsignacion(e.target.value as Asignacion)}
              className="w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm"
            >
              <option value="todas">Todas</option>
              <option value="sin_asignar">Sin asignar</option>
              <option value="mias">Asignadas a mí</option>
            </select>
          </div>
          <div>
            <label htmlFor="doc-orden" className="mb-1 block text-xs font-medium text-slate-600">
              Orden
            </label>
            <select
              id="doc-orden"
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
              className="w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm"
            >
              <option value="antiguos">Más antiguos primero</option>
              <option value="recientes">Más recientes primero</option>
            </select>
          </div>
          {hayFiltros && (
            <button onClick={limpiarFiltros} className="text-sm text-cobalt hover:underline">
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No hay documentos pendientes de revisión.
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Ningún documento coincide con los filtros.
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {pageItems.map((doc) => (
              <DocumentReviewCard key={doc.id} doc={doc} onResuelto={() => handleResuelto(doc.id)} />
            ))}
          </div>
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </>
      )}
    </div>
  );
}
