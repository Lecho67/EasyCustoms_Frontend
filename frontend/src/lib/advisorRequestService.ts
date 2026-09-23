// src/lib/advisorRequestService.ts
import { supabase } from "./supabase";
import type { SolicitudAsesor } from "@/types/database.types";

/**
 * Cola de "pedir un asesor personal" (disparada desde el chat de ayuda).
 * No auto-asigna gestor: el admin ve la cola en /admin y asigna el gestor a
 * mano desde AdminUserTable (asignarGestor, ya existente); acá solo se marca
 * como atendida. Ver docs/sql/solicitudes-asesor.sql.
 */

/** 23505 = unique_violation. Un índice único en (user_id) where estado =
 * 'pendiente' impide más de una solicitud pendiente por cliente. */
const CODIGO_YA_PENDIENTE = "23505";

export async function crearSolicitudAsesor(mensaje?: string): Promise<SolicitudAsesor> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("No hay sesión activa");

  const { data, error } = await supabase
    .from("solicitudes_asesor")
    .insert({ user_id: userId, mensaje: mensaje?.trim() || null })
    .select()
    .single();

  if (error) {
    if (error.code === CODIGO_YA_PENDIENTE) {
      throw new Error("Ya tenés una solicitud de asesor pendiente.");
    }
    throw new Error(error.message);
  }

  return data as SolicitudAsesor;
}

/** La solicitud pendiente del cliente actual, si tiene una (para que el chat
 * sepa que ya pidió asesor y no vuelva a ofrecer el botón). */
export async function fetchMiSolicitudPendiente(): Promise<SolicitudAsesor | null> {
  const { data, error } = await supabase
    .from("solicitudes_asesor")
    .select("*")
    .eq("estado", "pendiente")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as SolicitudAsesor | null;
}

/** Cola de admin: solicitudes pendientes, con el nombre/correo del cliente. */
export interface SolicitudAsesorConCliente extends SolicitudAsesor {
  cliente_nombre: string | null;
  cliente_email: string;
}

export async function fetchSolicitudesPendientes(): Promise<SolicitudAsesorConCliente[]> {
  const { data, error } = await supabase
    .from("solicitudes_asesor")
    .select("*, cliente:profiles!solicitudes_asesor_user_id_fkey(full_name, email)")
    .eq("estado", "pendiente")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data as Array<SolicitudAsesor & { cliente: { full_name: string | null; email: string } | null }>).map(
    (row) => ({
      ...row,
      cliente_nombre: row.cliente?.full_name ?? null,
      cliente_email: row.cliente?.email ?? "",
    })
  );
}

export async function marcarSolicitudAtendida(id: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const adminId = sessionData.session?.user.id;
  if (!adminId) throw new Error("No hay sesión activa");

  const { error } = await supabase
    .from("solicitudes_asesor")
    .update({ estado: "atendida", atendida_por: adminId, atendida_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}
