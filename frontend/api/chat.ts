/**
 * Vercel Serverless Function — POST /api/chat.
 *
 * Proxy hacia la API de Gemini (Google AI Studio, tier gratuito): existe
 * solo para que GEMINI_API_KEY nunca llegue al bundle del cliente (una var
 * VITE_* quedaría expuesta en el JS servido). El frontend llama a esta ruta
 * same-origin vía `src/lib/chatService.ts`.
 *
 * A propósito NO importa nada de `src/` (p.ej. `src/lib/faqData.ts`): Vercel
 * compila esta función como ESM standalone y no empaqueta imports relativos
 * que cruzan fuera de `api/` (falla en runtime con ERR_MODULE_NOT_FOUND, ya
 * que Node ESM exige extensión explícita y ese archivo no viaja con la
 * función). El contenido de las FAQ se duplica acá abajo; si cambia
 * `faqData.ts`, actualizar también `FAQ_REFERENCIA`.
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
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

// Duplicado a propósito de src/lib/faqData.ts — ver comentario arriba.
const FAQ_REFERENCIA = `P: ¿Cuál es el valor máximo para importar sin pagar aranceles?
R: En Colombia, los envíos de mensajería con valor FOB de hasta USD 200 pueden estar exentos de arancel bajo el régimen de tráfico postal, aunque siguen pagando IVA si superan los USD 200. Este límite puede cambiar según la normativa vigente de la DIAN, así que confirmá siempre el valor actualizado antes de tu envío.

P: ¿Qué productos están restringidos o prohibidos para importar?
R: Entre otros: armas y municiones, sustancias controladas, medicamentos sin registro INVIMA, productos que infrinjan derechos de marca, baterías de litio sueltas (fuera de un dispositivo) sin declaración especial, y productos de origen animal o vegetal sin permiso del ICA. Usá 'Nueva consulta' para chequear tu producto puntual.

P: ¿Qué es la partida arancelaria y por qué es importante?
R: Es el código HS que clasifica tu producto según un estándar internacional y determina qué arancel e impuestos aplican. Una clasificación incorrecta puede generar retrasos, multas o el bloqueo del envío en aduana.

P: ¿Qué es el casillero virtual y cómo funciona?
R: Es una dirección física en el país de origen que te asignamos para tus compras online. Cuando el paquete llega, lo consolidamos y lo enviamos a tu país. Podés ver el estado de tus paquetes en la sección Casillero de tu panel.

P: ¿Cuánto tarda un paquete en llegar desde el casillero?
R: Depende del método de envío y del país de destino, pero en general entre 5 y 15 días hábiles desde que sale del casillero, sin contar el tiempo de liberación en aduana si tu envío queda en revisión.

P: ¿Puedo consolidar varias compras en un solo envío?
R: Sí. Podés recibir varios paquetes en tu casillero y pedir que se consoliden en un único envío, lo que suele reducir el costo de flete frente a enviarlos por separado.

P: ¿Cómo se calculan los tributos de mi envío?
R: Se calculan sobre el valor CIF (costo + seguro + flete), aplicando la tasa de arancel de la partida arancelaria del producto, más IVA cuando aplica. Podés ver un desglose estimado (flete, arancel y total) en el resultado de cada consulta.

P: ¿Qué métodos de pago aceptan para los tributos de aduana?
R: Los tributos de nacionalización generalmente se pagan a través de la agencia de aduanas o el operador logístico antes de la entrega final. Los métodos varían según el operador; consultá con tu agente asignado los detalles de tu envío.

P: ¿Qué pasa si mi envío queda en Precaución o Bloqueo?
R: 'Precaución' generalmente requiere documentación adicional (factura, permisos) antes de continuar. 'Bloqueo' significa que el envío no cumple la normativa vigente y no puede nacionalizarse sin resolver la causa. En ambos casos, un agente humano revisa el caso desde el Panel de Agente.`;

const SYSTEM_INSTRUCTION = `Sos el asistente de soporte de Easy CUSTOMS, una plataforma de asesoría aduanera y evaluación de envíos internacionales para Colombia.

Respondé siempre en español, en tono cercano y profesional, en pocas frases (esto es un chat, no un documento).

Usá esta referencia de preguntas frecuentes reales de la plataforma como base de conocimiento:

${FAQ_REFERENCIA}

Reglas importantes:
- No inventes cifras de aranceles, impuestos, plazos legales ni normativa que no esté en la referencia de arriba. Si no estás seguro, decilo y remití a "Nueva consulta" (evaluación real del envío) o a solicitar un asesor humano.
- No tenés acceso a los envíos o consultas puntuales del usuario. Si pregunta por su historial o el estado de un envío propio, remitilo a la sección "Historial" de su panel.
- Tus respuestas son orientación general, no un dictamen vinculante de la DIAN.
- Si el usuario pide explícitamente hablar con una persona, indicale que puede usar el botón "Solicitar asesor" del chat.
- No uses markdown (nada de **negrita**, listas con guiones ni encabezados): esto se muestra como texto plano en una burbuja de chat, así que los asteriscos y símbolos quedarían literales.`;

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

  const historialCrudo = Array.isArray(body.historial)
    ? body.historial.filter(esTurnoValido).slice(-MAX_HISTORIAL)
    : [];
  // Gemini exige que la conversación empiece en role "user" — el primer
  // mensaje real suele ser el saludo del asistente (MENSAJE_BIENVENIDA en
  // SupportChatWidget), así que se descarta todo lo anterior al primer
  // turno del cliente.
  const primerTurnoCliente = historialCrudo.findIndex((t) => t.autor === "cliente");
  const historial = primerTurnoCliente === -1 ? [] : historialCrudo.slice(primerTurnoCliente);

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
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 800,
            // gemini-3.6-flash gasta parte del presupuesto en razonamiento
            // interno antes de escribir la respuesta; sin esto, con un
            // maxOutputTokens chico se quedaba sin tokens para el texto
            // final (finishReason MAX_TOKENS, content vacío).
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(`Gemini respondió ${response.status}:`, errorBody);
      res.status(502).json({ error: "El asistente no pudo responder en este momento." });
      return;
    }

    const data = await response.json();
    const respuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof respuesta !== "string" || !respuesta.trim()) {
      console.error("Respuesta de Gemini sin texto utilizable:", JSON.stringify(data));
      res.status(502).json({ error: "El asistente no pudo responder en este momento." });
      return;
    }

    res.status(200).json({ respuesta: respuesta.trim() });
  } catch (err) {
    console.error("Error llamando a Gemini:", err);
    res.status(502).json({ error: "El asistente no pudo responder en este momento." });
  }
}
