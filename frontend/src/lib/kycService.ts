import { supabase } from "./supabase";
import type { DocumentType, Profile } from "@/types/database.types";

const KYC_BUCKET = "kyc-documents";
const TAMANO_MAXIMO_MB = 5;
const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "application/pdf"];

export async function actualizarDatosIdentidad(
  userId: string,
  documentType: DocumentType,
  documentNumber: string
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ document_type: documentType, document_number: documentNumber.trim() })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function subirDocumentoIdentidad(userId: string, file: File): Promise<Profile> {
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    throw new Error("Formato no permitido. Sube una imagen (JPG/PNG) o un PDF.");
  }
  if (file.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
    throw new Error(`El archivo supera el tamaño máximo de ${TAMANO_MAXIMO_MB} MB.`);
  }

  const ext = file.name.split(".").pop();
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(KYC_BUCKET).upload(path, file);
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("profiles")
    .update({ kyc_document_path: path, kyc_status: "pendiente", kyc_rejection_reason: null })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function obtenerUrlDocumentoIdentidad(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(KYC_BUCKET).createSignedUrl(path, 60 * 5);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function aceptarTerminos(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ terms_accepted_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function aceptarHabeasData(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ habeas_data_accepted_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Profile;
}