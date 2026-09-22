import { FAQ_ITEMS } from "../src/lib/faqData";

/**
 * Vercel Serverless Function — POST /api/chat.
 *
 * Proxy hacia la API de Gemini (Google AI Studio, tier gratuito): existe
 * solo para que GEMINI_API_KEY nunca llegue al bundle del cliente (una var
 * VITE_* quedaría expuesta en el JS servido). El frontend llama a esta ruta
 * same-origin vía `src/lib/chatService.ts`.
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const MAX_MENSAJE_LENGTH = 2000;
const MAX_HISTORIAL = 10;

interface ApiRequest {
  method?: string;
  body?: unknown;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
}

interface Turno {
  autor: "cliente" | "asistente";
  texto: string;
}

function esTurnoValido(valor: unknown): valor is Turno {
  if (typeof valor !== "object" || valor === null) return false;
  const t = valor as Record<string, unknown>;
  return (t.autor === "cliente" || t.autor === "asistente") && typeof t.texto === "string";
}

const FAQ_REFERENCIA = FAQ_ITEMS.map((item) => `P: ${item.pregunta}\nR: ${item.respuesta}`).join("\n\n");

const SYSTEM_INSTRUCTION = `Sos el asistente de soporte de Easy CUSTOMS, una plataforma de asesoría aduanera y evaluación de envíos internacionales para Colombia.

Respondé siempre en español, en tono cercano y profesional, en pocas frases (esto es un chat, no un documento).

Usá esta referencia de preguntas frecuentes reales de la plataforma como base de conocimiento:

${FAQ_REFERENCIA}

Reglas importantes:
- No inventes cifras de aranceles, impuestos, plazos legales ni normativa que no esté en la referencia de arriba. Si no estás seguro, decilo y remití a "Nueva consulta" (evaluación real del envío) o a solicitar un asesor humano.
- No tenés acceso a los envíos o consultas puntuales del usuario. Si pregunta por su historial o el estado de un envío propio, remitilo a la sección "Historial" de su panel.
- Tus respuestas son orientación general, no un dictamen vinculante de la DIAN.
- Si el usuario pide explícitamente hablar con una persona, indicale que puede usar el botón "Solicitar asesor" del chat.`;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "El asistente no está configurado." });
    return;
  }

  const body = (req.body ?? {}) as { mensaje?: unknown; historial?: unknown };
  const mensaje = typeof body.mensaje === "string" ? body.mensaje.trim() : "";

  if (!mensaje) {
    res.status(400).json({ error: "El mensaje no puede estar vacío." });
    return;
  }
  if (mensaje.length > MAX_MENSAJE_LENGTH) {
    res.status(400).json({ error: "El mensaje es demasiado largo." });
    return;
  }

  const historial = Array.isArray(body.historial) ? body.historial.filter(esTurnoValido).slice(-MAX_HISTORIAL) : [];

  const contents = [
    ...historial.map((turno) => ({
      role: turno.autor === "cliente" ? "user" : "model",
      parts: [{ text: turno.texto }],
    })),
    { role: "user", parts: [{ text: mensaje }] },
  ];

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
        }),
      }
    );

    if (!response.ok) {
      res.status(502).json({ error: "El asistente no pudo responder en este momento." });
      return;
    }

    const data = await response.json();
    const respuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof respuesta !== "string" || !respuesta.trim()) {
      res.status(502).json({ error: "El asistente no pudo responder en este momento." });
      return;
    }

    res.status(200).json({ respuesta: respuesta.trim() });
  } catch {
    res.status(502).json({ error: "El asistente no pudo responder en este momento." });
  }
}
