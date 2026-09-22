import { useState } from "react";
import { Link } from "react-router-dom";
import { Upload, CheckCircle2, Clock, XCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { KycModal } from "@/components/kyc/KycModal";
import { toast } from "@/lib/toast";
import {
  actualizarDatosIdentidad,
  subirDocumentoIdentidad,
  aceptarTerminos,
  aceptarHabeasData,
} from "@/lib/kycService";
import type { DocumentType, KycStatus } from "@/types/database.types";

const TIPOS_DOCUMENTO: DocumentType[] = ["CC", "CE", "Pasaporte", "NIT"];

const KYC_BADGE: Record<KycStatus, { label: string; classes: string; icon: typeof Clock }> = {
  no_iniciado: { label: "Sin verificar", classes: "bg-slate-100 text-slate-600", icon: Clock },
  pendiente: { label: "En revisión", classes: "bg-amber-100 text-amber-800", icon: Clock },
  aprobado: { label: "Verificado", classes: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  rechazado: { label: "Rechazado", classes: "bg-red-100 text-red-700", icon: XCircle },
};

const KYC_AYUDA: Record<KycStatus, string> = {
  no_iniciado:
    "Cargá el tipo y número de tu documento oficial y una foto del mismo. Un agente revisa la información y habilita tu casillero.",
  pendiente:
    "Recibimos tu documento y está en revisión. Te avisamos por notificación cuando quede verificado.",
  aprobado: "Tu identidad está verificada. Ya podés operar el casillero y los trámites aduaneros.",
  rechazado:
    "Tu verificación fue rechazada. Corregí los datos, subí una foto más clara del documento y volvé a enviar.",
};

export function VerifyIdentity() {
  const { profile, user, refreshProfile } = useAuth();

  const [documentType, setDocumentType] = useState<DocumentType>(profile?.document_type ?? "CC");
  const [documentNumber, setDocumentNumber] = useState(profile?.document_number ?? "");
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);

  const [aceptandoTerminos, setAceptandoTerminos] = useState(false);
  const [aceptandoHabeasData, setAceptandoHabeasData] = useState(false);
  const [modalAbierto, setModalAbierto] = useState<"terminos" | "habeas_data" | null>(null);

  if (!profile || !user) return null;

  const kycStatus = profile.kyc_status ?? "no_iniciado";
  const kycBadge = KYC_BADGE[kycStatus];
  const KycBadgeIcon = kycBadge.icon;

  const terminosAceptados = Boolean(profile.terms_accepted_at);
  const habeasDataAceptado = Boolean(profile.habeas_data_accepted_at);
  const casilleroHabilitado = terminosAceptados && habeasDataAceptado;

  const handleGuardarDatosIdentidad = async () => {
    if (!documentNumber.trim()) {
      toast.error("Completá el número de documento", "Es obligatorio para verificar tu identidad.");
      return;
    }
    setGuardandoDatos(true);
    try {
      await actualizarDatosIdentidad(user.id, documentType, documentNumber);
      await refreshProfile();
      toast.success("Datos guardados correctamente");
    } catch (err) {
      toast.error("No se pudieron guardar los datos", err instanceof Error ? err.message : undefined);
    } finally {
      setGuardandoDatos(false);
    }
  };

  const handleSubirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoArchivo(true);
    try {
      await subirDocumentoIdentidad(user.id, file);
      await refreshProfile();
      toast.success("Documento recibido", "Tu identidad quedó en revisión. Te avisaremos cuando se verifique.");
    } catch (err) {
      toast.error("No se pudo subir el documento", err instanceof Error ? err.message : undefined);
    } finally {
      setSubiendoArchivo(false);
      e.target.value = "";
    }
  };

  const handleAceptarTerminos = async (checked: boolean) => {
    if (!checked || terminosAceptados) return;
    setAceptandoTerminos(true);
    try {
      await aceptarTerminos(user.id);
      await refreshProfile();
      toast.success("Términos aceptados", "Registramos tu aceptación de los Términos y Condiciones.");
    } catch (err) {
      toast.error("No se pudo registrar la aceptación", err instanceof Error ? err.message : undefined);
    } finally {
      setAceptandoTerminos(false);
    }
  };

  const handleAceptarHabeasData = async (checked: boolean) => {
    if (!checked || habeasDataAceptado) return;
    setAceptandoHabeasData(true);
    try {
      await aceptarHabeasData(user.id);
      await refreshProfile();
      toast.success("Autorización registrada", "Registramos tu autorización de tratamiento de datos.");
    } catch (err) {
      toast.error("No se pudo registrar la autorización", err instanceof Error ? err.message : undefined);
    } finally {
      setAceptandoHabeasData(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 sm:mt-16 mb-16 px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-cobalt mb-1">Verificar identidad</h1>
      <p className="text-slate-600 mb-6">
        Por normativa aduanera (Ley 1581 de 2012) necesitamos verificar tu identidad antes de
        habilitar tu casillero y los trámites aduaneros.
      </p>

      {/* --- Estado de la verificación --- */}
      <section className="mb-8 rounded-xl border border-slate-200 p-5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-800">Estado</h2>
          <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${kycBadge.classes}`}>
            <KycBadgeIcon className="h-3.5 w-3.5" />
            {kycBadge.label}
          </span>
        </div>
        <p className="text-sm text-slate-500">{KYC_AYUDA[kycStatus]}</p>
        {kycStatus === "rechazado" && profile.kyc_rejection_reason && (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            Motivo del rechazo: {profile.kyc_rejection_reason}
          </p>
        )}
      </section>

      {/* --- Documento de identidad --- */}
      <section className="mb-8 rounded-xl border border-slate-200 p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Documento de identidad</h2>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="vi-tipo-doc" className="mb-1 block text-xs font-medium text-slate-600">
              Tipo de documento
            </label>
            <select
              id="vi-tipo-doc"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt focus:border-transparent"
            >
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="vi-num-doc" className="mb-1 block text-xs font-medium text-slate-600">
              Número de documento
            </label>
            <input
              id="vi-num-doc"
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="Ej: 1002003004"
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt focus:border-transparent"
            />
          </div>
        </div>

        <Button variant="primary" onClick={handleGuardarDatosIdentidad} disabled={guardandoDatos} className="mb-5">
          {guardandoDatos ? "Guardando..." : "Guardar datos"}
        </Button>

        <div className="border-t border-slate-100 pt-4">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Foto del documento de identidad
          </label>
          <p className="mb-3 text-xs text-slate-400">JPG, PNG o PDF — máximo 5 MB.</p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-4 text-sm text-slate-500 transition-colors hover:border-cobalt hover:text-cobalt">
            <Upload className="h-4 w-4" />
            {subiendoArchivo ? "Subiendo..." : "Subir foto del documento"}
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={handleSubirArchivo}
              disabled={subiendoArchivo}
              className="hidden"
            />
          </label>
          {profile.kyc_document_path && (
            <p className="mt-2 text-xs text-slate-400">
              Ya tenés un documento cargado. Subir uno nuevo lo reemplaza y vuelve a ponerlo en revisión.
            </p>
          )}
        </div>
      </section>

      {/* --- Autorizaciones legales --- */}
      <section className="mb-8 rounded-xl border border-slate-200 p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Autorizaciones legales</h2>

        <div className="mb-3 flex items-start gap-3">
          <input
            type="checkbox"
            id="vi-chk-terminos"
            checked={terminosAceptados}
            disabled={terminosAceptados || aceptandoTerminos}
            onChange={(e) => handleAceptarTerminos(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-cobalt focus:ring-cobalt"
          />
          <label htmlFor="vi-chk-terminos" className="text-sm text-slate-700">
            Acepto los{" "}
            <button
              type="button"
              onClick={() => setModalAbierto("terminos")}
              className="font-medium text-cobalt underline underline-offset-2"
            >
              Términos y Condiciones
            </button>{" "}
            del servicio.
            {terminosAceptados && (
              <span className="ml-2 text-xs text-emerald-600">
                Aceptado el {new Date(profile.terms_accepted_at!).toLocaleDateString("es-CO")}
              </span>
            )}
          </label>
        </div>

        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="vi-chk-habeas"
            checked={habeasDataAceptado}
            disabled={habeasDataAceptado || aceptandoHabeasData}
            onChange={(e) => handleAceptarHabeasData(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-cobalt focus:ring-cobalt"
          />
          <label htmlFor="vi-chk-habeas" className="text-sm text-slate-700">
            Autorizo el tratamiento de mis datos personales conforme a la{" "}
            <button
              type="button"
              onClick={() => setModalAbierto("habeas_data")}
              className="font-medium text-cobalt underline underline-offset-2"
            >
              Política de Habeas Data (Ley 1581 de 2012)
            </button>
            .
            {habeasDataAceptado && (
              <span className="ml-2 text-xs text-emerald-600">
                Aceptado el {new Date(profile.habeas_data_accepted_at!).toLocaleDateString("es-CO")}
              </span>
            )}
          </label>
        </div>
      </section>

      {/* --- Estado del casillero --- */}
      <section
        className={`rounded-xl border p-5 ${
          casilleroHabilitado ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className={`h-5 w-5 ${casilleroHabilitado ? "text-emerald-600" : "text-amber-600"}`} />
          <p className={`text-sm font-medium ${casilleroHabilitado ? "text-emerald-800" : "text-amber-800"}`}>
            {casilleroHabilitado
              ? "Aceptaste los términos y la Política de Habeas Data."
              : "Aceptá los Términos y la Política de Habeas Data para habilitar tu casillero."}
          </p>
        </div>
        {casilleroHabilitado && (
          <Link to="/casillero" className="mt-3 inline-block text-sm font-medium text-cobalt">
            Ir a mi casillero →
          </Link>
        )}
      </section>

      {modalAbierto && <KycModal tipo={modalAbierto} onClose={() => setModalAbierto(null)} />}
    </div>
  );
}
