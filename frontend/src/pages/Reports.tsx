import { lazy, Suspense, useState } from "react";

// Cada pestaña arrastra su propia librería pesada (recharts / powerbi-client)
// y solo una está visible a la vez — separarlas en chunks propios evita
// pagar el costo de las dos con solo entrar a /reportes.
const NativeReportsView = lazy(() =>
  import("@/components/reports/NativeReportsView").then((m) => ({ default: m.NativeReportsView }))
);
const PowerBiEmbed = lazy(() =>
  import("@/components/reports/PowerBiEmbed").then((m) => ({ default: m.PowerBiEmbed }))
);

type Tab = "nativa" | "powerbi";

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cobalt border-t-transparent" />
    </div>
  );
}

export function Reports() {
  const [tab, setTab] = useState<Tab>("nativa");

  return (
    <div className="max-w-5xl mx-auto mt-10 sm:mt-16 px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-cobalt mb-2">Reportes</h1>
      <p className="text-slate-600 mb-6">
        Analítica de tus importaciones: volumen, tasa de aprobación e incidencias.
      </p>

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab("nativa")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "nativa"
              ? "border-cobalt text-cobalt"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Vista Nativa (Gráficas)
        </button>
        <button
          onClick={() => setTab("powerbi")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "powerbi"
              ? "border-cobalt text-cobalt"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Power BI Dashboard
        </button>
      </div>

      <Suspense fallback={<TabFallback />}>
        {tab === "nativa" ? <NativeReportsView /> : <PowerBiEmbed />}
      </Suspense>
    </div>
  );
}