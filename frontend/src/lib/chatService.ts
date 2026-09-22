// src/lib/chatService.ts
const CHAT_TIMEOUT_MS = 20000;

export interface ChatTurno {
  autor: "cliente" | "asistente";
  texto: string;
}

/**
 * Llama a POST /api/chat (Vercel Serverless Function que proxea Gemini —
 * ver api/chat.ts). La API key vive solo del lado del servidor.
 */
export async function enviarMensajeChat(mensaje: string, historial: ChatTurno[]): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje, historial }),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(body?.error ?? "No se pudo obtener respuesta del asistente.");
    }
    if (typeof body?.respuesta !== "string") {
      throw new Error("Respuesta inválida del asistente.");
    }

    return body.respuesta;
  } finally {
    clearTimeout(timeoutId);
  }
}
