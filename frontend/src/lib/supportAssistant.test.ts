import { describe, it, expect } from "vitest";
import { responderPregunta } from "./supportAssistant";
import type { DiagnosticoEnvio } from "./types";

function diag(id: string, descripcionItem: string, nivel: DiagnosticoEnvio["nivel"] = "verde"): DiagnosticoEnvio {
  return {
    id,
    nivel,
    titulo: descripcionItem,
    resumen: "resumen",
    justificacion: "justificación",
    fuenteNormativa: "",
    documentosRequeridos: [],
    accionesSugeridas: [],
    partidaArancelariaTentativa: "Sin partida tentativa declarada",
    desgloseImpuestos: null,
    createdAt: "2026-01-01T00:00:00Z",
    input: { paisDestino: "Colombia", descripcionItem },
  };
}

describe("responderPregunta — mensaje vacío", () => {
  it("sin_resultado con string vacío o solo espacios", () => {
    expect(responderPregunta("", [])).toEqual({ tipo: "sin_resultado" });
    expect(responderPregunta("   ", [])).toEqual({ tipo: "sin_resultado" });
  });
});

describe("responderPregunta — pedir asesor", () => {
  it("detecta la palabra 'asesor'", () => {
    expect(responderPregunta("quiero hablar con un asesor", [])).toEqual({ tipo: "ofrecer_asesor" });
  });

  it("detecta variantes de pedir una persona humana", () => {
    expect(responderPregunta("necesito hablar con una persona real", [])).toEqual({ tipo: "ofrecer_asesor" });
    expect(responderPregunta("¿hay algún humano que me pueda ayudar?", [])).toEqual({ tipo: "ofrecer_asesor" });
  });

  it("gana sobre una pregunta de historial en el mismo mensaje", () => {
    const resultado = responderPregunta("quiero hablar con un asesor sobre mi consulta", [diag("d1", "celular")]);
    expect(resultado).toEqual({ tipo: "ofrecer_asesor" });
  });

  it("gana sobre una pregunta de FAQ en el mismo mensaje", () => {
    const resultado = responderPregunta("necesito un asesor, mi envío quedó en bloqueo", []);
    expect(resultado).toEqual({ tipo: "ofrecer_asesor" });
  });
});

describe("responderPregunta — FAQ", () => {
  it("responde con el item cuya pregunta coincide, aunque tenga signos de interrogación", () => {
    const resultado = responderPregunta("¿Qué es el casillero?", []);
    expect(resultado).toEqual({ tipo: "faq", item: expect.objectContaining({ id: "casillero-que-es" }) });
  });

  it("es insensible a tildes y mayúsculas", () => {
    const resultado = responderPregunta("QUE ES EL CASILLERO", []);
    expect(resultado).toEqual({ tipo: "faq", item: expect.objectContaining({ id: "casillero-que-es" }) });
  });

  it("cae a coincidencia por palabra suelta si no hay match de frase completa", () => {
    // "significa" solo aparece en la respuesta de pagos-envio-bloqueado; se
    // evita a propósito la palabra "bloqueo" (también aparece en la
    // respuesta de aduana-partida-arancelaria, que va antes en el array).
    const resultado = responderPregunta("no entiendo bien que significa eso", []);
    expect(resultado).toEqual({
      tipo: "faq",
      item: expect.objectContaining({ id: "pagos-envio-bloqueado" }),
    });
  });

  it("sin_resultado si ninguna FAQ coincide", () => {
    const resultado = responderPregunta("xyzxyz asdasd 12345", []);
    expect(resultado).toEqual({ tipo: "sin_resultado" });
  });
});

describe("responderPregunta — historial propio", () => {
  it("sin_consulta_encontrada si el cliente no tiene ninguna consulta todavía", () => {
    const resultado = responderPregunta("cuál es el estado de mi celular", []);
    expect(resultado).toEqual({ tipo: "sin_consulta_encontrada" });
  });

  it("encuentra la única consulta cuya descripción coincide", () => {
    const misConsultas = [diag("d1", "Celular usado"), diag("d2", "Audífonos inalámbricos")];
    const resultado = responderPregunta("cuál es el estado de mi celular", misConsultas);
    expect(resultado).toEqual({ tipo: "consulta", diagnostico: misConsultas[0] });
  });

  it("lista varias si más de una consulta coincide", () => {
    const misConsultas = [diag("d1", "Cargador de celular"), diag("d2", "Funda para celular")];
    const resultado = responderPregunta("cuál es el estado de mi celular", misConsultas);
    expect(resultado).toEqual({ tipo: "consultas", diagnosticos: misConsultas });
  });

  it("sin_consulta_encontrada si el producto no aparece en el historial", () => {
    const misConsultas = [diag("d1", "Audífonos inalámbricos")];
    const resultado = responderPregunta("estado de mi celular", misConsultas);
    expect(resultado).toEqual({ tipo: "sin_consulta_encontrada" });
  });

  it("'mi historial' devuelve las más recientes sin filtrar por producto", () => {
    const misConsultas = [diag("d1", "Celular"), diag("d2", "Audífonos"), diag("d3", "Cargador")];
    const resultado = responderPregunta("quiero ver mi historial", misConsultas);
    expect(resultado).toEqual({ tipo: "consultas", diagnosticos: misConsultas });
  });

  it("'mi última consulta' también dispara el listado reciente", () => {
    const misConsultas = [diag("d1", "Celular")];
    const resultado = responderPregunta("cuál fue el resultado de mi última consulta", misConsultas);
    expect(resultado).toEqual({ tipo: "consultas", diagnosticos: misConsultas });
  });

  it("no busca en el historial sin una señal explícita de 'mi/mis'", () => {
    // "celular" solo, sin "mi consulta"/"estado de mi"/etc., es una pregunta
    // general -> debe ir a buscar FAQ, no al historial.
    const misConsultas = [diag("d1", "Celular")];
    const resultado = responderPregunta("celular", misConsultas);
    expect(resultado.tipo).not.toBe("consulta");
    expect(resultado.tipo).not.toBe("consultas");
  });
});
