import { useRef, useState } from "react";
import { Clock, Upload } from "lucide-react";
import { DocumentCard } from "../components/DocumentCard";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  fetchMisDocumentos,
  subirDocumento,
  obtenerUrlDocumento,
  eliminarDocumento,
} from "@/lib/documentService";
import type { DocumentRecord } from "@/types/database.types";

export default function Documents() {
  const { profile } = useAuth();
  // KYC en revisión: se pueden ver los documentos pero no subir ni eliminar.
  const soloLectura = profile?.kyc_status === "pendiente";

  const {
    data: documentos,
    loading,
    error,
    reload: cargar,
    setData: setDocumentos,
    setError,
  } = useAsyncData(fetchMisDocumentos, [] as DocumentRecord[], [], {
    mensajeError: "Error al cargar documentos",
  });
  const [subiendo, setSubiendo] = useState(false);
  const [eliminando, setEliminando] = useState<DocumentRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || soloLectura) return;

    setSubiendo(true);
    setError(null);
    try {
      await subirDocumento(file);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir el documento");
    } finally {
      setSubiendo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleVer = async (doc: DocumentRecord) => {
    try {
      const url = await obtenerUrlDocumento(doc.file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al abrir el documento");
    }
  };

  const confirmarEliminar = async () => {
    if (!eliminando) return;
    try {
      await eliminarDocumento(eliminando);
      setDocumentos((prev) => prev.filter((d) => d.id !== eliminando.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setEliminando(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cobalt">Centro de Documentación Aduanera</h1>
          <p className="text-sm text-slate-500 mt-1">
            Organiza facturas, certificados de origen y registros de importación.
          </p>
        </div>

        <div className="w-full sm:w-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            className="hidden"
            id="upload-doc"
            disabled={soloLectura}
          />
          <label
            htmlFor={soloLectura ? undefined : "upload-doc"}
            aria-disabled={soloLectura}
            className={`flex w-full items-center justify-center gap-2 rounded-lg bg-cobalt px-5 py-2.5 font-medium text-white transition sm:w-auto ${
              soloLectura
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-cobalt/90 cursor-pointer"
            }`}
          >
            <Upload className="w-4 h-4" />
            {subiendo ? "Subiendo..." : "Subir documento"}
          </label>
        </div>
      </header>

      {soloLectura && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            Tu verificación de identidad está en revisión. Podés ver tus documentos, pero no vas a
            poder subir ni eliminar hasta que se apruebe.
          </p>
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : documentos.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-500 text-sm">
          No has subido ningún documento todavía.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documentos.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onVer={handleVer}
              onEliminar={soloLectura ? undefined : setEliminando}
            />
          ))}
        </div>
      )}

      {eliminando && (
        <Modal open onClose={() => setEliminando(null)}>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Eliminar documento</h3>
          <p className="text-sm text-slate-600 mb-6">
            ¿Seguro que quieres eliminar{" "}
            <span className="break-words font-medium text-slate-900">{eliminando.file_name}</span>? Esta acción no se puede deshacer.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setEliminando(null)} className="px-4 py-2">
              Cancelar
            </Button>
            <Button onClick={confirmarEliminar} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white">
              Eliminar
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}