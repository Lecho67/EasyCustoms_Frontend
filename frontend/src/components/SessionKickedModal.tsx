// src/components/SessionKickedModal.tsx
import { useNavigate } from "react-router-dom";
import { MonitorSmartphone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * Aviso persistente cuando la sesión se cierra porque la cuenta inició sesión en
 * otro dispositivo (sesión única por cuenta). Vive en `Layout`, fuera de las
 * rutas: el signOut redirige a /login y el aviso tiene que sobrevivir a eso.
 */
export function SessionKickedModal() {
  const { sesionDesplazada, descartarAvisoSesion } = useAuth();
  const navigate = useNavigate();

  function iniciarSesionDeNuevo() {
    descartarAvisoSesion();
    navigate("/login");
  }

  return (
    <Modal open={sesionDesplazada} onClose={descartarAvisoSesion}>
      <div className="mb-3 flex items-center gap-3">
        <MonitorSmartphone className="h-6 w-6 shrink-0 text-cobalt" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-slate-900">Tu sesión se cerró</h2>
      </div>
      <p className="mb-6 text-sm text-slate-600">
        Iniciaste sesión con esta cuenta en otro dispositivo o navegador. Por seguridad solo se
        permite una sesión activa por cuenta, así que cerramos la de este dispositivo.
      </p>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={descartarAvisoSesion} className="px-4 py-2">
          Entendido
        </Button>
        <Button onClick={iniciarSesionDeNuevo} className="px-4 py-2">
          Iniciar sesión de nuevo
        </Button>
      </div>
    </Modal>
  );
}
