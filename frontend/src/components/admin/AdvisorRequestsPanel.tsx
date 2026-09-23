// src/components/admin/AdvisorRequestsPanel.tsx
import { useState } from "react";
import { UserCheck } from "lucide-react";
import {
  fetchSolicitudesPendientes,
  marcarSolicitudAtendida,
  type SolicitudAsesorConCliente,
} from "@/lib/advisorRequestService";
import { toast } from "@/lib/toast";
import { useAsyncData } from "@/hooks/useAsyncData";

/**
 * Cola de "pedir un asesor personal" (disparada desde el chat de ayuda del
 * cliente, ver SupportChatWidget). No asigna el gestor por sí sola: el admin
 * lo hace a mano desde la tabla de Usuarios de abajo, y acá solo marca la
 * solicitud como atendida una vez que ya asignó a alguien.
 */
export function AdvisorRequestsPanel() {
  const {
    data: solicitudes,
    loading,
    error,
    setData: setSolicitudes,
  } = useAsyncData(fetchSolicitudesPendientes, [] as SolicitudAsesorConCliente[], [], {
    mensajeError: "Error al cargar las solicitudes",
  });
  const [atendiendoId, setAtendiendoId] = useState<string | null>(null);

  async function handleMarcarAtendida(s: SolicitudAsesorConCliente) {
    setAtendiendoId(s.id);
    try {
      await marcarSolicitudAtendida(s.id);
      setSolicitudes((prev) => prev.filter((x) => x.id !== s.id));
      toast.success("Solicitud atendida", `${s.cliente_nombre || s.cliente_email} sale de la cola.`);
    } catch (err) {
      toast.error("No se pudo marcar como atendida", err instanceof Error ? err.message : undefined);
    } finally {
      setAtendiendoId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Cargando solicitudes...</p>;
  }

  return (
    <div>
      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {solicitudes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No hay solicitudes de asesor pendientes.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {solicitudes.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-medium text-slate-800">{s.cliente_nombre || "(sin nombre)"}</p>
                <p className="text-xs text-slate-500">{s.cliente_email}</p>
                {s.mensaje && <p className="mt-1 text-sm text-slate-600">"{s.mensaje}"</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(s.created_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <button
                onClick={() => handleMarcarAtendida(s)}
                disabled={atendiendoId === s.id}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <UserCheck className="h-3.5 w-3.5" />
                {atendiendoId === s.id ? "Marcando..." : "Marcar atendida"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
