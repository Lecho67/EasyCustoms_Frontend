import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Gate del Casillero (`/casillero`). Bloqueo duro cuando:
 *  - No se aceptaron Términos + Habeas Data (Ley 1581 de 2012), o
 *  - La identidad no está verificada y no está en revisión (`no_iniciado` / `rechazado`).
 *
 * El estado `pendiente` sí deja pasar: el Casillero se muestra en modo lectura
 * con un banner (ver `Locker.tsx`). La cláusula 3 de los Términos exige
 * verificar identidad para operar el casillero y los trámites aduaneros.
 */
export function RequireCompliance({ children }: { children: ReactNode }) {
  const { profile } = useAuth();

  // El gate de cumplimiento aplica solo a clientes. Los roles internos
  // (agente / gestor / admin) no operan un casillero personal ni cargan
  // documentos de envío propios bajo este régimen, y no deben quedar
  // bloqueados por no tener términos/KYC.
  if (profile && profile.role !== "cliente") {
    return <>{children}</>;
  }

  const terminosOk = Boolean(profile?.terms_accepted_at && profile?.habeas_data_accepted_at);
  const kycStatus = profile?.kyc_status ?? "no_iniciado";
  const kycBloquea = kycStatus === "no_iniciado" || kycStatus === "rechazado";

  if (!terminosOk || kycBloquea) {
    const motivo = !terminosOk
      ? {
          titulo: "Necesitás aceptar los términos para usar el Casillero",
          detalle:
            "Por normativa (Ley 1581 de 2012), antes de habilitar tu casillero virtual debés aceptar los Términos y Condiciones y la Política de Tratamiento de Datos.",
        }
      : kycStatus === "rechazado"
        ? {
            titulo: "Tu verificación de identidad fue rechazada",
            detalle:
              "Para operar el casillero necesitas una identidad verificada. Revisa el motivo del rechazo, corrige los datos y vuelve a subir tu documento.",
          }
        : {
            titulo: "Verifica tu identidad para usar el Casillero",
            detalle:
              "La cláusula 3 de los Términos exige verificar tu identidad con un documento oficial vigente (CC, CE, Pasaporte o NIT) antes de operar el casillero y los trámites aduaneros.",
          };

    return (
      <div className="max-w-lg mx-auto mt-16 sm:mt-24 px-4 sm:px-6 lg:px-8 py-6 text-center">
        <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-amber-500" />
        <h1 className="text-lg font-semibold text-slate-900 mb-2">{motivo.titulo}</h1>
        <p className="text-sm text-slate-500 mb-6">{motivo.detalle}</p>
        <Link
          to="/verificar-identidad"
          className="inline-block rounded-xl bg-cobalt px-5 py-2.5 text-sm font-medium text-white hover:bg-cobalt-600"
        >
          Ir a verificar identidad
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
