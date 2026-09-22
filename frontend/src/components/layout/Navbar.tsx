import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  User,
  LogOut,
  ChevronDown,
  IdCard,
  FileText,
  LifeBuoy,
  Menu,
  X,
  PlusCircle,
  History as HistoryIcon,
  Package,
  Wrench,
  Users,
  BarChart3,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { BrandLogo } from "@/components/BrandLogo";

// El admin ve los enlaces de todos los roles: inline se amontonan. Se agrupan
// en un único desplegable "Paneles" (mismo contenido que las secciones del
// drawer móvil). "Administración" queda como enlace suelto por ser su base.
const PANELES_ADMIN: { titulo: string; items: { to: string; label: string; Icon: LucideIcon }[] }[] = [
  {
    titulo: "Mi actividad",
    items: [
      { to: "/consulta/nueva", label: "Nueva consulta", Icon: PlusCircle },
      { to: "/dashboard/historial", label: "Historial", Icon: HistoryIcon },
      { to: "/casillero", label: "Casillero", Icon: Package },
    ],
  },
  {
    titulo: "Gestión",
    items: [
      { to: "/gestor", label: "Mis clientes", Icon: Users },
      { to: "/reportes", label: "Reportes", Icon: BarChart3 },
    ],
  },
  {
    titulo: "Revisión",
    items: [
      { to: "/panel-agente", label: "Cola de revisión", Icon: ClipboardList },
      { to: "/panel-agente/documentos", label: "Documentos", Icon: FileText },
      { to: "/panel-agente/kyc", label: "Verificación KYC", Icon: IdCard },
    ],
  },
];

export function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isPanelesOpen, setIsPanelesOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelesRef = useRef<HTMLDivElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(mobileDrawerRef, isMobileMenuOpen);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) setIsOpen(false);
      if (panelesRef.current && !panelesRef.current.contains(target)) setIsPanelesOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Evita el scroll del body mientras el drawer móvil está abierto
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsMobileMenuOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

  async function handleLogout() {
    setIsOpen(false);
    setIsMobileMenuOpen(false);
    await signOut();
    navigate("/");
  }

  const role = profile?.role;
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3">
        <Link to="/" aria-label="Easy CUSTOMS — inicio" className="shrink-0">
          <BrandLogo variant="full" className="hidden sm:inline-flex" />
          <BrandLogo variant="isotype" className="sm:hidden" />
        </Link>

        <div className="flex items-center gap-4 text-sm">
          {!user && (
            <Link to="/pitch" className="text-slate-500 hover:text-slate-900 transition-colors hidden lg:inline">
              Presentación
            </Link>
          )}

          {/* Cliente: solo enlaces operacionales de mayor frecuencia */}
          {user && role === "cliente" && (
            <>
              <Link to="/dashboard/historial" className="text-slate-500 hover:text-slate-900 transition-colors hidden lg:inline">
                Historial
              </Link>
              <Link to="/casillero" className="text-slate-500 hover:text-slate-900 transition-colors hidden lg:inline">
                Casillero
              </Link>
              <Link to="/consulta/nueva" className="text-slate-500 hover:text-slate-900 transition-colors hidden lg:inline">
                Nueva consulta
              </Link>
            </>
          )}

          {/* Gestor: acceso a su cartera de clientes */}
          {user && role === "gestor" && (
            <>
              <Link to="/gestor" className="text-slate-500 hover:text-slate-900 transition-colors hidden lg:inline">
                Mis clientes
              </Link>
              <Link to="/reportes" className="text-slate-500 hover:text-slate-900 transition-colors hidden lg:inline">
                Reportes
              </Link>
            </>
          )}

          {/* Agente: cola de revisión + documentos */}
          {user && role === "agente" && (
            <>
              <Link to="/panel-agente" className="text-slate-500 hover:text-slate-900 transition-colors hidden lg:inline">
                Cola de revisión
              </Link>
              <Link to="/panel-agente/documentos" className="text-slate-500 hover:text-slate-900 transition-colors hidden lg:inline">
                Documentos
              </Link>
              <Link to="/panel-agente/kyc" className="text-slate-500 hover:text-slate-900 transition-colors hidden lg:inline">
                Verificación KYC
              </Link>
            </>
          )}

          {/* Admin: ve los paneles de todos los roles → agrupados en un desplegable */}
          {user && role === "admin" && (
            <>
              <Link
                to="/admin"
                className="text-slate-500 hover:text-slate-900 transition-colors hidden lg:inline font-medium"
              >
                Administración
              </Link>
              <div className="relative hidden lg:block" ref={panelesRef}>
                <button
                  onClick={() => {
                    setIsPanelesOpen((prev) => !prev);
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors"
                >
                  Paneles
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${isPanelesOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isPanelesOpen && (
                  <div className="absolute left-0 mt-2 w-60 shadow rounded-xl bg-white border border-slate-100 py-2 text-sm z-20">
                    {PANELES_ADMIN.map((grupo, i) => (
                      <div key={grupo.titulo}>
                        {i > 0 && <div className="my-2 border-t border-slate-100" />}
                        <div className="px-3 pb-1 pt-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                          {grupo.titulo}
                        </div>
                        {grupo.items.map(({ to, label, Icon }) => (
                          <Link
                            key={to}
                            to={to}
                            onClick={() => setIsPanelesOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                          >
                            <Icon className="w-4 h-4" />
                            {label}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <Link to="/herramientas" className="text-slate-500 hover:text-slate-900 transition-colors hidden lg:inline">
            Herramientas
          </Link>

          {user && <NotificationBell />}

          {/* Perfil (dropdown) - solo escritorio/tablet, en mobile vive dentro del drawer */}
          {user ? (
            <div className="relative hidden lg:block" ref={menuRef}>
              <button
                onClick={() => {
                  setIsOpen((prev) => !prev);
                  setIsPanelesOpen(false);
                }}
                className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors font-medium"
              >
                <User className="w-4 h-4 shrink-0" />
                <span className="max-w-[16ch] truncate xl:max-w-[24ch]">
                  Mi Perfil{profile?.full_name ? ` · ${profile.full_name}` : role ? ` · ${role}` : ""}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="absolute right-0 mt-2 w-64 shadow rounded-xl bg-white border border-slate-100 py-2 text-sm z-20">
                  <div className="px-3 pb-1 pt-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Mi cuenta
                  </div>
                  <Link
                    to="/perfil"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Mi Perfil
                  </Link>
                  <Link
                    to="/verificar-identidad"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <IdCard className="w-4 h-4" />
                    Verificar Identidad
                  </Link>
                  <Link
                    to="/documentos"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Mis Documentos
                  </Link>

                  <div className="my-2 border-t border-slate-100" />

                  <div className="px-3 pb-1 pt-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Ayuda &amp; soporte
                  </div>
                  <Link
                    to="/soporte"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <LifeBuoy className="w-4 h-4" />
                    Centro de Soporte
                  </Link>

                  <div className="my-2 border-t border-slate-100" />

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-red-600 hover:bg-red-50 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="bg-cobalt hover:bg-cobalt/90 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm hidden lg:inline-block"
            >
              Iniciar sesión
            </Link>
          )}

          {/* Botón hamburguesa - solo mobile */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Abrir menú"
            className="-mr-2.5 block p-2.5 text-slate-600 transition-colors hover:text-slate-900 lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* --- Drawer móvil --- */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${isMobileMenuOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!isMobileMenuOpen}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-200 ${
            isMobileMenuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeMobileMenu}
        />

        {/* Panel */}
        <div
          ref={mobileDrawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
          className={`absolute right-0 top-0 h-full w-[85%] max-w-sm bg-white border-l border-slate-200 flex flex-col pr-[env(safe-area-inset-right)] transition-transform duration-200 ease-out ${
            isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <span className="font-semibold text-slate-900">Menú</span>
            <button
              onClick={closeMobileMenu}
              aria-label="Cerrar menú"
              className="-m-2 p-2 text-slate-500 hover:text-slate-900"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-sm">
            {!user && (
              <div className="flex flex-col gap-2">
                <Link
                  to="/login"
                  onClick={closeMobileMenu}
                  className="text-center bg-cobalt hover:bg-cobalt/90 text-white font-medium px-4 py-3 rounded-xl transition-colors"
                >
                  Iniciar sesión
                </Link>
                <Link
                  to="/pitch"
                  onClick={closeMobileMenu}
                  className="text-center text-slate-600 px-4 py-3 rounded-xl hover:bg-slate-50"
                >
                  Presentación
                </Link>
              </div>
            )}

            {user && (
              <>
                {(role === "cliente" || role === "admin") && (
                  <div className="mb-4">
                    <p className="px-2 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Mi actividad
                    </p>
                    <Link
                      to="/consulta/nueva"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 px-2 py-3 rounded-lg text-slate-700 hover:bg-slate-50"
                    >
                      <PlusCircle className="w-4 h-4 text-slate-400" />
                      Nueva consulta
                    </Link>
                    <Link
                      to="/dashboard/historial"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 px-2 py-3 rounded-lg text-slate-700 hover:bg-slate-50"
                    >
                      <HistoryIcon className="w-4 h-4 text-slate-400" />
                      Historial
                    </Link>
                    <Link
                      to="/casillero"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 px-2 py-3 rounded-lg text-slate-700 hover:bg-slate-50"
                    >
                      <Package className="w-4 h-4 text-slate-400" />
                      Casillero
                    </Link>
                  </div>
                )}

                {(role === "gestor" || role === "admin") && (
                  <div className="mb-4">
                    <p className="px-2 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Gestión
                    </p>
                    <Link
                      to="/gestor"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 px-2 py-3 rounded-lg text-slate-700 hover:bg-slate-50"
                    >
                      <Users className="w-4 h-4 text-slate-400" />
                      Mis clientes
                    </Link>
                    <Link
                      to="/reportes"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 px-2 py-3 rounded-lg text-slate-700 hover:bg-slate-50"
                    >
                      <BarChart3 className="w-4 h-4 text-slate-400" />
                      Reportes
                    </Link>
                  </div>
                )}

                {(role === "agente" || role === "admin") && (
                  <div className="mb-4">
                    <p className="px-2 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Panel de agente
                    </p>
                    <Link
                      to="/panel-agente"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 px-2 py-3 rounded-lg text-slate-700 hover:bg-slate-50"
                    >
                      <ClipboardList className="w-4 h-4 text-slate-400" />
                      Cola de revisión
                    </Link>
                    <Link
                      to="/panel-agente/documentos"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 px-2 py-3 rounded-lg text-slate-700 hover:bg-slate-50"
                    >
                      <FileText className="w-4 h-4 text-slate-400" />
                      Documentos
                    </Link>
                    <Link
                      to="/panel-agente/kyc"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 px-2 py-3 rounded-lg text-slate-700 hover:bg-slate-50"
                    >
                      <IdCard className="w-4 h-4 text-slate-400" />
                      Verificación KYC
                    </Link>
                  </div>
                )}

                {role === "admin" && (
                  <div className="mb-4">
                    <Link
                      to="/admin"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 px-2 py-3 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                    >
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                      Administración
                    </Link>
                  </div>
                )}

                <div className="mb-4 border-t border-slate-100 pt-3">
                  <Link
                    to="/herramientas"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-2 py-3 rounded-lg text-slate-700 hover:bg-slate-50"
                  >
                    <Wrench className="w-4 h-4 text-slate-400" />
                    Herramientas
                  </Link>
                </div>

                <div className="mb-4 border-t border-slate-100 pt-3">
                  <p className="px-2 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Mi cuenta
                  </p>
                  <Link
                    to="/perfil"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-2 py-3 rounded-lg text-slate-700 hover:bg-slate-50"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    Mi Perfil{profile?.full_name ? ` · ${profile.full_name}` : ""}
                  </Link>
                  <Link
                    to="/verificar-identidad"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-2 py-3 rounded-lg text-slate-700 hover:bg-slate-50"
                  >
                    <IdCard className="w-4 h-4 text-slate-400" />
                    Verificar Identidad
                  </Link>
                  <Link
                    to="/documentos"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-2 py-3 rounded-lg text-slate-700 hover:bg-slate-50"
                  >
                    <FileText className="w-4 h-4 text-slate-400" />
                    Mis Documentos
                  </Link>
                </div>

                <div className="mb-4 border-t border-slate-100 pt-3">
                  <p className="px-2 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Ayuda &amp; soporte
                  </p>
                  <Link
                    to="/soporte"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-2 py-3 rounded-lg text-slate-700 hover:bg-slate-50"
                  >
                    <LifeBuoy className="w-4 h-4 text-slate-400" />
                    Centro de Soporte
                  </Link>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-2 py-3 rounded-lg text-red-600 hover:bg-red-50 text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}