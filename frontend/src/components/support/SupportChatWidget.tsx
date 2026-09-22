// src/components/support/SupportChatWidget.tsx
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { VerdictBadge } from "@/components/verdict/VerdictBadge";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import { fetchConsultas } from "@/lib/queryHistoryService";
import { crearSolicitudAsesor, fetchMiSolicitudPendiente } from "@/lib/advisorRequestService";
import { responderPregunta, type RespuestaAsistente } from "@/lib/supportAssistant";
import type { DiagnosticoEnvio } from "@/lib/types";

/**
 * Chat de ayuda flotante para clientes. A propósito NO es un chatbot de IA:
 * responde con lógica determinística (`supportAssistant.ts`) contra las FAQ
 * reales y el historial real del cliente, y ofrece escalar a un asesor
 * humano cuando no encuentra respuesta o el cliente lo pide directamente.
 * Ver docs/sql/solicitudes-asesor.sql.
 */

// Después de esta cantidad de respuestas seguidas sin resultado, el
// asistente ofrece proactivamente un asesor (además de que el cliente
// siempre puede pedirlo escribiendo "asesor").
const INTENTOS_ANTES_DE_OFRECER_ASESOR = 2;

function generarId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type ContenidoAsistente = { kind: "respuesta"; respuesta: RespuestaAsistente } | { kind: "texto"; texto: string };

type Mensaje =
  | { id: string; autor: "cliente"; texto: string }
  | { id: string; autor: "asistente"; contenido: ContenidoAsistente };

const MENSAJE_BIENVENIDA =
  "Hola. Puedo responder preguntas generales sobre aduanas, tu casillero y tributos, y contarte sobre tus propias consultas. Si preferís hablar con una persona, escribime \"asesor\".";

interface RespuestaAsistenteViewProps {
  respuesta: RespuestaAsistente;
  solicitudPendiente: boolean;
  enviandoSolicitud: boolean;
  onSolicitarAsesor: () => void;
}

function RespuestaAsistenteView({
  respuesta,
  solicitudPendiente,
  enviandoSolicitud,
  onSolicitarAsesor,
}: RespuestaAsistenteViewProps) {
  switch (respuesta.tipo) {
    case "faq":
      return (
        <div>
          <p className="font-medium text-slate-800">{respuesta.item.pregunta}</p>
          <p className="mt-1 text-slate-600">{respuesta.item.respuesta}</p>
        </div>
      );

    case "consulta":
      return (
        <div>
          <p className="mb-2 text-slate-700">Encontré esta consulta tuya:</p>
          <ConsultaMini diagnostico={respuesta.diagnostico} />
        </div>
      );

    case "consultas":
      return (
        <div>
          <p className="mb-2 text-slate-700">Encontré estas consultas tuyas:</p>
          <ul className="space-y-2">
            {respuesta.diagnosticos.map((d) => (
              <li key={d.id}>
                <ConsultaMini diagnostico={d} />
              </li>
            ))}
          </ul>
        </div>
      );

    case "sin_consulta_encontrada":
      return (
        <p className="text-slate-600">
          No encontré ninguna consulta tuya con esa descripción. Podés revisar todo tu{" "}
          <Link to="/dashboard/historial" className="font-medium text-cobalt hover:underline">
            historial
          </Link>
          .
        </p>
      );

    case "sin_resultado":
      return (
        <p className="text-slate-600">
          No tengo una respuesta para eso. Podés revisar el{" "}
          <Link to="/soporte" className="font-medium text-cobalt hover:underline">
            Centro de Ayuda
          </Link>{" "}
          o pedirme que te conecte con un asesor personal.
        </p>
      );

    case "ofrecer_asesor":
      return solicitudPendiente ? (
        <p className="text-slate-600">
          Ya tenés una solicitud de asesor pendiente. Un administrador te va a contactar pronto.
        </p>
      ) : (
        <div>
          <p className="mb-2 text-slate-600">
            Puedo dejar pedido un asesor personal para que te contacte. Un administrador revisa la
            solicitud y te asigna uno.
          </p>
          <Button
            type="button"
            onClick={onSolicitarAsesor}
            disabled={enviandoSolicitud}
            className="px-4 py-2 text-sm"
          >
            {enviandoSolicitud ? "Enviando..." : "Solicitar asesor personal"}
          </Button>
        </div>
      );
  }
}

function ConsultaMini({ diagnostico }: { diagnostico: DiagnosticoEnvio }) {
  return (
    <Link
      to={`/consulta/${diagnostico.id}`}
      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"
    >
      <span className="min-w-0 truncate text-slate-800">{diagnostico.titulo}</span>
      <VerdictBadge nivel={diagnostico.nivel} />
    </Link>
  );
}

export function SupportChatWidget() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [entrada, setEntrada] = useState("");
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [misConsultas, setMisConsultas] = useState<DiagnosticoEnvio[]>([]);
  const [solicitudPendiente, setSolicitudPendiente] = useState(false);
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const intentosSinResultadoRef = useRef(0);
  const avisoProactivoMostradoRef = useRef(false);
  const cargadoRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const mensajesFinRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, abierto);

  // Carga perezosa: solo al abrir el chat la primera vez.
  useEffect(() => {
    if (!abierto || cargadoRef.current) return;
    cargadoRef.current = true;

    setMensajes([{ id: generarId(), autor: "asistente", contenido: { kind: "texto", texto: MENSAJE_BIENVENIDA } }]);

    Promise.all([
      fetchConsultas().catch(() => []),
      fetchMiSolicitudPendiente().catch(() => null),
    ]).then(([consultas, solicitud]) => {
      setMisConsultas(consultas);
      setSolicitudPendiente(solicitud !== null);
      setCargandoDatos(false);
    });
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

  function agregarMensajeAsistente(respuesta: RespuestaAsistente) {
    setMensajes((prev) => [...prev, { id: generarId(), autor: "asistente", contenido: { kind: "respuesta", respuesta } }]);
  }

  function handleEnviar(e: FormEvent) {
    e.preventDefault();
    const texto = entrada.trim();
    if (!texto || cargandoDatos) return;

    setEntrada("");
    setMensajes((prev) => [...prev, { id: generarId(), autor: "cliente", texto }]);

    const respuesta = responderPregunta(texto, misConsultas);
    agregarMensajeAsistente(respuesta);

    const sinResultado = respuesta.tipo === "sin_resultado" || respuesta.tipo === "sin_consulta_encontrada";
    if (sinResultado) {
      intentosSinResultadoRef.current += 1;
      if (
        intentosSinResultadoRef.current >= INTENTOS_ANTES_DE_OFRECER_ASESOR &&
        !avisoProactivoMostradoRef.current
      ) {
        avisoProactivoMostradoRef.current = true;
        agregarMensajeAsistente({ tipo: "ofrecer_asesor" });
      }
    } else {
      intentosSinResultadoRef.current = 0;
      avisoProactivoMostradoRef.current = false;
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
                  <div className="max-w-[90%] rounded-xl rounded-bl-sm bg-slate-100 px-3 py-2">
                    {m.contenido.kind === "texto" ? (
                      <p className="text-slate-700">{m.contenido.texto}</p>
                    ) : (
                      <RespuestaAsistenteView
                        respuesta={m.contenido.respuesta}
                        solicitudPendiente={solicitudPendiente}
                        enviandoSolicitud={enviandoSolicitud}
                        onSolicitarAsesor={handleSolicitarAsesor}
                      />
                    )}
                  </div>
                </div>
              )
            )}
            {cargandoDatos && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Cargando tu historial...
              </div>
            )}
            <div ref={mensajesFinRef} />
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
              disabled={cargandoDatos}
              placeholder="Escribí tu pregunta..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt focus:border-transparent disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={cargandoDatos || !entrada.trim()}
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
