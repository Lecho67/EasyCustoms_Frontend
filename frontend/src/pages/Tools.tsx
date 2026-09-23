import { useState } from 'react';
import { TrackingWidget } from "@/components/pitch/TrackingWidget";
import { ShippingCalculator } from "@/components/pitch/ShippingCalculator";

type Tab = 'tracking' | 'calculator';

export default function Tools() {
  const [activeTab, setActiveTab] = useState<Tab>('tracking');

  return (
    <div className="min-h-dvh bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Encabezado */}
        <div className="mb-8 text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold text-cobalt">Herramientas Interactivas</h1>
          <p className="text-slate-600 mt-2 max-w-2xl">
            Rastrea tus paquetes y calcula tus impuestos aduaneros con la asistencia de la IA de Easy CUSTOMS.
          </p>
        </div>

        {/* Tabs - móvil apiladas, desktop en fila */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-6 bg-white p-2 rounded-xl shadow-sm border border-slate-200 w-full sm:w-fit">
          <button
            onClick={() => setActiveTab('tracking')}
            className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'tracking'
                ? 'bg-cobalt text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Rastreador Inteligente
          </button>
          <button
            onClick={() => setActiveTab('calculator')}
            className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'calculator'
                ? 'bg-cobalt text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Calculadora de Envíos e Impuestos
          </button>
        </div>

        {/* Contenido */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 lg:p-8">
          {activeTab === 'tracking' && (
            <div>
              <div className="flex items-start gap-3 mb-6 p-4 rounded-xl bg-cian/5 border border-cian/20">
                <svg className="w-5 h-5 text-cian shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-cobalt">Cómo ayuda la IA:</span> nuestro modelo cruza el estado
                  de tu paquete con patrones históricos de aduana para anticipar retrasos y notificarte antes de que ocurran.
                </p>
              </div>
              <TrackingWidget />
            </div>
          )}

          {activeTab === 'calculator' && (
            <div>
              <div className="flex items-start gap-3 mb-6 p-4 rounded-xl bg-cian/5 border border-cian/20">
                <svg className="w-5 h-5 text-cian shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-cobalt">Cómo ayuda la IA:</span> clasificamos automáticamente tu
                  producto por categoría arancelaria para estimar impuestos con mayor precisión que un cálculo manual.
                </p>
              </div>
              <ShippingCalculator />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}