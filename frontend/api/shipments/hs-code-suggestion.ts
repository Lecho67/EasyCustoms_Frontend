/**
 * Vercel Serverless Function — POST /api/shipments/hs-code-suggestion.
 *
 * Proxy hacia el motor de reglas, mismo motivo que evaluate.ts (la API key
 * nunca debe llegar al bundle de producción — hallazgo F5 del audit de
 * seguridad). Acá la key es más sensible al timeout: el backend prueba una
 * cascada de fallback (Gemini P1 -> Gemini P2 -> Ollama, ver hsCodeMapper.ts
 * del backend) que en el peor caso tarda ~28s, así que esta función pide
 * maxDuration: 60 en vercel.json (el máximo del plan gratuito de Vercel) en
 * vez del default de 10s. Si igual se corta, el frontend degrada a
 * status "error" sin romper el wizard (ver sugerirHsCode en api.ts).
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
    const response = await fetch(`${BACKEND_URL}/api/v1/shipments/hs-code-suggestion`, {
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
    console.error("Error llamando al motor de reglas (hs-code-suggestion):", err);
    res.status(502).json({ error: "No se pudo obtener una sugerencia en este momento." });
  }
}
