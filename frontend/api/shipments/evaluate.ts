/**
 * Vercel Serverless Function — POST /api/shipments/evaluate.
 *
 * Proxy hacia el motor de reglas (BorderCheck-AI_Backend, repo de diego):
 * existe solo para que la API key nunca llegue al bundle de producción del
 * cliente (una var VITE_* quedaría expuesta en el JS servido — hallazgo F5
 * del audit de seguridad de esta sesión). `src/lib/api.ts` llama a esta ruta
 * same-origin SOLO en el build de producción; en dev (`npm run dev`, sin
 * runtime de Vercel Functions) sigue llamando al backend directo con la key,
 * igual que siempre — ver el comentario de `EVALUATE_URL` en api.ts.
 *
 * A propósito NO importa nada de `src/` (mismo motivo que api/chat.ts: Vercel
 * compila esta función como ESM standalone y no empaqueta imports relativos
 * que cruzan fuera de `api/`, falla en runtime con ERR_MODULE_NOT_FOUND).
 */

const BACKEND_URL = process.env.VITE_API_BASE_URL ?? "";
const API_KEY = process.env.VITE_X_API_KEY ?? "";

interface ApiRequest {
  method?: string;
  body?: unknown;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }

  if (!BACKEND_URL) {
    res.status(500).json({ error: "El motor de reglas no está configurado." });
    return;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/shipments/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const body = await response.json().catch(() => ({}));
    res.status(response.status).json(body);
  } catch (err) {
    console.error("Error llamando al motor de reglas (evaluate):", err);
    res.status(502).json({ error: "No se pudo completar el análisis. Inténtalo de nuevo." });
  }
}
