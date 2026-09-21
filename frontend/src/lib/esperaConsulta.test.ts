import { describe, it, expect, vi, beforeEach } from "vitest";
import { segundosEsperaConsulta } from "./esperaConsulta";

const rpcMock = vi.fn();

vi.mock("./supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

beforeEach(() => {
  rpcMock.mockReset();
});

describe("segundosEsperaConsulta", () => {
  it("devuelve los segundos que calcula el RPC", async () => {
    rpcMock.mockResolvedValue({ data: 24, error: null });

    expect(await segundosEsperaConsulta()).toBe(24);
    expect(rpcMock).toHaveBeenCalledWith("segundos_espera_consulta");
  });

  it("0 cuando ya puede consultar", async () => {
    rpcMock.mockResolvedValue({ data: 0, error: null });

    expect(await segundosEsperaConsulta()).toBe(0);
  });

  it("0 ante un error del RPC (la base igual rechaza el insert si corresponde)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "función inexistente" } });

    expect(await segundosEsperaConsulta()).toBe(0);
  });

  it("0 si la respuesta no es un número", async () => {
    rpcMock.mockResolvedValue({ data: "24", error: null });

    expect(await segundosEsperaConsulta()).toBe(0);
  });

  it("0 si la llamada misma revienta (red caída)", async () => {
    rpcMock.mockRejectedValue(new Error("network"));

    expect(await segundosEsperaConsulta()).toBe(0);
  });
});
