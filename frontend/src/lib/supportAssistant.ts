// src/lib/supportAssistant.ts
import { FAQ_ITEMS, type FaqItem } from "./faqData";
import type { DiagnosticoEnvio } from "./types";

/**
 * Lógica del chat de ayuda. A propósito NO es un LLM: es un asistente
 * determinístico que busca en las FAQ reales (`faqData.ts`) y en el
 * historial real del cliente (`customs_queries`, vía `DiagnosticoEnvio[]`).
 * No genera texto libre ni inventa nada — cada respuesta viene de un dato
 * real o es una oferta explícita de escalar a un asesor humano. Puro y sin
 * IO para poder testearlo sin mockear Supabase ni React.
 */

export type RespuestaAsistente =
  | { tipo: "faq"; item: FaqItem }
  | { tipo: "consulta"; diagnostico: DiagnosticoEnvio }
  | { tipo: "consultas"; diagnosticos: DiagnosticoEnvio[] }
  | { tipo: "sin_consulta_encontrada" }
  | { tipo: "ofrecer_asesor" }
  | { tipo: "sin_resultado" };

const MAX_CONSULTAS_LISTADAS = 5;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes
    .replace(/[¿?¡!.,;:()"']/g, "") // quita puntuación común de preguntas
    .replace(/\s+/g, " ")
    .trim();
}

// Frases de alta señal: quien las escribe quiere explícitamente hablar con
// una persona, no que seamos "más precisos" en la búsqueda.
const FRASES_PEDIR_ASESOR = [
  "asesor",
  "hablar con alguien",
  "hablar con una persona",
  "persona real",
  "agente humano",
  "humano",
  "representante",
];

// Frases que marcan que la pregunta es sobre el propio historial del
// cliente, no una duda general — sin esta señal explícita no tocamos
// customs_queries (evita interpretar cualquier mención de un producto como
// "buscá en mi historial").
const FRASES_MI_HISTORIAL = [
  "mi consulta",
  "mis consultas",
  "mi envio",
  "mis envios",
  "mi historial",
  "mi ultima consulta",
  "mi ultimo envio",
  "estado de mi",
  "por que mi",
  "porque mi",
  "resultado de mi",
];

const FRASES_MAS_RECIENTE = ["ultima", "ultimo", "reciente", "historial"];

function coincideAlguna(textoNormalizado: string, frases: string[]): boolean {
  return frases.some((frase) => textoNormalizado.includes(frase));
}

function buscarEnHistorial(
  textoNormalizado: string,
  misConsultas: DiagnosticoEnvio[]
): RespuestaAsistente {
  if (misConsultas.length === 0) return { tipo: "sin_consulta_encontrada" };

  if (coincideAlguna(textoNormalizado, FRASES_MAS_RECIENTE)) {
    return { tipo: "consultas", diagnosticos: misConsultas.slice(0, MAX_CONSULTAS_LISTADAS) };
  }

  // Descarta las frases-señal y palabras muy cortas para quedarse con lo que
  // probablemente sea el nombre del producto ("¿cuál es el estado de mi
  // celular?" -> "celular").
  const palabrasClave = FRASES_MI_HISTORIAL.reduce(
    (t, frase) => t.replace(frase, " "),
    textoNormalizado
  )
    .split(/\s+/)
    .filter((palabra) => palabra.length >= 4);

  const coincidencias = misConsultas.filter((c) => {
    const descripcion = normalizar(c.input.descripcionItem);
    return palabrasClave.some((palabra) => descripcion.includes(palabra));
  });

  if (coincidencias.length === 0) return { tipo: "sin_consulta_encontrada" };
  if (coincidencias.length === 1) return { tipo: "consulta", diagnostico: coincidencias[0] };
  return { tipo: "consultas", diagnosticos: coincidencias.slice(0, MAX_CONSULTAS_LISTADAS) };
}

function buscarEnFaq(textoNormalizado: string): RespuestaAsistente {
  const porPregunta = FAQ_ITEMS.find((item) => normalizar(item.pregunta).includes(textoNormalizado));
  if (porPregunta) return { tipo: "faq", item: porPregunta };

  // Coincidencia por palabra suelta (no la frase completa): igual que
  // SupportCenter, pero acá alcanza con la primera para dar UNA respuesta.
  const palabras = textoNormalizado.split(/\s+/).filter((p) => p.length >= 4);
  const porPalabra = FAQ_ITEMS.find((item) => {
    const pregunta = normalizar(item.pregunta);
    const respuesta = normalizar(item.respuesta);
    return palabras.some((p) => pregunta.includes(p) || respuesta.includes(p));
  });

  return porPalabra ? { tipo: "faq", item: porPalabra } : { tipo: "sin_resultado" };
}

export function responderPregunta(
  mensaje: string,
  misConsultas: DiagnosticoEnvio[]
): RespuestaAsistente {
  const texto = normalizar(mensaje);
  if (!texto) return { tipo: "sin_resultado" };

  if (coincideAlguna(texto, FRASES_PEDIR_ASESOR)) return { tipo: "ofrecer_asesor" };
  if (coincideAlguna(texto, FRASES_MI_HISTORIAL)) return buscarEnHistorial(texto, misConsultas);

  return buscarEnFaq(texto);
}
