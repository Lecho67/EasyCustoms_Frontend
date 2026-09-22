import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export function Landing() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
      <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-cobalt mb-6">
        Sabe si tu envío pasará la aduana, antes de despacharlo.
      </h1>
      <p className="text-lg text-slate-600 mb-10">
        Easy CUSTOMS analiza tu envío internacional y te dice en segundos si puede transportarse por vía aérea.
      </p>
      <Link to="/consulta/nueva">
        <Button className="px-8 py-4 text-base">Verificar mi envío ahora</Button>
      </Link>
      <p className="text-xs text-slate-400 mt-4">Sin registro. Resultado en menos de 1 minuto.</p>
    </main>
  );
}
