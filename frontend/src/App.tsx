import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RequireCompliance } from "@/components/RequireCompliance";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { SessionKickedModal } from "@/components/SessionKickedModal";
// Pitch es la home ("/" y "/pitch"): se carga eager para que la primera visita
// no vea un spinner. El resto de las vistas van por ruta con React.lazy.
import { Pitch } from "@/pages/Pitch";

// Solo lo ve el rol "cliente" (ver Layout) — sacarlo del bundle de entrada
// evita que agente/gestor/admin y cualquier visitante anónimo lo descarguen.
const SupportChatWidget = lazy(() =>
  import("@/components/support/SupportChatWidget").then((m) => ({ default: m.SupportChatWidget }))
);

const Landing = lazy(() => import("@/pages/Landing").then((m) => ({ default: m.Landing })));
const Login = lazy(() => import("@/pages/Login").then((m) => ({ default: m.Login })));
const ResetPassword = lazy(() => import("@/pages/ResetPassword").then((m) => ({ default: m.ResetPassword })));
const Register = lazy(() => import("@/pages/Register").then((m) => ({ default: m.Register })));
const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const NewQuery = lazy(() => import("@/pages/NewQuery").then((m) => ({ default: m.NewQuery })));
const ResultView = lazy(() => import("@/pages/ResultView").then((m) => ({ default: m.ResultView })));
const History = lazy(() => import("@/pages/History").then((m) => ({ default: m.History })));
const Locker = lazy(() => import("@/pages/Locker"));
const Documents = lazy(() => import("@/pages/Documents"));
const Tools = lazy(() => import("@/pages/Tools"));
const SupportCenter = lazy(() => import("@/pages/SupportCenter").then((m) => ({ default: m.SupportCenter })));
const Terminos = lazy(() => import("@/pages/Legal").then((m) => ({ default: m.Terminos })));
const Privacidad = lazy(() => import("@/pages/Legal").then((m) => ({ default: m.Privacidad })));
const Profile = lazy(() => import("@/pages/Profile").then((m) => ({ default: m.Profile })));
const VerifyIdentity = lazy(() => import("@/pages/VerifyIdentity").then((m) => ({ default: m.VerifyIdentity })));
const AdminPanel = lazy(() => import("@/pages/AdminPanel").then((m) => ({ default: m.AdminPanel })));
const GestorPanel = lazy(() => import("@/pages/GestorPanel").then((m) => ({ default: m.GestorPanel })));
const AgentPanel = lazy(() => import("@/pages/AgentPanel").then((m) => ({ default: m.AgentPanel })));
const AgentDocumentsPanel = lazy(() => import("@/pages/AgentDocumentsPanel").then((m) => ({ default: m.AgentDocumentsPanel })));
const AgentKycPanel = lazy(() => import("@/pages/AgentKycPanel").then((m) => ({ default: m.AgentKycPanel })));
// Reports arrastra powerbi-client + recharts: mantenerlo fuera del bundle inicial es clave.
const Reports = lazy(() => import("@/pages/Reports").then((m) => ({ default: m.Reports })));
const NotFound = lazy(() => import("@/pages/NotFound").then((m) => ({ default: m.NotFound })));

function Layout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  return (
    <div className="min-h-dvh flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <ToastContainer />
      <SessionKickedModal />
      <CookieConsentBanner />
      {/* Solo clientes: "pedir un asesor personal" y "mis consultas" son
          conceptos de esa relación cliente-asesor, no aplican a roles internos. */}
      {profile?.role === "cliente" && (
        <Suspense fallback={null}>
          <SupportChatWidget />
        </Suspense>
      )}
    </div>
  );
}

function RouteFallback() {
  return (
    <div className="min-h-dvh flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cobalt border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/pitch" element={<Pitch />} />
              <Route path="/" element={<Pitch />} />
              <Route path="/landing" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/restablecer-contrasena" element={<ResetPassword />} />
              <Route path="/registro" element={<Register />} />
              <Route path="/herramientas" element={<Tools />} />
              <Route path="/soporte" element={<SupportCenter />} />
              <Route path="/terminos" element={<Terminos />} />
              <Route path="/privacidad" element={<Privacidad />} />

              {/* Rutas privadas */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reportes"
                element={
                  <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/historial"
                element={
                  <ProtectedRoute>
                    <History />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/consulta/nueva"
                element={
                  <ProtectedRoute>
                    <NewQuery />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/consulta/:id"
                element={
                  <ProtectedRoute>
                    <ResultView />
                  </ProtectedRoute>
                }
              />
              {/* Documentos: trámites aduaneros — mismo gate de cumplimiento que el casillero */}
              <Route
                path="/documentos"
                element={
                  <ProtectedRoute>
                    <RequireCompliance>
                      <Documents />
                    </RequireCompliance>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminPanel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/gestor"
                element={
                  <ProtectedRoute allowedRoles={["gestor", "admin"]}>
                    <GestorPanel />
                  </ProtectedRoute>
                }
              />
              {/* Perfil de usuario (todos los roles autenticados) */}
              <Route
                path="/perfil"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              {/* Verificación de identidad / KYC — sin RequireCompliance: es
                  justamente donde el cliente completa los términos y el KYC */}
              <Route
                path="/verificar-identidad"
                element={
                  <ProtectedRoute>
                    <VerifyIdentity />
                  </ProtectedRoute>
                }
              />

              {/* Casillero: protegido además por RequireCompliance (Ley 1581 de 2012) */}
              <Route
                path="/casillero"
                element={
                  <ProtectedRoute>
                    <RequireCompliance>
                      <Locker />
                    </RequireCompliance>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/panel-agente"
                element={
                  <ProtectedRoute allowedRoles={["agente", "admin"]}>
                    <AgentPanel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/panel-agente/documentos"
                element={
                  <ProtectedRoute allowedRoles={["agente", "admin"]}>
                    <AgentDocumentsPanel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/panel-agente/kyc"
                element={
                  <ProtectedRoute allowedRoles={["agente", "admin"]}>
                    <AgentKycPanel />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}
