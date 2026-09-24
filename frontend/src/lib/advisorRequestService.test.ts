import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  crearSolicitudAsesor,
  fetchMiSolicitudPendiente,
  fetchSolicitudesPendientes,
  marcarSolicitudAtendida,
} from "./advisorRequestService";
import { supabase } from "./supabase";
import { createQueryBuilderMock } from "@/test/supabaseQueryMock";

vi.mock("./supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn() },
  },
}));

const fromMock = vi.mocked(supabase.from);
const getSessionMock = vi.mocked(supabase.auth.getSession);

beforeEach(() => {
  fromMock.mockReset();
  getSessionMock.mockReset();
});

describe("crearSolicitudAsesor", () => {
  it("inserta la solicitud con el user_id de la sesión", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } } as never);
    const builder = createQueryBuilderMock({
      data: { id: "s1", user_id: "u1", estado: "pendiente" },
      error: null,
    });
    fromMock.mockReturnValue(builder as never);

    const data = await crearSolicitudAsesor("necesito ayuda con un envío");

    expect(builder.insert).toHaveBeenCalledWith({
      user_id: "u1",
      mensaje: "necesito ayuda con un envío",
    });
    expect(data).toMatchObject({ id: "s1" });
  });

  it("manda mensaje null si no se pasa contexto", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } } as never);
    const builder = createQueryBuilderMock({ data: { id: "s1" }, error: null });
    fromMock.mockReturnValue(builder as never);

    await crearSolicitudAsesor();

    expect(builder.insert).toHaveBeenCalledWith({ user_id: "u1", mensaje: null });
  });

  it("lanza sin sesión activa", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } } as never);

    await expect(crearSolicitudAsesor()).rejects.toThrow("No hay sesión activa");
  });

  it("da un mensaje claro cuando ya hay una solicitud pendiente (23505)", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } } as never);
    fromMock.mockReturnValue(
      createQueryBuilderMock({ data: null, error: { code: "23505", message: "duplicate key" } }) as never
    );

    await expect(crearSolicitudAsesor()).rejects.toThrow("Ya tienes una solicitud de asesor pendiente.");
  });

  it("propaga cualquier otro error de Supabase", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } } as never);
    fromMock.mockReturnValue(
      createQueryBuilderMock({ data: null, error: { code: "500", message: "caído" } }) as never
    );

    await expect(crearSolicitudAsesor()).rejects.toThrow("caído");
  });
});

describe("fetchMiSolicitudPendiente", () => {
  it("devuelve la solicitud pendiente propia", async () => {
    fromMock.mockReturnValue(
      createQueryBuilderMock({ data: { id: "s1", estado: "pendiente" }, error: null }) as never
    );

    await expect(fetchMiSolicitudPendiente()).resolves.toMatchObject({ id: "s1" });
  });

  it("devuelve null si no tiene ninguna pendiente", async () => {
    fromMock.mockReturnValue(createQueryBuilderMock({ data: null, error: null }) as never);

    await expect(fetchMiSolicitudPendiente()).resolves.toBeNull();
  });
});

describe("fetchSolicitudesPendientes", () => {
  it("aplana el nombre y correo del cliente embebido", async () => {
    fromMock.mockReturnValue(
      createQueryBuilderMock({
        data: [
          {
            id: "s1",
            user_id: "u1",
            estado: "pendiente",
            cliente: { full_name: "Ana Pérez", email: "ana@test.test" },
          },
        ],
        error: null,
      }) as never
    );

    const data = await fetchSolicitudesPendientes();

    expect(data).toEqual([
      expect.objectContaining({
        id: "s1",
        cliente_nombre: "Ana Pérez",
        cliente_email: "ana@test.test",
      }),
    ]);
  });
});

describe("marcarSolicitudAtendida", () => {
  it("marca atendida con el admin de la sesión", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "admin1" } } } } as never);
    const builder = createQueryBuilderMock({ data: null, error: null });
    fromMock.mockReturnValue(builder as never);

    await marcarSolicitudAtendida("s1");

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ estado: "atendida", atendida_por: "admin1" })
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "s1");
  });

  it("lanza sin sesión activa", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } } as never);

    await expect(marcarSolicitudAtendida("s1")).rejects.toThrow("No hay sesión activa");
  });
});
