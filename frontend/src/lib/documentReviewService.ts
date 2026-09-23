import { supabase } from "./supabase";
import type { DocumentRecord, Profile } from "@/types/database.types";

export interface DocumentoConCliente extends DocumentRecord {
  // Acotado a lo que pinta la UI (nombre/email en la cola) — no el perfil
  // completo: evita mandar document_number/dirección/kyc_document_path de
  // cada cliente a cualquier agente que abra la cola.
  cliente?: Pick<Profile, "id" | "full_name" | "email">;
}

export async function fetchDocumentosPendientes(): Promise<DocumentoConCliente[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*, cliente:profiles!documents_user_id_fkey(id, full_name, email)")
    .eq("status", "pendiente")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data as DocumentoConCliente[];
}

export async function revisarDocumento(
  docId: string,
  nuevoStatus: "aprobado" | "rechazado",
  motivo: string,
) {
  const { data: sessionData } = await supabase.auth.getSession();
  const reviewerId = sessionData.session?.user.id;

  const { data, error } = await supabase
    .from("documents")
    .update({
      status: nuevoStatus,
      reviewed_by: reviewerId,
      review_reason: motivo,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", docId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function obtenerUrlDocumentoParaRevision(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(filePath, 60 * 5);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/**
 * Documentos de un cliente puntual, usados en el drawer de auditoría del
 * Panel de Agente (`/panel-agente`) para mostrar los adjuntos del caso que
 * se está revisando. No hay FK directa entre `customs_queries` y `documents`
 * (solo `related_pre_alert_id`), así que traemos todos los documentos del
 * cliente y dejamos que el agente identifique los relevantes por nombre/fecha.
 */
export async function fetchDocumentosDeCliente(userId: string): Promise<DocumentRecord[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as DocumentRecord[];
}

export async function tomarDocumento(docId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const agenteId = sessionData.session?.user.id;

  const { data, error } = await supabase
    .from("documents")
    .update({ assigned_agent_id: agenteId })
    .eq("id", docId)
    .is("assigned_agent_id", null)
    .select()
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Este documento ya fue tomado por otro agente");
  return data;
}