import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdvisorRequestsPanel } from "./AdvisorRequestsPanel";
import { fetchSolicitudesPendientes, marcarSolicitudAtendida } from "@/lib/advisorRequestService";
import type { SolicitudAsesorConCliente } from "@/lib/advisorRequestService";

vi.mock("@/lib/advisorRequestService", () => ({
  fetchSolicitudesPendientes: vi.fn(),
  marcarSolicitudAtendida: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const fetchMock = vi.mocked(fetchSolicitudesPendientes);
const marcarMock = vi.mocked(marcarSolicitudAtendida);

function fakeSolicitud(over: Partial<SolicitudAsesorConCliente> = {}): SolicitudAsesorConCliente {
  return {
    id: "s1",
    user_id: "u1",
    mensaje: null,
    estado: "pendiente",
    created_at: "2026-01-01T12:00:00Z",
    atendida_por: null,
    atendida_at: null,
    cliente_nombre: "Ana Pérez",
    cliente_email: "ana@test.test",
    ...over,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  marcarMock.mockReset().mockResolvedValue(undefined);
});

describe("AdvisorRequestsPanel", () => {
  it("muestra el empty state sin solicitudes pendientes", async () => {
    fetchMock.mockResolvedValue([]);

    render(<AdvisorRequestsPanel />);

    expect(await screen.findByText("No hay solicitudes de asesor pendientes.")).toBeInTheDocument();
  });

  it("lista al cliente, su mensaje de contexto y la fecha", async () => {
    fetchMock.mockResolvedValue([fakeSolicitud({ mensaje: "necesito ayuda con mi envío" })]);

    render(<AdvisorRequestsPanel />);

    expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("ana@test.test")).toBeInTheDocument();
    expect(screen.getByText('"necesito ayuda con mi envío"')).toBeInTheDocument();
  });

  it("'Marcar atendida' la saca de la lista", async () => {
    fetchMock.mockResolvedValue([fakeSolicitud()]);
    const user = userEvent.setup();

    render(<AdvisorRequestsPanel />);
    await screen.findByText("Ana Pérez");

    await user.click(screen.getByRole("button", { name: /Marcar atendida/ }));

    expect(marcarMock).toHaveBeenCalledWith("s1");
    await waitFor(() => expect(screen.queryByText("Ana Pérez")).not.toBeInTheDocument());
    expect(await screen.findByText("No hay solicitudes de asesor pendientes.")).toBeInTheDocument();
  });
});
