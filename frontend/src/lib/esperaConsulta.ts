// src/lib/esperaConsulta.ts
import { supabase } from "./supabase";

/**
 * Segundos que faltan para poder enviar otra consulta (0 = ya puede). Lo calcula
 * el RPC `segundos_espera_consulta()` con el reloj del servidor — el valor de la
 * espera vive solo en SQL (docs/sql/limites-de-uso.sql). Ante cualquier fallo
 * (red, RPC ausente) devuelve 0: el trigger de la base igual rechaza el insert
 * si corresponde.
 */
export async function segundosEsperaConsulta(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc("segundos_espera_consulta");
    if (error || typeof data !== "number") return 0;
    return data;
  } catch {
    return 0;
  }
}
