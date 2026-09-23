import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { fetchTodosLosUsuarios, actualizarRol, asignarGestor } from "@/lib/adminService";
import type { Profile, UserRole } from "@/types/database.types";
import { toast } from "@/lib/toast";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { useAsyncData } from "@/hooks/useAsyncData";

const ROLES: UserRole[] = ["cliente", "gestor", "agente", "admin"];

// text-base en mobile: con menos de 16px iOS hace zoom al abrir el select.
const selectClass =
  "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-cobalt disabled:opacity-50";

interface SelectRolProps {
  id?: string;
  value: Profile["role"];
  disabled: boolean;
  onChange: (rol: Profile["role"]) => void;
  className?: string;
}

function SelectRol({ id, value, disabled, onChange, className = "" }: SelectRolProps) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as Profile["role"])}
      className={`${selectClass} ${className}`}
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}

interface SelectGestorProps {
  id?: string;
  value: string;
  disabled: boolean;
  gestores: Profile[];
  onChange: (gestorId: string) => void;
  className?: string;
}

function SelectGestor({ id, value, disabled, gestores, onChange, className = "" }: SelectGestorProps) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`${selectClass} ${className}`}
    >
      <option value="">Sin asignar</option>
      {gestores.map((g) => (
        <option key={g.id} value={g.id}>
          {g.full_name || g.email}
        </option>
      ))}
    </select>
  );
}

type AccionPendiente =
  | { tipo: "rol"; userId: string; nombre: string; rolAnterior: Profile["role"]; rolNuevo: Profile["role"] }
  | {
      tipo: "gestor";
      userId: string;
      nombre: string;
      gestorAnteriorNombre: string;
      gestorNuevoId: string;
      gestorNuevoNombre: string;
    };

export function AdminUserTable() {
  const {
    data: usuarios,
    loading,
    error,
    setData: setUsuarios,
    setError,
  } = useAsyncData(fetchTodosLosUsuarios, [] as Profile[], [], {
    mensajeError: "Error al cargar usuarios",
  });
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [accionPendiente, setAccionPendiente] = useState<AccionPendiente | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const gestores = usuarios.filter((u) => u.role === "gestor");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [usuarios, busqueda]);

  const { page, setPage, pageCount, pageItems } = usePagination(filtrados);

  // --- Paso 1: el usuario elige un cambio en el <select>, no se aplica todavía ---

  const solicitarCambioRol = (u: Profile, nuevoRol: Profile["role"]) => {
    if (nuevoRol === u.role) return;
    setAccionPendiente({
      tipo: "rol",
      userId: u.id,
      nombre: u.full_name || u.email,
      rolAnterior: u.role,
      rolNuevo: nuevoRol,
    });
  };

  const solicitarCambioGestor = (u: Profile, nuevoGestorId: string) => {
    if ((u.gestor_id ?? "") === nuevoGestorId) return;
    const gestorAnterior = gestores.find((g) => g.id === u.gestor_id);
    const gestorNuevo = gestores.find((g) => g.id === nuevoGestorId);
    setAccionPendiente({
      tipo: "gestor",
      userId: u.id,
      nombre: u.full_name || u.email,
      gestorAnteriorNombre: gestorAnterior ? gestorAnterior.full_name || gestorAnterior.email : "Sin asignar",
      gestorNuevoId: nuevoGestorId,
      gestorNuevoNombre: gestorNuevo ? gestorNuevo.full_name || gestorNuevo.email : "Sin asignar",
    });
  };

  // --- Paso 2: solo al confirmar en el modal se aplica el cambio real ---

  const confirmarAccion = async () => {
    if (!accionPendiente) return;
    setGuardandoId(accionPendiente.userId);
    setError(null);
    try {
      if (accionPendiente.tipo === "rol") {
        await actualizarRol(accionPendiente.userId, accionPendiente.rolNuevo);
        setUsuarios((prev) =>
          prev.map((u) => (u.id === accionPendiente.userId ? { ...u, role: accionPendiente.rolNuevo } : u)),
        );
        toast.success(
          "Rol actualizado",
          `${accionPendiente.nombre} ahora tiene el rol ${accionPendiente.rolNuevo}.`
        );
      } else {
        const valor = accionPendiente.gestorNuevoId === "" ? null : accionPendiente.gestorNuevoId;
        await asignarGestor(accionPendiente.userId, valor);
        setUsuarios((prev) =>
          prev.map((u) => (u.id === accionPendiente.userId ? { ...u, gestor_id: valor } : u)),
        );
        toast.success(
          "Gestor asignado",
          `${accionPendiente.nombre} ahora tiene como gestor a ${accionPendiente.gestorNuevoNombre}.`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al aplicar el cambio";
      setError(msg);
      toast.error("No se pudo aplicar el cambio", msg);
    } finally {
      setGuardandoId(null);
      setAccionPendiente(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-400">Cargando usuarios...</p>;
  }

  return (
    <div>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {usuarios.length > 8 && (
        <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <label htmlFor="admin-busqueda" className="mb-1 block text-xs font-medium text-slate-600">
              Buscar usuario
            </label>
            <input
              id="admin-busqueda"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o correo"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:w-auto sm:text-sm"
            />
          </div>
          {busqueda && (
            <button onClick={() => setBusqueda("")} className="text-sm text-cobalt hover:underline">
              Limpiar
            </button>
          )}
        </div>
      )}

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Ningún usuario coincide con la búsqueda.
        </div>
      ) : (
        <>
          {/* Mobile: tarjetas. Los dos <select> no entran en una fila a 360px. */}
          <ul className="space-y-3 md:hidden">
            {pageItems.map((u) => (
              <li key={u.id} className="rounded-xl border border-slate-200 p-4">
                <p className="break-words font-medium text-slate-800">{u.full_name || "(sin nombre)"}</p>
                <p className="break-words text-xs text-slate-500">{u.email}</p>

                <div className="mt-3 space-y-3">
                  <div>
                    <label htmlFor={`rol-${u.id}`} className="mb-1 block text-xs font-medium text-slate-600">
                      Rol
                    </label>
                    <SelectRol
                      id={`rol-${u.id}`}
                      value={u.role}
                      disabled={guardandoId === u.id}
                      onChange={(rol) => solicitarCambioRol(u, rol)}
                      className="w-full"
                    />
                  </div>

                  {u.role === "cliente" && (
                    <div>
                      <label htmlFor={`gestor-${u.id}`} className="mb-1 block text-xs font-medium text-slate-600">
                        Gestor asignado
                      </label>
                      <SelectGestor
                        id={`gestor-${u.id}`}
                        value={u.gestor_id ?? ""}
                        disabled={guardandoId === u.id}
                        gestores={gestores}
                        onChange={(gestorId) => solicitarCambioGestor(u, gestorId)}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Gestor asignado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{u.full_name || "(sin nombre)"}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <SelectRol
                        value={u.role}
                        disabled={guardandoId === u.id}
                        onChange={(rol) => solicitarCambioRol(u, rol)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {u.role === "cliente" ? (
                        <SelectGestor
                          value={u.gestor_id ?? ""}
                          disabled={guardandoId === u.id}
                          gestores={gestores}
                          onChange={(gestorId) => solicitarCambioGestor(u, gestorId)}
                        />
                      ) : (
                        <span className="text-xs text-slate-400">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </>
      )}

      {/* Modal de confirmación */}
      {accionPendiente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Confirmar cambio</h2>

            {accionPendiente.tipo === "rol" ? (
              <p className="mb-5 text-sm text-slate-600">
                Vas a cambiar el rol de <span className="font-medium text-slate-900">{accionPendiente.nombre}</span>{" "}
                de <span className="font-medium text-slate-900">{accionPendiente.rolAnterior}</span> a{" "}
                <span className="font-medium text-slate-900">{accionPendiente.rolNuevo}</span>.
                {accionPendiente.rolNuevo === "admin" && (
                  <span className="mt-2 flex items-start gap-1.5 text-orange-600">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    Le darás control total del sistema (usuarios, roles, todos los datos).
                  </span>
                )}
              </p>
            ) : (
              <p className="mb-5 text-sm text-slate-600">
                Vas a cambiar el gestor de <span className="font-medium text-slate-900">{accionPendiente.nombre}</span>{" "}
                de <span className="font-medium text-slate-900">{accionPendiente.gestorAnteriorNombre}</span> a{" "}
                <span className="font-medium text-slate-900">{accionPendiente.gestorNuevoNombre}</span>.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAccionPendiente(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAccion}
                disabled={guardandoId !== null}
                className="rounded-lg bg-cobalt px-4 py-1.5 text-sm font-medium text-white hover:bg-cobalt/90 disabled:opacity-50"
              >
                {guardandoId ? "Aplicando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}