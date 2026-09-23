import { useCallback, useEffect, useRef, useState } from "react";

interface UseAsyncDataOptions {
  /** Si es false, no dispara el fetch — para cuando falta un dato que el
   * fetcher necesita (p. ej. un id que todavía no cargó del perfil). */
  enabled?: boolean;
  /** Mensaje de error cuando lo que se lanzó no es una instancia de Error. */
  mensajeError?: string;
}

interface UseAsyncDataResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  /** Vuelve a pedir los datos. `silencioso: true` no togglea `loading` —
   * para refrescos en segundo plano (polling, foco de la pestaña) que no
   * deberían tapar la lista con un spinner. */
  reload: (opts?: { silencioso?: boolean }) => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T>>;
  /** Para reusar el mismo slot de error en otras acciones de la página
   * (subir, eliminar, etc.) que no pasan por `fetcher`. */
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * Reemplaza el patrón `data/loading/error` + función `cargar()` a mano que
 * se repetía en ~12 páginas (Documents, Locker, AgentPanel, GestorPanel,
 * AgentKycPanel, AgentDocumentsPanel, Dashboard, History, AdminUserTable,
 * AdvisorRequestsPanel, MetricsOverview, NativeReportsView).
 *
 * De paso corrige una condición de carrera que solo algunos de esos
 * archivos tenían resuelta a mano (con su propio flag `cancelado`): si dos
 * fetches están en vuelo (por ejemplo un refresco por foco mientras el
 * inicial todavía no volvió) y el más viejo resuelve después del más nuevo,
 * antes pisaba el estado con datos obsoletos. Acá un contador de
 * request-id descarta cualquier respuesta que no sea la última pedida.
 *
 * `deps` funciona como en `useEffect`: cuando cambia, se vuelve a pedir.
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  initialValue: T,
  deps: React.DependencyList,
  options: UseAsyncDataOptions = {}
): UseAsyncDataResult<T> {
  const { enabled = true, mensajeError = "Ocurrió un error al cargar los datos." } = options;

  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  // El fetcher casi siempre es un closure inline nuevo en cada render (p.
  // ej. `() => fetchClientesDelGestor(gestorId)`) — se guarda en un ref
  // para no exigirle `useCallback` a quien llama; quién dispara el refetch
  // lo decide `deps`, no la identidad de `fetcher`.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const requestIdRef = useRef(0);

  const reload = useCallback(
    async (opts?: { silencioso?: boolean }) => {
      const reqId = ++requestIdRef.current;
      if (!opts?.silencioso) setLoading(true);
      try {
        const result = await fetcherRef.current();
        if (reqId !== requestIdRef.current) return; // respuesta obsoleta
        setData(result);
        setError(null);
      } catch (err) {
        if (reqId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : mensajeError);
      } finally {
        if (reqId === requestIdRef.current && !opts?.silencioso) setLoading(false);
      }
    },
    [mensajeError]
  );

  useEffect(() => {
    if (!enabled) return;
    reload();
    // `deps` la define quien llama, como en un useEffect normal — es la
    // lista exhaustiva a propósito, eslint no puede verificar el spread.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reload, ...deps]);

  return { data, loading, error, reload, setData, setError };
}
