import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Coins, Package, ShieldCheck, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/lib/toast";
import {
  fetchNotificaciones,
  marcarComoLeida,
  marcarTodasComoLeidas,
} from "@/lib/notificationService";
import type { NotificationRecord, NotificationType } from "@/types/database.types";

const ICONO: Record<NotificationType, LucideIcon> = {
  paquete_recibido: Package,
  aprobado_aduana: ShieldCheck,
  impuesto_pendiente: Coins,
};

function tiempoRelativo(iso: string): string {
  const segundos = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (segundos < 60) return "recién";
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

export function NotificationBell() {
  const { user } = useAuth();
  const [notificaciones, setNotificaciones] = useState<NotificationRecord[]>([]);
  const [abierto, setAbierto] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  const cargar = useCallback(async () => {
    try {
      setNotificaciones(await fetchNotificaciones());
    } catch {
      // Silencioso: la campanita no debe romper el Navbar si falla la carga.
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setNotificaciones([]);
      return;
    }
    cargar();

    const canal = supabase
      .channel(`notificaciones:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const nueva = payload.new as NotificationRecord;
          setNotificaciones((prev) => [nueva, ...prev]);
          toast.info(nueva.titulo, nueva.mensaje ?? undefined);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [user, cargar]);

  useEffect(() => {
    if (!abierto) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAbierto(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [abierto]);

  if (!user) return null;

  const handleClickNotificacion = async (n: NotificationRecord) => {
    if (n.leida) return;
    setNotificaciones((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
    try {
      await marcarComoLeida(n.id);
    } catch {
      cargar();
    }
  };

  const handleMarcarTodas = async () => {
    setNotificaciones((prev) => prev.map((x) => ({ ...x, leida: true })));
    try {
      await marcarTodasComoLeidas();
    } catch {
      cargar();
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        ref={triggerRef}
        onClick={() => setAbierto((v) => !v)}
        aria-label={`Notificaciones${noLeidas > 0 ? ` (${noLeidas} sin leer)` : ""}`}
        aria-expanded={abierto}
        aria-controls="notificaciones-panel"
        className="relative flex items-center text-slate-600 hover:text-slate-900 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {noLeidas > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-cobalt px-1 text-[10px] font-semibold text-white">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div
          id="notificaciones-panel"
          role="region"
          aria-label="Notificaciones"
          className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-900">Notificaciones</span>
            {noLeidas > 0 && (
              <button
                onClick={handleMarcarTodas}
                className="text-xs font-medium text-cobalt hover:underline"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {notificaciones.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              No tenés notificaciones.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {notificaciones.map((n) => {
                const Icono = ICONO[n.tipo] ?? Bell;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClickNotificacion(n)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                        n.leida ? "" : "bg-cobalt/5"
                      }`}
                    >
                      <Icono className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">{n.titulo}</p>
                        {n.mensaje && (
                          <p className="mt-0.5 text-xs text-slate-500">{n.mensaje}</p>
                        )}
                        <p className="mt-1 text-[11px] text-slate-400">{tiempoRelativo(n.created_at)}</p>
                      </div>
                      {!n.leida && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cobalt" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
