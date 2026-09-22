import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export function NotFound() {
  return (
    <div className="max-w-md mx-auto mt-16 sm:mt-24 px-4 sm:px-6 lg:px-8 py-6 text-center">
      <Compass className="mx-auto mb-4 h-10 w-10 text-slate-400" />
      <h1 className="text-lg font-semibold text-cobalt mb-2">Página no encontrada</h1>
      <p className="text-sm text-slate-500 mb-6">
        La dirección que abriste no existe o cambió de lugar.
      </p>
      <Link
        to="/"
        className="inline-block rounded-xl bg-cobalt px-5 py-2.5 text-sm font-medium text-white hover:bg-cobalt/90"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
