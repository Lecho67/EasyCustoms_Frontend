import { useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchVolumenMensual, type PuntoVolumenMensual } from "@/lib/reportsService";
import { fetchClienteIdsDelGestor } from "@/lib/gestorService";
import { toast } from "@/lib/toast";
import { useAsyncData } from "@/hooks/useAsyncData";

export function NativeReportsView() {
  const { profile, user } = useAuth();

  const { data: datos, loading, error } = useAsyncData(
    async () => {
      // `enabled` abajo garantiza que profile/user ya están cargados acá.
      const userIds =
        profile!.role === "admin" ? undefined : await fetchClienteIdsDelGestor(user!.id);
      return fetchVolumenMensual(userIds);
    },
    [] as PuntoVolumenMensual[],
    [profile?.role, user?.id],
    { enabled: !!profile && !!user, mensajeError: "Error al cargar el reporte" }
  );

  useEffect(() => {
    if (error) toast.error("No se pudo cargar el reporte", error);
  }, [error]);

  const exportarCsv = () => {
    if (datos.length === 0) return;
    const encabezado = "Mes,Aprobados,Retenidos\n";
    const filas = datos.map((d) => `${d.mesLabel},${d.aprobados},${d.retenidos}`).join("\n");
    const blob = new Blob([encabezado + filas], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bordercheck-volumen-envios-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado", "Se descargó el detalle de volumen mensual.");
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 border-2 border-cobalt border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) return <p className="text-sm text-red-500">{error}</p>;

  const totalAprobados = datos.reduce((acc, d) => acc + d.aprobados, 0);
  const totalRetenidos = datos.reduce((acc, d) => acc + d.retenidos, 0);
  const total = totalAprobados + totalRetenidos;
  const tasaAprobacion = total ? Math.round((totalAprobados / total) * 100) : 0;

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total envíos (6 meses)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Tasa de aprobación</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{tasaAprobacion}%</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Retenidos</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{totalRetenidos}</p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Volumen mensual: Aprobados vs. Retenidos</h2>
        <button
          onClick={exportarCsv}
          disabled={datos.length === 0}
          className="flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      <div className="h-64 rounded-xl border border-slate-200 p-3 sm:h-80 sm:p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="mesLabel" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="aprobados" name="Aprobados" fill="#059669" radius={[4, 4, 0, 0]} />
            <Bar dataKey="retenidos" name="Retenidos" fill="#d97706" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}