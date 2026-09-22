import { useState } from "react";
import { Eye, IdCard } from "lucide-react";
import type { Profile } from "@/types/database.types";
import { obtenerUrlDocumentoIdentidad } from "@/lib/kycService";
import { revisarKyc } from "@/lib/kycReviewService";
import { toast } from "@/lib/toast";

interface Props {
  perfil: Profile;
  onResuelto: () => void;
}

const MOTIVO_MINIMO = 10;

export function KycReviewCard({ perfil, onResuelto }: Props) {
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [abriendoDoc, setAbriendoDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerDocumento = async () => {
    if (!perfil.kyc_document_path) {
      setError("Este usuario no tiene documento cargado.");
      return;
    }
    setAbriendoDoc(true);
    setError(null);
    try {
      const url = await obtenerUrlDocumentoIdentidad(perfil.kyc_document_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo abrir el documento";
      setError(msg);
      toast.error("No se pudo abrir el documento", msg);
    } finally {
      setAbriendoDoc(false);
    }
  };

  const handleRevisar = async (estado: "aprobado" | "rechazado") => {
    if (estado === "rechazado" && motivo.trim().length < MOTIVO_MINIMO) {
      setError(`Para rechazar, escribí un motivo de al menos ${MOTIVO_MINIMO} caracteres.`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await revisarKyc(perfil.id, estado, estado === "rechazado" ? motivo.trim() : undefined);
      toast.success(
        estado === "aprobado" ? "Identidad verificada" : "Verificación rechazada",
        `${perfil.full_name || perfil.email}`
      );
      onResuelto();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al revisar la verificación";
      setError(msg);
      toast.error("No se pudo completar la revisión", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{perfil.full_name || "(sin nombre)"}</p>
          <p className="text-sm text-slate-500">{perfil.email}</p>
        </div>
        <button
          onClick={handleVerDocumento}
          disabled={abriendoDoc}
          className="flex shrink-0 items-center gap-1 text-sm font-medium text-cobalt hover:underline disabled:opacity-50"
        >
          <Eye className="h-3.5 w-3.5" />
          {abriendoDoc ? "Abriendo…" : "Ver documento"}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <IdCard className="h-3.5 w-3.5 text-slate-400" />
          {perfil.document_type ?? "—"} {perfil.document_number ?? ""}
        </span>
        <span>Teléfono: {perfil.phone || "—"}</span>
        {!perfil.kyc_document_path && (
          <span className="text-amber-600">Sin foto de documento cargada</span>
        )}
      </div>

      {error && <p className="mb-2 text-sm text-red-500">{error}</p>}

      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo del rechazo (obligatorio para rechazar, mínimo 10 caracteres)"
        rows={2}
        className="mb-3 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cobalt sm:text-sm"
      />

      <div className="flex gap-2">
        <button
          onClick={() => handleRevisar("aprobado")}
          disabled={loading}
          className="min-h-11 flex-1 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 sm:flex-none"
        >
          Aprobar
        </button>
        <button
          onClick={() => handleRevisar("rechazado")}
          disabled={loading}
          className="min-h-11 flex-1 rounded-lg bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 sm:flex-none"
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}
