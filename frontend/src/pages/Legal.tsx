import { CONTENIDO_LEGAL, type TipoLegal } from "@/lib/legalContent";

function LegalPage({ tipo }: { tipo: TipoLegal }) {
  const contenido = CONTENIDO_LEGAL[tipo];
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-2xl font-bold text-cobalt mb-6">{contenido.titulo}</h1>
      <div className="space-y-4 text-sm leading-relaxed text-slate-600">
        {contenido.cuerpo.map((parrafo, i) => (
          <p key={i}>{parrafo}</p>
        ))}
      </div>
    </div>
  );
}

export function Terminos() {
  return <LegalPage tipo="terminos" />;
}

export function Privacidad() {
  return <LegalPage tipo="habeas_data" />;
}
