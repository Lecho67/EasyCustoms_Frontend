import { supabase } from "./supabase";
import type { DiagnosticoEnvio } from "./types";
import type { CustomsQuery } from "@/types/database.types";

/**
 * `customs_queries.raw_response` guarda el `DiagnosticoEnvio` completo (tal
 * como se muestra en /consulta/:id) al momento de crear la consulta — no
 * solo la respuesta cruda del motor. Esto permite reconstruir la pantalla
 * de resultado sin volver a llamar al backend de reglas.
 */
function mapVerdictToNivel(aiVerdict: string | null): DiagnosticoEnvio["nivel"] {
  const v = (aiVerdict ?? "").toUpperCase();
  if (v === "APROBADO") return "verde";
  if (v === "BLOQUEO") return "rojo";
  // PRECAUCION, REQUIERE_DOCUMENTACION, o cualquier valor desconocido/nulo
  return "amarillo";
}
function rowToDiagnostico(row: CustomsQuery): DiagnosticoEnvio | null {
  if (row.raw_response && typeof row.raw_response === "object") {
    const stored = row.raw_response as Partial<DiagnosticoEnvio>;
    if (stored.id && stored.nivel && stored.input) {
      return stored as DiagnosticoEnvio;
    }
  }

  // Fallback para filas antiguas guardadas antes de este cambio, o si
  // raw_response viene vacío: reconstruimos lo mínimo con las columnas
  // planas de la tabla (sin justificación/desglose detallado).
  return {
    id: row.id,
    nivel: mapVerdictToNivel(row.ai_verdict),
    titulo: "Consulta guardada",
    resumen: "Detalle completo no disponible para esta consulta antigua.",
    justificacion: "",
    fuenteNormativa: "",
    documentosRequeridos: [],
    accionesSugeridas: [],
    partidaArancelariaTentativa: row.hs_code ?? "Sin partida tentativa declarada",
    desgloseImpuestos: null,
    deMinimis: null,
    createdAt: row.created_at,
    input: {
      paisDestino: "",
      descripcionItem: row.product_description,
    },
  };
}

export async function fetchConsultas(): Promise<DiagnosticoEnvio[]> {
  const { data, error } = await supabase
    .from("customs_queries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al leer customs_queries:", error);
    return [];
  }

  return (data as CustomsQuery[]).map(rowToDiagnostico).filter((d): d is DiagnosticoEnvio => d !== null);
}

export async function fetchConsultaById(id: string): Promise<DiagnosticoEnvio | null> {
  const { data, error } = await supabase
    .from("customs_queries")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("Error al leer customs_queries por id:", error);
    return null;
  }

  return rowToDiagnostico(data as CustomsQuery);
}
