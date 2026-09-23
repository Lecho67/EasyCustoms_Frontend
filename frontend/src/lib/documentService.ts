import { supabase } from "./supabase";
import type { DocumentRecord } from "@/types/database.types";

const TAMANO_MAXIMO_MB = 10;
const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "application/pdf"];

export async function fetchMisDocumentos(): Promise<DocumentRecord[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as DocumentRecord[];
}

export async function subirDocumento(file: File, relatedPreAlertId?: string) {
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    throw new Error("Formato no permitido. Subí una imagen (JPG/PNG) o un PDF.");
  }
  if (file.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
    throw new Error(`El archivo supera el tamaño máximo de ${TAMANO_MAXIMO_MB} MB.`);
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("No hay sesión activa");

  // Path obligatorio: {user_id}/{timestamp}-{nombre}, exigido por la policy de Storage
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, file);

  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      file_name: file.name,
      file_path: path,
      file_type: file.type || "application/octet-stream",
      related_pre_alert_id: relatedPreAlertId ?? null,
    })
    .select()
    .single();

  if (error) {
    // Si falla el insert en la tabla, limpiamos el archivo ya subido para no dejar huérfanos
    await supabase.storage.from("documents").remove([path]);
    throw new Error(error.message);
  }

  return data as DocumentRecord;
}

export async function obtenerUrlDocumento(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(filePath, 60 * 5); // 5 minutos de validez

  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function eliminarDocumento(doc: DocumentRecord) {
  const { error: storageError } = await supabase.storage
    .from("documents")
    .remove([doc.file_path]);

  if (storageError) throw new Error(storageError.message);

  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) throw new Error(error.message);
}