import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Maximize2, Minimize2, AlertTriangle } from "lucide-react";
import * as pbi from "powerbi-client";

type Modo = "url" | "token";

// Solo se permite incrustar reportes servidos por dominios oficiales de
// Power BI — evita que un usuario incruste cualquier iframe arbitrario.
const HOSTS_PERMITIDOS = ["app.powerbi.com", "app.powerbigov.us"];

function urlEsSegura(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && HOSTS_PERMITIDOS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

export function PowerBiEmbed() {
  const [modo, setModo] = useState<Modo>("url");

  // --- Modo A: URL pública/segura de Power BI (iframe) ---
  const [urlInput, setUrlInput] = useState("");
  const [urlActiva, setUrlActiva] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [cargandoIframe, setCargandoIframe] = useState(false);

  // --- Modo B: Power BI Embedded con token (requiere que el equipo de BI
  // genere embedUrl + reportId + accessToken desde su backend/Azure AD;
  // este componente solo consume esos valores, no los genera) ---
  const [embedUrl, setEmbedUrl] = useState("");
  const [reportId, setReportId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const serviceRef = useRef<pbi.service.Service | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);

  useEffect(() => {
    const onChange = () => setPantallaCompleta(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const handleCargarUrl = (e: FormEvent) => {
    e.preventDefault();
    if (!urlEsSegura(urlInput)) {
      setUrlError("La URL debe ser https:// y pertenecer a app.powerbi.com (o powerbigov.us).");
      return;
    }
    setUrlError(null);
    setCargandoIframe(true);
    setUrlActiva(urlInput);
  };

  const handleCargarToken = (e: FormEvent) => {
    e.preventDefault();
    if (!embedUrl || !reportId || !accessToken) {
      setTokenError("Completá Embed URL, Report ID y Access Token.");
      return;
    }
    setTokenError(null);

    if (!contenedorRef.current) return;
    if (!serviceRef.current) {
      serviceRef.current = new pbi.service.Service(
        pbi.factories.hpmFactory,
        pbi.factories.wpmpFactory,
        pbi.factories.routerFactory
      );
    }

    const config: pbi.IEmbedConfiguration = {
      type: "report",
      id: reportId,
      embedUrl,
      accessToken,
      tokenType: pbi.models.TokenType.Embed,
      settings: { panes: { filters: { visible: false } } },
    };

    try {
      serviceRef.current.reset(contenedorRef.current);
      serviceRef.current.embed(contenedorRef.current, config);
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : "No se pudo incrustar el reporte.");
    }
  };

  const toggleFullscreen = async () => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) {
      await wrapperRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setModo("url")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            modo === "url" ? "bg-cobalt text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          URL de reporte
        </button>
        <button
          onClick={() => setModo("token")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            modo === "token" ? "bg-cobalt text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Power BI Embedded (token)
        </button>
      </div>

      {modo === "url" ? (
        <form onSubmit={handleCargarUrl} className="mb-4 flex flex-wrap gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://app.powerbi.com/view?r=..."
            className="w-full min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-base sm:min-w-[16rem] sm:text-sm focus:outline-none focus:ring-2 focus:ring-cobalt focus:border-transparent"
          />
          <button
            type="submit"
            className="rounded-xl bg-cobalt px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cobalt-600"
          >
            Cargar reporte
          </button>
        </form>
      ) : (
        <form onSubmit={handleCargarToken} className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            type="text"
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
            placeholder="Embed URL"
            className="rounded-xl border border-slate-300 px-3 py-2 text-base sm:text-sm"
          />
          <input
            type="text"
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
            placeholder="Report ID"
            className="rounded-xl border border-slate-300 px-3 py-2 text-base sm:text-sm"
          />
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Access Token"
            className="rounded-xl border border-slate-300 px-3 py-2 text-base sm:text-sm"
          />
          <button
            type="submit"
            className="rounded-xl bg-cobalt px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cobalt-600 sm:col-span-3"
          >
            Incrustar reporte
          </button>
        </form>
      )}

      {(urlError || tokenError) && (
        <p className="mb-3 flex items-center gap-1.5 text-sm text-red-500">
          <AlertTriangle className="h-4 w-4" /> {urlError || tokenError}
        </p>
      )}

      <div
        ref={wrapperRef}
        className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${
          pantallaCompleta ? "h-dvh" : "h-[60svh] sm:h-[32rem]"
        }`}
      >
        <button
          onClick={toggleFullscreen}
          className="absolute right-3 top-3 z-10 rounded-lg bg-white/90 p-2 text-slate-600 shadow hover:bg-white"
          aria-label={pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}
        >
          {pantallaCompleta ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>

        {modo === "url" ? (
          urlActiva ? (
            <>
              {cargandoIframe && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                  <Loader2 className="h-6 w-6 animate-spin text-cobalt" />
                </div>
              )}
              <iframe
                title="Power BI Dashboard"
                src={urlActiva}
                className="h-full w-full border-0"
                onLoad={() => setCargandoIframe(false)}
                allowFullScreen
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400">
              Pegá la URL de tu reporte de Power BI (Publicar en la Web o Embed seguro) para
              visualizarlo acá.
            </div>
          )
        ) : (
          <div ref={contenedorRef} className="h-full w-full" />
        )}
      </div>
    </div>
  );
}