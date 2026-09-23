import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { fetchKycPendientes } from "@/lib/kycReviewService";
import { KycReviewCard } from "@/components/kyc/KycReviewCard";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { useAsyncData } from "@/hooks/useAsyncData";
import type { DocumentType, Profile } from "@/types/database.types";

const INTERVALO_REFRESCO_MS = 30_000;
const TIPOS_DOC: DocumentType[] = ["CC", "CE", "Pasaporte", "NIT"];

type Orden = "antiguas" | "recientes";

/**
 * Sin Realtime: la política RLS de SELECT de agente sobre `profiles` solo
 * cubre clientes con un caso (`customs_queries`) asignado o sin asignar —
 * un cliente que recién sube su KYC y todavía no hizo ninguna consulta no
 * entraría por esa vía. Los RPC (`listar_kyc_pendientes`) sí lo ven porque
 * son `SECURITY DEFINER` y bypasean RLS, así que actualizamos por polling
 * en vez de suscribirnos a `postgres_changes`.
 */
export function AgentKycPanel() {
  const [busqueda, setBusqueda] = useState("");
  const [tipoDoc, setTipoDoc] = useState<"todos" | DocumentType>("todos");
  const [orden, setOrden] = useState<Orden>("antiguas");

  const {
    data: perfiles,
    loading,
    error,
    reload: cargar,
    setData: setPerfiles,
  } = useAsyncData(fetchKycPendientes, [] as Profile[], [], {
    mensajeError: "Error al cargar las verificaciones",
  });

  useEffect(() => {
    const intervalo = setInterval(() => cargar({ silencioso: true }), INTERVALO_REFRESCO_MS);
    const alVolverElFoco = () => cargar({ silencioso: true });
    window.addEventListener("focus", alVolverElFoco);

    return () => {
      clearInterval(intervalo);
      window.removeEventListener("focus", alVolverElFoco);
    };
  }, [cargar]);

  const handleResuelto = (id: string) => {
    setPerfiles((prev) => prev.filter((p) => p.id !== id));
  };

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return perfiles
      .filter((p) => {
        if (tipoDoc !== "todos" && p.document_type !== tipoDoc) return false;
        if (!q) return true;
        return (
          (p.full_name ?? "").toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.document_number ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const cmp = (a.updated_at ?? "").localeCompare(b.updated_at ?? "");
        return orden === "antiguas" ? cmp : -cmp;
      });
  }, [perfiles, busqueda, tipoDoc, orden]);

  const { page, setPage, pageCount, pageItems } = usePagination(filtrados);

  const hayFiltros = busqueda !== "" || tipoDoc !== "todos" || orden !== "antiguas";
  const limpiarFiltros = () => {
    setBusqueda("");
    setTipoDoc("todos");
    setOrden("antiguas");
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 sm:mt-16 px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-cobalt">Verificación de Identidad (KYC)</h1>
        <button
          type="button"
          onClick={() => cargar()}
          className="flex items-center gap-1.5 text-sm font-medium text-cobalt hover:underline"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        {filtrados.length} de {perfiles.length}{" "}
        {perfiles.length === 1 ? "verificación pendiente" : "verificaciones pendientes"} — se
        actualiza solo cada 30 s
      </p>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {perfiles.length > 0 && (
        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <label htmlFor="kyc-busqueda" className="mb-1 block text-xs font-medium text-slate-600">
              Buscar
            </label>
            <input
              id="kyc-busqueda"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, correo o documento"
              className="w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="kyc-tipo-doc" className="mb-1 block text-xs font-medium text-slate-600">
              Tipo de documento
            </label>
            <select
              id="kyc-tipo-doc"
              value={tipoDoc}
              onChange={(e) => setTipoDoc(e.target.value as "todos" | DocumentType)}
              className="w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm"
            >
              <option value="todos">Todos</option>
              {TIPOS_DOC.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="kyc-orden" className="mb-1 block text-xs font-medium text-slate-600">
              Orden
            </label>
            <select
              id="kyc-orden"
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
              className="w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm"
            >
              <option value="antiguas">Más antiguas primero</option>
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
      ) : perfiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No hay verificaciones de identidad pendientes.
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Ninguna verificación coincide con los filtros.
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {pageItems.map((perfil) => (
              <KycReviewCard
                key={perfil.id}
                perfil={perfil}
                onResuelto={() => handleResuelto(perfil.id)}
              />
            ))}
          </div>
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </>
      )}
    </div>
  );
}
