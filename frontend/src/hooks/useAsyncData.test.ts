import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAsyncData } from "./useAsyncData";

describe("useAsyncData", () => {
  it("carga al montar y expone los datos", async () => {
    const fetcher = vi.fn().mockResolvedValue(["a", "b"]);
    const { result } = renderHook(() => useAsyncData(fetcher, [] as string[], []));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(["a", "b"]);
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("guarda el mensaje de Error tal cual, o el mensajeError por defecto si no es un Error", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("caído"));
    const { result } = renderHook(() => useAsyncData(fetcher, [] as string[], []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("caído");

    const fetcherNoError = vi.fn().mockRejectedValue("boom");
    const { result: r2 } = renderHook(() =>
      useAsyncData(fetcherNoError, [] as string[], [], { mensajeError: "Error al cargar X" })
    );
    await waitFor(() => expect(r2.current.loading).toBe(false));
    expect(r2.current.error).toBe("Error al cargar X");
  });

  it("enabled=false no dispara el fetch ni deja loading en true", () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useAsyncData(fetcher, [] as string[], [], { enabled: false }));

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("reload({ silencioso: true }) no togglea loading", async () => {
    const fetcher = vi.fn().mockResolvedValue(["x"]);
    const { result } = renderHook(() => useAsyncData(fetcher, [] as string[], []));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let resolver: (v: string[]) => void = () => {};
    fetcher.mockReturnValue(new Promise((r) => { resolver = r; }));

    act(() => {
      result.current.reload({ silencioso: true });
    });
    expect(result.current.loading).toBe(false);

    await act(async () => {
      resolver(["y"]);
    });
    expect(result.current.data).toEqual(["y"]);
  });

  it("descarta una respuesta vieja que resuelve después de una más nueva (fuera de orden)", async () => {
    let resolverLenta: (v: string[]) => void = () => {};
    let resolverRapida: (v: string[]) => void = () => {};
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => { resolverLenta = r; }))
      .mockImplementationOnce(() => new Promise((r) => { resolverRapida = r; }));

    const { result } = renderHook(() => useAsyncData(fetcher, [] as string[], []));
    // Dispara un segundo fetch (p. ej. un refresco) antes de que el primero resuelva.
    act(() => {
      result.current.reload();
    });

    // La respuesta rápida (segunda pedida) llega primero...
    await act(async () => {
      resolverRapida(["nuevo"]);
    });
    expect(result.current.data).toEqual(["nuevo"]);

    // ...y la lenta (primera pedida) llega después: no debe pisar el dato ya vigente.
    await act(async () => {
      resolverLenta(["viejo"]);
    });
    expect(result.current.data).toEqual(["nuevo"]);
  });

  it("refetchea cuando cambia una dependencia", async () => {
    const fetcher = vi.fn().mockImplementation((id: string) => Promise.resolve([id]));
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useAsyncData(() => fetcher(id), [] as string[], [id]),
      { initialProps: { id: "a" } }
    );

    await waitFor(() => expect(result.current.data).toEqual(["a"]));

    rerender({ id: "b" });

    await waitFor(() => expect(result.current.data).toEqual(["b"]));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("setData permite actualizar el estado local sin pasar por el fetcher (p. ej. tras un eliminar optimista)", async () => {
    const fetcher = vi.fn().mockResolvedValue(["a", "b"]);
    const { result } = renderHook(() => useAsyncData(fetcher, [] as string[], []));
    await waitFor(() => expect(result.current.data).toEqual(["a", "b"]));

    act(() => {
      result.current.setData((prev) => prev.filter((x) => x !== "a"));
    });

    expect(result.current.data).toEqual(["b"]);
  });
});
