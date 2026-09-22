import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { revisarCaso, tomarCaso, type CasoEnCola } from "@/lib/agentService";
import {
  fetchDocumentosDeCliente,
  obtenerUrlDocumentoParaRevision,
} from "@/lib/documentReviewService";
import type { DocumentRecord } from "@/types/database.types";
import type { DiagnosticoEnvio } from "@/lib/types";
import { toast } from "@/lib/toast";
import { ShipmentTimeline } from "@/components/agent/ShipmentTimeline";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface Props {
  caso: CasoEnCola;
  currentUserId?: string;
  onClose: () => void;
  onResuelto: () => void;
}

const docStatusClasses: Record<DocumentRecord["status"], string> = {
  pendiente: "bg-amber-100 text-amber-800",
  aprobado: "bg-emerald-100 text-emerald-700",
  rechazado: "bg-red-100 text-red-700",
};

export function CasoRevisionCard({ caso, currentUserId, onClose, onResuelto }: Props) {
  const diagnostico = caso.raw_response as Partial<DiagnosticoEnvio> | null;

  const [modoOverride, setModoOverride] = useState(false);
  const [nuevoVeredicto, setNuevoVeredicto] = useState("APROBADO");
  const [motivo, setMotivo] = useState("");
  const [motivoDocs, setMotivoDocs] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tomado, setTomado] = useState(caso.assigned_agent_id != null);
  const [asignadoA, setAsignadoA] = useState(caso.assigned_agent_id);

  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [abriendoDocId, setAbriendoDocId] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    let activo = true;
    setDocsLoading(true);
    fetchDocumentosDeCliente(caso.user_id)
      .then((data) => {
        if (activo) setDocs(data);
      })
      .catch(() => {
        if (activo) setDocs([]);
      })
      .finally(() => {
        if (activo) setDocsLoading(false);
      });
    return () => {
      activo = false;
    };
  }, [caso.user_id]);

  const deOtroAgente = asignadoA != null && asignadoA !== currentUserId;

  const handleVerDocumento = async (doc: DocumentRecord) => {
    setAbriendoDocId(doc.id);
    try {
      const url = await obtenerUrlDocumentoParaRevision(doc.file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(
        "No se pudo abrir el documento",
        err instanceof Error ? err.message : "Intentá de nuevo en unos segundos."
      );
    } finally {
      setAbriendoDocId(null);
    }
  };

  const handleTomarCaso = async () => {
    setLoading(true);
    setError(null);
    try {
      await tomarCaso(caso.id);
      setTomado(true);
      setAsignadoA(currentUserId ?? null);
      toast.success("Caso tomado", "Ya podés auditar este caso.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al tomar el caso";
      setError(msg);
      toast.error("No se pudo tomar el caso", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarIA = async () => {
    setLoading(true);
    setError(null);
    try {
      await revisarCaso(caso.id, caso.ai_verdict, "Confirmado sin cambios por agente humano");
      toast.success("Veredicto confirmado", "Se registró la confirmación del veredicto de la IA.");
      onResuelto();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al confirmar el veredicto";
      setError(msg);
      toast.error("No se pudo confirmar el veredicto", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSobreescribir = async () => {
    if (motivo.trim().length < 10) {
      setError("La justificación debe tener al menos 10 caracteres");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await revisarCaso(caso.id, nuevoVeredicto, motivo);
      toast.success("Veredicto sobreescrito", `Nuevo veredicto: ${nuevoVeredicto}.`);
      onResuelto();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al sobreescribir el veredicto";
      setError(msg);
      toast.error("No se pudo sobreescribir el veredicto", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSolicitarDocumentos = async () => {
    setLoading(true);
    setError(null);
    try {
      await revisarCaso(
        caso.id,
        "REQUIERE_DOCUMENTACION",
        motivoDocs.trim() || "Se solicitan documentos adicionales al cliente"
      );
      toast.success("Documentación solicitada", "Se notificó que el caso requiere documentos adicionales.");
      onResuelto();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al solicitar documentos";
      setError(msg);
      toast.error("No se pudo solicitar la documentación", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow"
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Auditoría de caso
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              {caso.cliente?.full_name || caso.cliente?.email || caso.user_id}
            </h2>
            {caso.cliente?.email && (
              <p className="text-sm text-slate-500">{caso.cliente.email}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 p-5 sm:p-6">
          {/* Vista previa del paquete */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Vista previa del paquete</h3>
            <div className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm">
              <p className="text-slate-800">{diagnostico?.input?.descripcionItem || caso.product_description}</p>
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                <p>País destino: <span className="text-slate-700">{diagnostico?.input?.paisDestino || "—"}</span></p>
                <p>Peso: <span className="text-slate-700">{diagnostico?.input?.pesoKg ? `${diagnostico.input.pesoKg} kg` : "—"}</span></p>
                <p>Valor declarado: <span className="text-slate-700">{diagnostico?.input?.valorDeclaradoUsd ? `US$ ${diagnostico.input.valorDeclaradoUsd}` : "—"}</span></p>
                <p>Partida arancelaria: <span className="text-slate-700">{diagnostico?.partidaArancelariaTentativa || caso.hs_code || "—"}</span></p>
              </div>
              {diagnostico?.resumen && (
                <p className="border-t border-slate-100 pt-2 text-slate-600">{diagnostico.resumen}</p>
              )}
              {diagnostico?.justificacion && (
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-600">Justificación IA: </span>
                  {diagnostico.justificacion}
                </p>
              )}
              {diagnostico?.fuenteNormativa && (
                <p className="text-xs text-slate-400">Fuente: {diagnostico.fuenteNormativa}</p>
              )}
              {diagnostico?.documentosRequeridos && diagnostico.documentosRequeridos.length > 0 && (
                <div className="text-xs text-slate-600">
                  <p className="font-medium text-slate-700">Documentos requeridos:</p>
                  <ul className="list-disc pl-4">
                    {diagnostico.documentosRequeridos.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
              {diagnostico?.desgloseImpuestos && (
                <div className="grid grid-cols-1 gap-1 border-t border-slate-100 pt-2 text-xs text-slate-500 sm:grid-cols-2">
                  <p>Flete: US$ {diagnostico.desgloseImpuestos.flete}</p>
                  <p>Arancel: US$ {diagnostico.desgloseImpuestos.arancel}</p>
                  <p>Tasa aplicada: {diagnostico.desgloseImpuestos.tasaArancelAplicada}%</p>
                  <p className="font-medium text-slate-700">Total: US$ {diagnostico.desgloseImpuestos.total}</p>
                </div>
              )}
            </div>
          </section>

          {/* Documentos adjuntos */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Documentos del cliente</h3>
            {docsLoading ? (
              <p className="text-sm text-slate-400">Cargando documentos…</p>
            ) : docs.length === 0 ? (
              <p className="text-sm text-slate-400">Este cliente no tiene documentos cargados.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {docs.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-700">{doc.file_name}</p>
                      <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${docStatusClasses[doc.status]}`}>
                        {doc.status}
                      </span>
                    </div>
                    <button
                      onClick={() => handleVerDocumento(doc)}
                      disabled={abriendoDocId === doc.id}
                      className="shrink-0 text-sm font-medium text-cobalt hover:underline disabled:opacity-50"
                    >
                      {abriendoDocId === doc.id ? "Abriendo…" : "Ver"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Trazabilidad del caso */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Trazabilidad del caso</h3>
            <div className="rounded-xl border border-slate-200 p-4">
              {docsLoading ? (
                <p className="text-sm text-slate-400">Cargando línea de tiempo…</p>
              ) : (
                <ShipmentTimeline caso={caso} docs={docs} />
              )}
            </div>
          </section>

          {/* Acciones */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Decisión</h3>

            {error && <p className="mb-2 text-sm text-red-500">{error}</p>}

            {deOtroAgente ? (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                Este caso ya fue tomado por otro agente.
              </p>
            ) : !tomado ? (
              <button
                onClick={handleTomarCaso}
                disabled={loading}
                className="rounded-lg bg-cobalt px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cobalt-600 disabled:opacity-50"
              >
                {loading ? "Tomando…" : "Tomar caso"}
              </button>
            ) : !modoOverride ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleConfirmarIA}
                    disabled={loading}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Confirmar IA
                  </button>
                  <button
                    onClick={() => setModoOverride(true)}
                    disabled={loading}
                    className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                  >
                    Sobreescribir Veredicto
                  </button>
                </div>
                <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                  <label className="block text-xs font-medium text-slate-600">
                    Solicitar más documentos (opcional: motivo para el cliente)
                  </label>
                  <textarea
                    value={motivoDocs}
                    onChange={(e) => setMotivoDocs(e.target.value)}
                    placeholder="Ej: falta factura comercial legible"
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  <button
                    onClick={handleSolicitarDocumentos}
                    disabled={loading}
                    className="rounded-lg border border-slate-400 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    Solicitar Documentos
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={nuevoVeredicto}
                  onChange={(e) => setNuevoVeredicto(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="APROBADO">APROBADO</option>
                  <option value="BLOQUEO">BLOQUEO</option>
                  <option value="PRECAUCION">PRECAUCION</option>
                  <option value="REQUIERE_DOCUMENTACION">REQUIERE_DOCUMENTACION</option>
                </select>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Justificación del cambio (mínimo 10 caracteres) — obligatoria"
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSobreescribir}
                    disabled={loading}
                    className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                  >
                    Confirmar cambio
                  </button>
                  <button
                    onClick={() => setModoOverride(false)}
                    disabled={loading}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}