// src/components/support/SupportChatWidget.tsx
import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { toast } from "@/lib/toast";
import { crearSolicitudAsesor, fetchMiSolicitudPendiente } from "@/lib/advisorRequestService";
import { enviarMensajeChat } from "@/lib/chatService";

/**
 * Chat de ayuda flotante para clientes, respondido por Gemini (Google AI
 * Studio, tier gratuito) vía api/chat.ts. El prompt del asistente lo acota a
 * temas de la plataforma y le prohíbe inventar cifras de aranceles o acceder
 * al historial real del cliente; para eso, y para lo que no sepa responder,
 * ofrece el botón "Solicitar asesor" (ver docs/sql/solicitudes-asesor.sql).
 */

function generarId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface Mensaje {
  id: string;
  autor: "cliente" | "asistente";
  texto: string;
}

const MENSAJE_BIENVENIDA =
  "Hola, soy el asistente de Easy CUSTOMS. Puedo ayudarte con preguntas generales sobre aduanas, tu casillero y tributos. Para el estado de tus propios envíos, revisá tu Historial; si preferís hablar con una persona, usá el botón de abajo.";

export function SupportChatWidget() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [entrada, setEntrada] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [solicitudPendiente, setSolicitudPendiente] = useState(false);
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const cargadoRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const mensajesFinRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, abierto);

  // Carga perezosa: solo al abrir el chat la primera vez.
  useEffect(() => {
    if (!abierto || cargadoRef.current) return;
    cargadoRef.current = true;

    setMensajes([{ id: generarId(), autor: "asistente", texto: MENSAJE_BIENVENIDA }]);

    fetchMiSolicitudPendiente()
      .then((solicitud) => setSolicitudPendiente(solicitud !== null))
      .catch(() => {});
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [abierto]);

  useEffect(() => {
    // jsdom (entorno de tests) no implementa scrollIntoView.
    mensajesFinRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [mensajes]);

  async function handleEnviar(e: FormEvent) {
    e.preventDefault();
    const texto = entrada.trim();
    if (!texto || enviando) return;

    const historialParaApi = mensajes.map((m) => ({ autor: m.autor, texto: m.texto }));
    setEntrada("");
    setMensajes((prev) => [...prev, { id: generarId(), autor: "cliente", texto }]);
    setEnviando(true);

    try {
      const respuesta = await enviarMensajeChat(texto, historialParaApi);
      setMensajes((prev) => [...prev, { id: generarId(), autor: "asistente", texto: respuesta }]);
    } catch (err) {
      setMensajes((prev) => [
        ...prev,
        {
          id: generarId(),
          autor: "asistente",
          texto: "No pude responder en este momento. Probá de nuevo en un momento o solicitá un asesor.",
        },
      ]);
      toast.error("No se pudo enviar tu mensaje", err instanceof Error ? err.message : undefined);
    } finally {
      setEnviando(false);
    }
  }

  async function handleSolicitarAsesor() {
    if (solicitudPendiente || enviandoSolicitud) return;
    setEnviandoSolicitud(true);
    try {
      await crearSolicitudAsesor();
      setSolicitudPendiente(true);
    } catch (err) {
      toast.error(
        "No se pudo enviar tu solicitud",
        err instanceof Error ? err.message : "Intentá de nuevo en un momento."
      );
    } finally {
      setEnviandoSolicitud(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? "Cerrar chat de ayuda" : "Abrir chat de ayuda"}
        className="fixed bottom-6 left-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-cobalt text-white shadow-lg transition-colors hover:bg-cobalt-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cian focus-visible:ring-offset-2"
      >
        {abierto ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {abierto && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Chat de ayuda"
          className="fixed bottom-24 left-6 z-40 flex h-[28rem] max-h-[70vh] w-[calc(100vw-3rem)] max-w-sm flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">Chat de ayuda</span>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar"
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
            {mensajes.map((m) =>
              m.autor === "cliente" ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-xl rounded-br-sm bg-cobalt px-3 py-2 text-white">{m.texto}</p>
                </div>
              ) : (
                <div key={m.id} className="flex justify-start">
                  <p className="max-w-[90%] whitespace-pre-wrap rounded-xl rounded-bl-sm bg-slate-100 px-3 py-2 text-slate-700">
                    {m.texto}
                  </p>
                </div>
              )
            )}
            {enviando && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Escribiendo...
              </div>
            )}
            <div ref={mensajesFinRef} />
          </div>

          <div className="border-t border-slate-100 px-4 py-2 text-xs">
            {solicitudPendiente ? (
              <span className="text-slate-500">Ya tenés una solicitud de asesor pendiente.</span>
            ) : (
              <button
                type="button"
                onClick={handleSolicitarAsesor}
                disabled={enviandoSolicitud}
                className="font-medium text-cobalt hover:underline disabled:text-slate-400"
              >
                {enviandoSolicitud ? "Enviando solicitud..." : "¿Preferís hablar con una persona? Solicitar asesor"}
              </button>
            )}
          </div>

          <form onSubmit={handleEnviar} className="flex items-center gap-2 border-t border-slate-100 p-3">
            <label htmlFor="chat-ayuda-mensaje" className="sr-only">
              Escribí tu pregunta
            </label>
            <input
              id="chat-ayuda-mensaje"
              type="text"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              disabled={enviando}
              placeholder="Escribí tu pregunta..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt focus:border-transparent disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={enviando || !entrada.trim()}
              aria-label="Enviar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cobalt text-white transition-colors hover:bg-cobalt-600 disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
