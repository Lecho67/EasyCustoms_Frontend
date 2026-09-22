import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchClientesDelGestor, type ClienteConCartera } from "@/lib/gestorService";
import { badgeVerdictoClasses, dotVerdictoClasses } from "@/lib/verdictBadge";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";

// Orden de peor a mejor: en el resumen colapsado se ve primero lo que necesita atención.
const VEREDICTOS_ORDEN = ["BLOQUEO", "REQUIERE_DOCUMENTACION", "PRECAUCION", "APROBADO"] as const;

export function GestorPanel() {
  const { profile } = useAuth();
  const [cartera, setCartera] = useState<ClienteConCartera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const gestorId = profile?.id;

  useEffect(() => {
    if (!gestorId) return;
    let cancelado = false;

    const cargar = async () => {
      setLoading(true);
      try {
        const data = await fetchClientesDelGestor(gestorId);
        if (cancelado) return;
        setCartera(data);
        // Con un solo cliente no tiene sentido un acordeón de 1: lo abre directo.
        if (data.length === 1) setExpandidos(new Set([data[0].cliente.id]));
        setError(null);
      } catch (err) {
        if (!cancelado) setError(err instanceof Error ? err.message : "Error al cargar la cartera");
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    cargar();
    return () => {
      cancelado = true;
    };
  }, [gestorId]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return cartera;
    return cartera.filter(
      ({ cliente }) =>
        (cliente.full_name ?? "").toLowerCase().includes(q) ||
        cliente.email.toLowerCase().includes(q),
    );
  }, [cartera, busqueda]);

  const { page, setPage, pageCount, pageItems } = usePagination(filtrados);

  const toggle = (id: string) =>
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="max-w-4xl mx-auto mt-10 sm:mt-16 px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-cobalt mb-1">Mis clientes</h1>
      <p className="text-sm text-slate-500 mb-6">
        {cartera.length} cliente{cartera.length !== 1 && "s"} en tu cartera.
      </p>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {cartera.length > 4 && (
        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <label htmlFor="gestor-busqueda" className="mb-1 block text-xs font-medium text-slate-600">
              Buscar cliente
            </label>
            <input
              id="gestor-busqueda"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o correo"
              className="w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm"
            />
          </div>
          {busqueda && (
            <button onClick={() => setBusqueda("")} className="text-sm text-cobalt hover:underline">
              Limpiar
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : cartera.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Todavía no tenés clientes asignados.
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Ningún cliente coincide con la búsqueda.
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {pageItems.map(({ cliente, consultas, resumen }) => {
              const abierto = expandidos.has(cliente.id);
              return (
                <section
                  key={cliente.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  <button
                    type="button"
                    onClick={() => toggle(cliente.id)}
                    aria-expanded={abierto}
                    className="flex w-full items-center gap-4 p-4 text-left hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">
                        {cliente.full_name || cliente.email}
                      </p>
                      {cliente.full_name && (
                        <p className="truncate text-xs text-slate-400">{cliente.email}</p>
                      )}
                    </div>

                    <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
                      {consultas.length === 0 ? (
                        <span className="text-xs text-slate-400">Sin consultas</span>
                      ) : (
                        VEREDICTOS_ORDEN.filter((v) => resumen[v]).map((v) => (
                          <span
                            key={v}
                            title={v}
                            className="flex items-center gap-1 text-xs text-slate-500"
                          >
                            <span className={`h-2 w-2 rounded-full ${dotVerdictoClasses(v)}`} />
                            {resumen[v]}
                          </span>
                        ))
                      )}
                    </div>

                    <span className="shrink-0 text-xs text-slate-400">
                      {consultas.length} consulta{consultas.length !== 1 && "s"}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                        abierto ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {abierto && (
                    <div className="border-t border-slate-100 px-4 pb-3">
                      {consultas.length === 0 ? (
                        <p className="py-3 text-sm text-slate-400">Sin consultas todavía.</p>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {consultas.map((q) => (
                            <li
                              key={q.id}
                              className="flex items-center justify-between gap-3 py-2 text-sm"
                            >
                              <span className="min-w-0 truncate text-slate-700">
                                {q.product_description}
                              </span>
                              <span
                                className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${badgeVerdictoClasses(
                                  q.ai_verdict,
                                )}`}
                              >
                                {q.ai_verdict}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </>
      )}
    </div>
  );
}
