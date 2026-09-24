import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { actualizarPreferenciasNotificaciones } from "@/lib/profileService";
import { toast } from "@/lib/toast";
import type { NotificationPreferences } from "@/types/database.types";

const DEFAULTS: NotificationPreferences = {
  paquete_recibido: true,
  aprobado_aduana: true,
  impuesto_pendiente: true,
  canal_whatsapp_sms: false,
};

// Solo los tipos que hoy generan una notificación in-app.
const OPCIONES: { clave: keyof NotificationPreferences; titulo: string; detalle: string }[] = [
  {
    clave: "paquete_recibido",
    titulo: "Paquete recibido en bodega",
    detalle: "Cuando uno de tus paquetes pre-alertados llega a la bodega.",
  },
  {
    clave: "aprobado_aduana",
    titulo: "Novedades de aduana",
    detalle: "Cuando un agente revisa tu consulta y cambia el veredicto.",
  },
  {
    clave: "impuesto_pendiente",
    titulo: "Tributos a pagar",
    detalle: "Cuando la evaluación de un envío estima tributos aduaneros.",
  },
];

export function NotificationPreferencesCard() {
  const { profile, user, refreshProfile } = useAuth();
  const [guardando, setGuardando] = useState<keyof NotificationPreferences | null>(null);

  if (!profile || !user) return null;

  const prefs: NotificationPreferences = { ...DEFAULTS, ...(profile.notification_preferences ?? {}) };

  const toggle = async (clave: keyof NotificationPreferences) => {
    const siguiente = { ...prefs, [clave]: !prefs[clave] };
    setGuardando(clave);
    try {
      await actualizarPreferenciasNotificaciones(user.id, siguiente);
      await refreshProfile();
    } catch (err) {
      toast.error(
        "No se pudo guardar la preferencia",
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setGuardando(null);
    }
  };

  return (
    <section className="mb-8 rounded-xl border border-slate-200 p-5">
      <h2 className="mb-1 text-sm font-semibold text-slate-800">Preferencias de notificaciones</h2>
      <p className="mb-4 text-xs text-slate-400">
        Elige qué avisos quieres recibir en la campanita.
      </p>

      <div className="space-y-3">
        {OPCIONES.map(({ clave, titulo, detalle }) => (
          <label
            key={clave}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={prefs[clave]}
              disabled={guardando === clave}
              onChange={() => toggle(clave)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cobalt focus:ring-cobalt"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800">{titulo}</span>
              <span className="block text-xs text-slate-500">{detalle}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
