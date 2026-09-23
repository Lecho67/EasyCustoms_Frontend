// src/lib/sessionService.ts
import { supabase } from "./supabase";

/**
 * Sesión única por cuenta ("la última gana"). Toma el control de la cuenta: el
 * RPC `registrar_sesion()` marca esta sesión como la activa y revoca las demás.
 * Un fallo no bloquea el login (solo queda sin revocar las otras sesiones).
 */
export async function registrarSesion(): Promise<void> {
  const { error } = await supabase.rpc("registrar_sesion");
  if (error) console.error("No se pudo registrar la sesión única:", error.message);
}

/**
 * ¿Esta sesión sigue siendo la activa de la cuenta? Ante un fallo de red o un
 * RPC ausente devuelve `true`: no se expulsa a nadie por un problema de
 * infraestructura.
 */
export async function sesionSigueVigente(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("sesion_vigente");
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}
