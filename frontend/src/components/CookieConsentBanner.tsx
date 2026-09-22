import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

const CONSENT_KEY = "easy-customs-cookie-consent";
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

/**
 * Carga Google Analytics solo si hay consentimiento Y está configurado
 * VITE_GA_MEASUREMENT_ID. Sin esa variable, el banner igual se muestra
 * (para poder pedir consentimiento) pero no inyecta ningún script — así
 * queda listo para activarse el día que exista el ID, sin tocar código.
 */
function cargarGoogleAnalytics() {
  if (!GA_MEASUREMENT_ID || document.getElementById("ga4-script")) return;

  const script = document.createElement("script");
  script.id = "ga4-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  const inline = document.createElement("script");
  inline.id = "ga4-inline";
  inline.textContent = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_MEASUREMENT_ID}', { anonymize_ip: true });
  `;
  document.head.appendChild(inline);
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consentimiento = localStorage.getItem(CONSENT_KEY);
    if (consentimiento === "aceptado") {
      cargarGoogleAnalytics();
    } else if (!consentimiento) {
      setVisible(true);
    }
  }, []);

  const aceptar = () => {
    localStorage.setItem(CONSENT_KEY, "aceptado");
    cargarGoogleAnalytics();
    setVisible(false);
  };

  const rechazar = () => {
    localStorage.setItem(CONSENT_KEY, "rechazado");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-sm text-slate-600">
          Usamos cookies y almacenamiento local para mantener tu sesión y, si aceptás, para medir el uso del
          sitio. Podés leer más en nuestra{" "}
          <Link to="/privacidad" className="font-medium text-cobalt underline underline-offset-2">
            Política de Privacidad
          </Link>
          .
        </p>
        <div className="flex w-full shrink-0 gap-2 sm:w-auto">
          <Button variant="secondary" onClick={rechazar} className="flex-1 px-4 py-2 text-sm sm:flex-none">
            Rechazar
          </Button>
          <Button onClick={aceptar} className="flex-1 px-4 py-2 text-sm sm:flex-none">
            Aceptar
          </Button>
        </div>
      </div>
    </div>
  );
}
