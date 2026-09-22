import { useEffect, useState } from "react";
import { Check, Clock, Copy, Pencil, Trash2 } from "lucide-react";
import { PreAlertForm } from "../components/PreAlertForm";
import { fetchMisPreAlertas, eliminarPreAlerta } from "@/lib/preAlertService";
import { useAuth } from "@/hooks/useAuth";
import type { PreAlert } from "@/types/database.types";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface LockerAddress {
  id: string;
  country: string;
  /** Dirección física de la bodega. Vacía hasta que se configure una real. */
  addressLine?: string;
  city?: string;
}

const ADDRESSES: LockerAddress[] = [{ id: "us", country: "Estados Unidos" }];

const STATUS_LABEL: Record<PreAlert["status"], string> = {
  pendiente: "Pendiente",
  recibido: "Recibido en bodega",
  en_transito: "En tránsito",
  entregado: "Entregado",
};

export default function Locker() {
  const { profile } = useAuth();
  // KYC en revisión: casillero en modo lectura (sin crear / editar / eliminar pre-alertas)
  const soloLectura = profile?.kyc_status === "pendiente";
  // El "suite" es el código de casillero del usuario (columna profiles.locker_code)
  const suite = profile?.locker_code
    ? `Suite ${profile.locker_code}`
    : "Suite pendiente de asignación";

  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<PreAlert | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [preAlertas, setPreAlertas] = useState<PreAlert[]>([]);
  const [eliminando, setEliminando] = useState<PreAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const data = await fetchMisPreAlertas();
      setPreAlertas(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar pre-alertas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  function handleCopy(addr: LockerAddress) {
    navigator.clipboard.writeText([suite, addr.addressLine, addr.city].filter(Boolean).join(", "));
    setCopiedId(addr.id);
    setTimeout(() => setCopiedId((current) => (current === addr.id ? null : current)), 2000);
  }

  const solicitarEliminar = (p: PreAlert) => {
  setEliminando(p);
};

  const confirmarEliminar = async () => {
    if (!eliminando) return;
    try {
      await eliminarPreAlerta(eliminando.id);
      setPreAlertas((prev) => prev.filter((p) => p.id !== eliminando.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setEliminando(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cobalt">Mi Casillero</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tu código de casillero y las pre-alertas de paquetes en tránsito.
          </p>
        </div>
        <button
          onClick={() => {
            setEditando(null);
            setShowForm(true);
          }}
          disabled={soloLectura}
          className="w-full sm:w-auto bg-cobalt text-white px-5 py-2.5 rounded-lg font-medium
                     hover:bg-cobalt/90 focus:outline-none focus:ring-2
                     focus:ring-cobalt focus:ring-offset-2 transition
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-cobalt"
        >
          + Pre-alertar paquete
        </button>
      </header>

      {soloLectura && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            Tu verificación de identidad está en revisión. Podés ver tu casillero, pero no vas a
            poder pre-alertar, editar ni eliminar paquetes hasta que se apruebe.
          </p>
        </div>
      )}

      <section className="grid sm:grid-cols-2 gap-4">
        {ADDRESSES.map((addr) => (
          <div key={addr.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-cian/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-cobalt">
                {addr.country}
              </span>
            </div>
            <p className="text-xs text-slate-400">Código de casillero</p>
            <p className="font-medium text-slate-900">{suite}</p>

            {addr.addressLine ? (
              <>
                <p className="mt-2 text-sm text-slate-600">{addr.addressLine}</p>
                <p className="text-sm text-slate-600">{addr.city}</p>
                <button
                  className={`mt-3 flex items-center gap-1.5 rounded text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cobalt ${
                    copiedId === addr.id ? "text-verdict-green-text" : "text-cobalt hover:underline"
                  }`}
                  onClick={() => handleCopy(addr)}
                >
                  {copiedId === addr.id ? (
                    <><Check className="h-3.5 w-3.5" /> Copiado</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5" /> Copiar dirección</>
                  )}
                </button>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Recibirás la dirección completa de la bodega cuando se habilite tu casillero.
              </p>
            )}
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Pre-alertas activas</h2>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-400">Cargando...</p>
        ) : preAlertas.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-500 text-sm">
            Aún no tienes paquetes pre-alertados. Usa el botón "Pre-alertar paquete" para que la IA escanee tu factura antes de que llegue a bodega.
          </div>
        ) : (
          <div className="space-y-3">
            {preAlertas.map((p) => (
              <div key={p.id} className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="break-words font-medium text-slate-900">{p.carrier} — {p.tracking_number}</p>
                  <p className="text-sm text-slate-600 truncate">{p.description}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span>${p.declared_value.toFixed(2)} USD</span>
                    <span>{STATUS_LABEL[p.status]}</span>
                  </div>
                </div>
                {!soloLectura && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setEditando(p);
                        setShowForm(true);
                      }}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 hover:text-cobalt"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => solicitarEliminar(p)}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
{eliminando && (
  <Modal open onClose={() => setEliminando(null)}>
    <h3 className="text-lg font-semibold text-slate-900 mb-2">Eliminar pre-alerta</h3>
    <p className="text-sm text-slate-600 mb-6">
      ¿Seguro que quieres eliminar la pre-alerta de{" "}
      <span className="font-medium text-slate-900">{eliminando.carrier} — {eliminando.tracking_number}</span>?
      Esta acción no se puede deshacer.
    </p>
    <div className="flex justify-end gap-3">
      <Button variant="ghost" onClick={() => setEliminando(null)} className="px-4 py-2">
        Cancelar
      </Button>
      <Button
        onClick={confirmarEliminar}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white"
      >
        Eliminar
      </Button>
    </div>
  </Modal>
)}
      {showForm && (
        <PreAlertForm
          onClose={() => setShowForm(false)}
          onSaved={cargar}
          preAlertaExistente={editando}
        />
      )}
    </div>
  );
}