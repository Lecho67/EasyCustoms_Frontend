import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, XCircle, KeyRound, IdCard, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import {
  actualizarInformacionPersonal,
  actualizarDireccion,
  solicitarCambioContrasena,
} from "@/lib/profileService";
import { NotificationPreferencesCard } from "@/components/profile/NotificationPreferencesCard";
import type { KycStatus, UserRole } from "@/types/database.types";

const KYC_BADGE: Record<KycStatus, { label: string; classes: string; icon: typeof Clock }> = {
  no_iniciado: { label: "Sin verificar", classes: "bg-slate-100 text-slate-600", icon: Clock },
  pendiente: { label: "En revisión", classes: "bg-amber-100 text-amber-800", icon: Clock },
  aprobado: { label: "Verificado", classes: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  rechazado: { label: "Rechazado", classes: "bg-red-100 text-red-700", icon: XCircle },
};

const ROLE_BADGE: Record<UserRole, { label: string; classes: string }> = {
  cliente: { label: "Cliente", classes: "bg-slate-100 text-slate-700" },
  agente: { label: "Agente", classes: "bg-blue-100 text-blue-700" },
  gestor: { label: "Gestor", classes: "bg-purple-100 text-purple-700" },
  admin: { label: "Administrador", classes: "bg-slate-800 text-white" },
};

export function Profile() {
  const { profile, user, refreshProfile } = useAuth();

  // --- Tarjeta 1: Información de contacto ---
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [guardandoInfo, setGuardandoInfo] = useState(false);

  // --- Tarjeta 2: Dirección ---
  const [addressStreet, setAddressStreet] = useState(profile?.address_street ?? "");
  const [addressCity, setAddressCity] = useState(profile?.address_city ?? "");
  const [addressDepartment, setAddressDepartment] = useState(profile?.address_department ?? "");
  const [addressPostalCode, setAddressPostalCode] = useState(profile?.address_postal_code ?? "");
  const [addressCountry, setAddressCountry] = useState(profile?.address_country ?? "Colombia");
  const [guardandoDireccion, setGuardandoDireccion] = useState(false);

  // --- Tarjeta 3: Seguridad ---
  const [enviandoCambioContrasena, setEnviandoCambioContrasena] = useState(false);

  if (!profile || !user) return null;

  const kycStatus = profile.kyc_status ?? "no_iniciado";
  const kycBadge = KYC_BADGE[kycStatus];
  const KycBadgeIcon = kycBadge.icon;
  const roleBadge = ROLE_BADGE[profile.role];

  // --- Handlers Tarjeta 1 ---
  const handleGuardarInformacionPersonal = async () => {
    if (!fullName.trim()) {
      toast.error("Completá tu nombre completo");
      return;
    }
    setGuardandoInfo(true);
    try {
      await actualizarInformacionPersonal(user.id, { full_name: fullName, phone });
      await refreshProfile();
      toast.success("Perfil actualizado correctamente");
    } catch (err) {
      toast.error("No se pudo actualizar el perfil", err instanceof Error ? err.message : undefined);
    } finally {
      setGuardandoInfo(false);
    }
  };

  // --- Handler Tarjeta 2 ---
  const handleGuardarDireccion = async () => {
    if (!addressStreet.trim() || !addressCity.trim() || !addressCountry.trim()) {
      toast.error("Completá al menos dirección, ciudad y país");
      return;
    }
    setGuardandoDireccion(true);
    try {
      await actualizarDireccion(user.id, {
        address_street: addressStreet,
        address_city: addressCity,
        address_department: addressDepartment,
        address_postal_code: addressPostalCode,
        address_country: addressCountry,
      });
      await refreshProfile();
      toast.success("Perfil actualizado correctamente");
    } catch (err) {
      toast.error("No se pudo guardar la dirección", err instanceof Error ? err.message : undefined);
    } finally {
      setGuardandoDireccion(false);
    }
  };

  // --- Handler Tarjeta 3 ---
  const handleCambiarContrasena = async () => {
    setEnviandoCambioContrasena(true);
    try {
      await solicitarCambioContrasena(user.email!);
      toast.success("Revisá tu correo", "Te enviamos un enlace para restablecer tu contraseña.");
    } catch (err) {
      toast.error("No se pudo enviar el enlace", err instanceof Error ? err.message : undefined);
    } finally {
      setEnviandoCambioContrasena(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 sm:mt-16 mb-16 px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-cobalt mb-1">Mi Perfil</h1>
      <p className="text-slate-600 mb-8">
        Gestioná tus datos de contacto, tu dirección y la seguridad de tu cuenta.
      </p>

      {/* --- Tarjeta 1: Información de contacto --- */}
      <section className="mb-8 rounded-xl border border-slate-200 p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Información de contacto</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="pf-nombre" className="mb-1 block text-xs font-medium text-slate-600">
              Nombre completo
            </label>
            <input
              id="pf-nombre"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="pf-email" className="mb-1 block text-xs font-medium text-slate-600">
              Correo electrónico
            </label>
            <input
              id="pf-email"
              type="email"
              value={profile.email}
              disabled
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label htmlFor="pf-telefono" className="mb-1 block text-xs font-medium text-slate-600">
              Teléfono de contacto
            </label>
            <input
              id="pf-telefono"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: +57 300 1234567"
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt focus:border-transparent"
            />
          </div>
        </div>

        <Button variant="primary" onClick={handleGuardarInformacionPersonal} disabled={guardandoInfo} className="mt-4">
          {guardandoInfo ? "Guardando..." : "Guardar cambios"}
        </Button>
      </section>

      {/* --- Tarjeta 2: Dirección principal de envío / facturación --- */}
      <section className="mb-8 rounded-xl border border-slate-200 p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">
          Dirección principal de envío / facturación
        </h2>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="pf-calle" className="mb-1 block text-xs font-medium text-slate-600">
              Dirección (calle)
            </label>
            <input
              id="pf-calle"
              type="text"
              value={addressStreet}
              onChange={(e) => setAddressStreet(e.target.value)}
              placeholder="Ej: Calle 5 # 23-10"
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="pf-ciudad" className="mb-1 block text-xs font-medium text-slate-600">
              Ciudad
            </label>
            <input
              id="pf-ciudad"
              type="text"
              value={addressCity}
              onChange={(e) => setAddressCity(e.target.value)}
              placeholder="Ej: Cali"
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="pf-departamento" className="mb-1 block text-xs font-medium text-slate-600">
              Departamento / Estado
            </label>
            <input
              id="pf-departamento"
              type="text"
              value={addressDepartment}
              onChange={(e) => setAddressDepartment(e.target.value)}
              placeholder="Ej: Valle del Cauca"
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="pf-postal" className="mb-1 block text-xs font-medium text-slate-600">
              Código postal
            </label>
            <input
              id="pf-postal"
              type="text"
              value={addressPostalCode}
              onChange={(e) => setAddressPostalCode(e.target.value)}
              placeholder="Ej: 760001"
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="pf-pais" className="mb-1 block text-xs font-medium text-slate-600">
              País
            </label>
            <input
              id="pf-pais"
              type="text"
              value={addressCountry}
              onChange={(e) => setAddressCountry(e.target.value)}
              placeholder="Ej: Colombia"
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt focus:border-transparent"
            />
          </div>
        </div>

        <Button variant="primary" onClick={handleGuardarDireccion} disabled={guardandoDireccion}>
          {guardandoDireccion ? "Guardando..." : "Guardar cambios"}
        </Button>
      </section>

      {/* --- Tarjeta 3: Seguridad de la cuenta --- */}
      <section className="mb-8 rounded-xl border border-slate-200 p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Seguridad de la cuenta</h2>

        <div className="mb-5">
          <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${roleBadge.classes}`}>
            {roleBadge.label}
          </span>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={handleCambiarContrasena} disabled={enviandoCambioContrasena}>
            <span className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              {enviandoCambioContrasena ? "Enviando enlace..." : "Cambiar contraseña"}
            </span>
          </Button>
          <p className="mt-2 text-xs text-slate-400">
            Te enviaremos un enlace a {profile.email} para restablecer tu contraseña.
          </p>
        </div>
      </section>

      <NotificationPreferencesCard />

      {/* --- Puente a Verificar identidad --- */}
      <Link
        to="/verificar-identidad"
        className="flex items-center gap-4 rounded-xl border border-slate-200 p-5 transition-colors hover:border-cobalt hover:bg-slate-50"
      >
        <IdCard className="h-5 w-5 shrink-0 text-cobalt" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">Verificación de identidad</p>
          <p className="text-xs text-slate-500">
            Documento oficial y autorizaciones legales para habilitar tu casillero.
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${kycBadge.classes}`}>
          <KycBadgeIcon className="h-3.5 w-3.5" />
          {kycBadge.label}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
      </Link>
    </div>
  );
}
