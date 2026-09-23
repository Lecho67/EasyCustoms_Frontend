import { supabase } from "./supabase";
import type { CustomsQuery, Profile } from "@/types/database.types";

export interface CasoEnCola extends CustomsQuery {
  // Acotado a lo que pinta la UI (nombre/email en la cola) — no el perfil
  // completo: evita mandar document_number/dirección/kyc_document_path de
  // cada cliente a cualquier agente que abra la cola.
  cliente?: Pick<Profile, "id" | "full_name" | "email">;
}

export async function fetchColaDeRevision(): Promise<CasoEnCola[]> {
  const { data, error } = await supabase
    .from("customs_queries")
    .select("*, cliente:profiles!customs_queries_user_id_fkey(id, full_name, email)")
    .in("ai_verdict", ["REQUIERE_DOCUMENTACION", "PRECAUCION"])
    .is("overridden_by", null) // ya confirmado/sobrescrito por un agente: sale de la cola
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as CasoEnCola[];
}
export async function tomarCaso(shipmentId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const agenteId = sessionData.session?.user.id;

  const { data, error } = await supabase
    .from("customs_queries")
    .update({ assigned_agent_id: agenteId })
    .eq("id", shipmentId)
    .is("assigned_agent_id", null) // evita que dos agentes lo tomen a la vez
    .select()
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Este caso ya fue tomado por otro agente");
  return data;
}

/**
 * Confirma o sobrescribe el veredicto de un caso en una sola operación
 * atómica (RPC `revisar_caso`, `SECURITY DEFINER`). El propio RPC preserva
 * el veredicto original real con `coalesce(original_ai_verdict, ai_verdict)`
 * aunque el caso se revise más de una vez, y aplica el mismo filtro de fila
 * que la política RLS (admin, o agente sin caso asignado o asignado a él).
 *
 * Una "confirmación" (mismo `nuevoVeredicto` que el actual) deja
 * `original_ai_verdict = ai_verdict`, así que las métricas por agente
 * (`metricas_globales`) no la cuentan como una modificación real.
 */
export async function revisarCaso(shipmentId: string, nuevoVeredicto: string, motivo: string) {
  const { data, error } = await supabase.rpc("revisar_caso", {
    p_caso_id: shipmentId,
    p_veredicto: nuevoVeredicto,
    p_motivo: motivo,
  });

  if (error) throw new Error(error.message);
  return data;
}