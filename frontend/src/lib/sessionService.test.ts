import { describe, it, expect, vi, beforeEach } from "vitest";
import { registrarSesion, sesionSigueVigente } from "./sessionService";

const rpcMock = vi.fn();

vi.mock("./supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

beforeEach(() => {
  rpcMock.mockReset();
});

describe("registrarSesion", () => {
  it("llama al RPC registrar_sesion", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await registrarSesion();

    expect(rpcMock).toHaveBeenCalledWith("registrar_sesion");
  });

  it("no lanza si el RPC falla (no debe bloquear el login)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(registrarSesion()).resolves.toBeUndefined();
  });
});

describe("sesionSigueVigente", () => {
  it("true cuando el RPC confirma que sigue siendo la sesión activa", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });

    expect(await sesionSigueVigente()).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("sesion_vigente");
  });

  it("false solo cuando el RPC dice explícitamente que otra sesión tomó la cuenta", async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });

    expect(await sesionSigueVigente()).toBe(false);
  });

  it("true ante un error del RPC (no se expulsa por un fallo de infraestructura)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "función inexistente" } });

    expect(await sesionSigueVigente()).toBe(true);
  });

  it("true si la llamada misma revienta (red caída)", async () => {
    rpcMock.mockRejectedValue(new Error("network"));

    expect(await sesionSigueVigente()).toBe(true);
  });
});
