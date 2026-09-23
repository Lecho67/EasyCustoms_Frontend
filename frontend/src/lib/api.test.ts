import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { evaluarEnvio, sugerirHsCode } from "./api";
import { supabase } from "./supabase";
import { declaracionesEspecialesVacias, type WizardFormData } from "./types";

// El .env.test define VITE_API_BASE_URL, así que evaluarEnvio toma el
// camino "backend real" (no el mock) y llega a guardar en customs_queries.

const insertMock = vi.fn();

vi.mock("./supabase", () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: vi.fn(() => ({ insert: (...args: unknown[]) => insertMock(...args) })),
  },
}));
vi.mock("./toast", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const getSessionMock = vi.mocked(supabase.auth.getSession);

function wizard(): WizardFormData {
  return {
    paisOrigen: "Estados Unidos",
    transportType: "air",
    shipmentModality: "personal_shipment_gift",
    paisDestino: "Colombia",
    descripcionItem: "auriculares",
    pesoKg: 1,
    valorDeclaradoUsd: 50,
    declaracionesEspeciales: declaracionesEspecialesVacias(),
  };
}

beforeEach(() => {
  getSessionMock.mockReset().mockResolvedValue({
    data: { session: { user: { id: "u1" }, access_token: "tok" } },
  } as never);
  insertMock.mockReset().mockResolvedValue({ error: null });
  vi.stubGlobal("fetch", vi.fn());
});

describe("evaluarEnvio — guardado en el historial", () => {
  it("guarda ai_verdict con el final_status del motor, no el nivel de color", async () => {
    (fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        final_status: "BLOQUEO",
        evaluated_at: "2026-01-01T00:00:00Z",
        alerts: [],
        tax_estimation: { requires_taxes: false },
      }),
    });

    const diagnostico = await evaluarEnvio(wizard());

    expect(diagnostico.nivel).toBe("rojo");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ ai_verdict: "BLOQUEO", user_id: "u1" })
    );
  });

  it("propaga el mensaje de error del motor de reglas", async () => {
    (fetch as Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Datos inválidos" }),
    });

    await expect(evaluarEnvio(wizard())).rejects.toThrow("Datos inválidos");
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("evaluarEnvio — headers hacia el motor de reglas", () => {
  // El CORS del backend (allowedHeaders) no incluye "Authorization" — mandarlo
  // rompería el preflight, así que ya no debe ir en el request.
  it("no manda Authorization aunque haya sesión de Supabase", async () => {
    (fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        final_status: "APROBADO",
        evaluated_at: "2026-01-01T00:00:00Z",
        alerts: [],
        tax_estimation: { requires_taxes: false },
      }),
    });

    await evaluarEnvio(wizard());

    const headers = (fetch as Mock).mock.calls[0][1].headers as Record<string, string>;
    expect(headers).not.toHaveProperty("Authorization");
  });

  it("manda X-API-Key cuando VITE_X_API_KEY está seteada (dev, backend directo)", async () => {
    vi.stubEnv("VITE_X_API_KEY", "test-key-123");
    vi.resetModules();
    const { evaluarEnvio: evaluarEnvioConKey } = await import("./api");

    (fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        final_status: "APROBADO",
        evaluated_at: "2026-01-01T00:00:00Z",
        alerts: [],
        tax_estimation: { requires_taxes: false },
      }),
    });

    await evaluarEnvioConKey(wizard());

    const headers = (fetch as Mock).mock.calls[0][1].headers as Record<string, string>;
    expect(headers["X-API-Key"]).toBe("test-key-123");

    vi.unstubAllEnvs();
  });
});

describe("evaluarEnvio — en producción llama same-origin, sin la key (F5 del audit de seguridad)", () => {
  // import.meta.env.DEV es false solo en el build real; se simula acá para
  // no depender de correr un build completo en cada test. La key nunca debe
  // viajar en un fetch que Vite podría inlinear en el bundle servido.
  it("llama /api/shipments/evaluate same-origin y no manda X-API-Key aunque esté seteada", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_X_API_KEY", "test-key-123");
    vi.resetModules();
    const { evaluarEnvio: evaluarEnvioProd } = await import("./api");

    (fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        final_status: "APROBADO",
        evaluated_at: "2026-01-01T00:00:00Z",
        alerts: [],
        tax_estimation: { requires_taxes: false },
      }),
    });

    await evaluarEnvioProd(wizard());

    const [url, init] = (fetch as Mock).mock.calls[0];
    expect(url).toBe("/api/shipments/evaluate");
    expect(init.headers).not.toHaveProperty("X-API-Key");

    vi.unstubAllEnvs();
  });

  it("sugerirHsCode llama /api/shipments/hs-code-suggestion same-origin y no manda X-API-Key", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_X_API_KEY", "test-key-123");
    vi.resetModules();
    const { sugerirHsCode: sugerirHsCodeProd } = await import("./api");

    (fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        hs_code: "610910",
        hs_description: "Camisetas de algodón",
        confidence_score: 0.9,
        possible_hazmat: false,
      }),
    });

    await sugerirHsCodeProd("camiseta");

    const [url, init] = (fetch as Mock).mock.calls[0];
    expect(url).toBe("/api/shipments/hs-code-suggestion");
    expect(init.headers).not.toHaveProperty("X-API-Key");

    vi.unstubAllEnvs();
  });
});

describe("sugerirHsCode", () => {
  it("devuelve status success con la sugerencia mapeada cuando el backend confía en su clasificación", async () => {
    (fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        hs_code: "610910",
        hs_description: "Camisetas de algodón",
        confidence_score: 0.9,
        possible_hazmat: false,
      }),
    });

    const resultado = await sugerirHsCode("camiseta de algodón blanca", "Ropa");

    expect(resultado).toEqual({
      status: "success",
      hsCode: "610910",
      hsDescription: "Camisetas de algodón",
      confidence: 0.9,
      possibleHazmat: false,
    });

    const [url, init] = (fetch as Mock).mock.calls[0];
    expect(url).toContain("/api/v1/shipments/hs-code-suggestion");
    const body = JSON.parse(init.body);
    expect(body).toEqual({ product_description: "camiseta de algodón blanca", category: "Ropa" });
  });

  it("manda el body sin 'category' cuando no se pasa categoría", async () => {
    (fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        hs_code: "854370",
        hs_description: "Aparato eléctrico",
        confidence_score: 0.8,
        possible_hazmat: false,
      }),
    });

    await sugerirHsCode("cargador USB-C");

    const body = JSON.parse((fetch as Mock).mock.calls[0][1].body);
    expect(body).toEqual({ product_description: "cargador USB-C" });
  });

  it("devuelve status low_confidence cuando el backend descarta la clasificación (hs_code null)", async () => {
    (fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        hs_code: null,
        hs_description: null,
        confidence_score: 0.3,
        possible_hazmat: false,
      }),
    });

    const resultado = await sugerirHsCode("asdasdasd");

    expect(resultado).toEqual({ status: "low_confidence" });
  });

  it("devuelve status error si la respuesta no es ok, sin lanzar", async () => {
    (fetch as Mock).mockResolvedValue({ ok: false, json: async () => ({}) });

    const resultado = await sugerirHsCode("producto cualquiera");

    expect(resultado).toEqual({ status: "error" });
  });

  it("devuelve status error si fetch rechaza (red caída, timeout), sin lanzar", async () => {
    (fetch as Mock).mockRejectedValue(new Error("network error"));

    const resultado = await sugerirHsCode("producto cualquiera");

    expect(resultado).toEqual({ status: "error" });
  });

  it("devuelve status error sin llamar a fetch cuando no hay VITE_API_BASE_URL (modo mock)", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.resetModules();
    const { sugerirHsCode: sugerirEnMock } = await import("./api");

    const resultado = await sugerirEnMock("producto cualquiera");

    expect(resultado).toEqual({ status: "error" });
    expect(fetch).not.toHaveBeenCalled();

    vi.unstubAllEnvs();
  });
});
