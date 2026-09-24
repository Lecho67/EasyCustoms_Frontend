import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types/database.types";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

const RUTA_POR_DEFECTO: Record<UserRole, string> = {
  cliente: "/dashboard",
  gestor: "/gestor",
  agente: "/panel-agente",
  admin: "/admin",
};

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading, profileError, refreshProfile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cobalt border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Sesión válida pero el perfil no cargó (típicamente red): no expulsar, ofrecer reintento.
  if (!profile && profileError) {
    return (
      <div className="max-w-md mx-auto mt-24 p-6 text-center">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">
          No pudimos cargar tu perfil
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Tu sesión sigue activa. Revisa tu conexión y vuelve a intentarlo.
        </p>
        <button
          onClick={() => refreshProfile()}
          className="inline-block rounded-xl bg-cobalt px-5 py-2.5 text-sm font-medium text-white hover:bg-cobalt/90"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (allowedRoles) {
    // El perfil todavía está en vuelo (sin error): esperar, no redirigir.
    // `AuthContext` puede dejar `loading` en false un instante antes de que
    // `profile` se asiente — descarta un fetchProfile obsoleto pero su
    // `.finally(setLoading(false))` igual corre. Sin esta guarda, ese hueco
    // dispara un `<Navigate>` irreversible a la home equivocada (visto en E2E:
    // un admin entrando a `/panel-agente` terminaba atrapado en `/dashboard`).
    if (!profile) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-cobalt border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (!allowedRoles.includes(profile.role)) {
      return <Navigate to={RUTA_POR_DEFECTO[profile.role]} replace />;
    }
  }

  return <>{children}</>;
}