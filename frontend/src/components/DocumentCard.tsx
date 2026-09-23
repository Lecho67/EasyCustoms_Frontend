import { FileText, Trash2, Eye, CheckCircle2, XCircle, Clock, Upload } from "lucide-react";
import type { DocumentRecord } from "@/types/database.types";

interface DocumentCardProps {
  doc: DocumentRecord;
  onVer: (doc: DocumentRecord) => void;
  /** Si se omite (p. ej. casillero en modo lectura por KYC) no se muestran
   * "Eliminar" ni "Volver a subir". */
  onEliminar?: (doc: DocumentRecord) => void;
}

const ESTADO_CONFIG: Record<
  DocumentRecord["status"],
  { label: string; Icon: typeof CheckCircle2; classes: string }
> = {
  aprobado: { label: "Aprobado", Icon: CheckCircle2, classes: "bg-verdict-green-bg text-verdict-green-text" },
  rechazado: { label: "Rechazado", Icon: XCircle, classes: "bg-verdict-red-bg text-verdict-red-text" },
  pendiente: { label: "En revisión", Icon: Clock, classes: "bg-slate-100 text-slate-600" },
};

export function DocumentCard({ doc, onVer, onEliminar }: DocumentCardProps) {
  const estado = ESTADO_CONFIG[doc.status];

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <FileText className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate">{doc.file_name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{doc.file_type}</p>
          </div>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${estado.classes}`}
        >
          <estado.Icon className="h-3 w-3" />
          {estado.label}
        </span>
      </div>

      {doc.status === "rechazado" && doc.review_reason && (
        <div className="rounded-lg bg-verdict-red-bg p-3 text-xs text-verdict-red-text">
          <p className="font-medium">Motivo del rechazo</p>
          <p className="mt-0.5">{doc.review_reason}</p>
        </div>
      )}

      <p className="text-xs text-slate-400">
        {new Date(doc.created_at).toLocaleDateString()}
      </p>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          onClick={() => onVer(doc)}
          className="flex min-h-11 items-center gap-1.5 rounded text-sm font-medium text-cobalt hover:underline focus:outline-none focus:ring-2 focus:ring-cobalt"
        >
          <Eye className="w-3.5 h-3.5" /> Ver documento
        </button>
        {onEliminar && (
          <button
            onClick={() => onEliminar(doc)}
            className="flex min-h-11 items-center gap-1.5 rounded text-sm font-medium text-red-600 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </button>
        )}
        {onEliminar && doc.status === "rechazado" && (
          // Reusa el input de subida ya montado en Documents.tsx (id="upload-doc");
          // no hace falta lógica propia de "reemplazar", el label alcanza.
          <label
            htmlFor="upload-doc"
            className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded text-sm font-medium text-cobalt hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
          >
            <Upload className="w-3.5 h-3.5" /> Volver a subir
          </label>
        )}
      </div>
    </div>
  );
}
