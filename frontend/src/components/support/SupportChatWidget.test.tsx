import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SupportChatWidget } from "./SupportChatWidget";
import { fetchConsultas } from "@/lib/queryHistoryService";
import { crearSolicitudAsesor, fetchMiSolicitudPendiente } from "@/lib/advisorRequestService";
import type { DiagnosticoEnvio } from "@/lib/types";

vi.mock("@/lib/queryHistoryService", () => ({ fetchConsultas: vi.fn() }));
vi.mock("@/lib/advisorRequestService", () => ({
  crearSolicitudAsesor: vi.fn(),
  fetchMiSolicitudPendiente: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const fetchConsultasMock = vi.mocked(fetchConsultas);
const crearSolicitudMock = vi.mocked(crearSolicitudAsesor);
const fetchPendienteMock = vi.mocked(fetchMiSolicitudPendiente);

function diag(id: string, descripcionItem: string): DiagnosticoEnvio {
  return {
    id,
    nivel: "verde",
    titulo: descripcionItem,
    resumen: "",
    justificacion: "",
    fuenteNormativa: "",
    documentosRequeridos: [],
    accionesSugeridas: [],
    partidaArancelariaTentativa: "Sin partida tentativa declarada",
    desgloseImpuestos: null,
    createdAt: "2026-01-01T00:00:00Z",
    input: { paisDestino: "Colombia", descripcionItem },
  };
}

function renderWidget() {
  return render(
    <MemoryRouter>
      <SupportChatWidget />
    </MemoryRouter>
  );
}

async function abrirYEsperarCarga(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Abrir chat de ayuda" }));
  await waitFor(() => expect(screen.queryByText(/Cargando tu historial/)).not.toBeInTheDocument());
}

beforeEach(() => {
  fetchConsultasMock.mockReset().mockResolvedValue([]);
  crearSolicitudMock.mockReset().mockResolvedValue({
    id: "s1",
    user_id: "u1",
    mensaje: null,
    estado: "pendiente",
    created_at: "",
    atendida_por: null,
    atendida_at: null,
  });
  fetchPendienteMock.mockReset().mockResolvedValue(null);
});

describe("SupportChatWidget — abrir/cerrar", () => {
  it("arranca cerrado y el botón lo abre", async () => {
    const user = userEvent.setup();
    renderWidget();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abrir chat de ayuda" }));

    expect(screen.getByRole("dialog", { name: "Chat de ayuda" })).toBeInTheDocument();
    expect(screen.getByText(/Puedo responder preguntas generales/)).toBeInTheDocument();
  });

  it("Escape cierra el panel", async () => {
    const user = userEvent.setup();
    renderWidget();
    await user.click(screen.getByRole("button", { name: "Abrir chat de ayuda" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("deshabilita el input mientras carga el historial y las FAQ la primera vez", async () => {
    let resolver: (v: DiagnosticoEnvio[]) => void = () => {};
    fetchConsultasMock.mockReturnValue(new Promise((r) => { resolver = r; }));
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getByRole("button", { name: "Abrir chat de ayuda" }));

    expect(screen.getByPlaceholderText("Escribí tu pregunta...")).toBeDisabled();
    resolver([]);
    await waitFor(() => expect(screen.getByPlaceholderText("Escribí tu pregunta...")).toBeEnabled());
  });
});

describe("SupportChatWidget — responde preguntas de FAQ", () => {
  it("responde con la FAQ real que coincide", async () => {
    const user = userEvent.setup();
    renderWidget();
    await abrirYEsperarCarga(user);

    await user.type(screen.getByPlaceholderText("Escribí tu pregunta..."), "que es el casillero");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("¿Qué es el casillero virtual y cómo funciona?")).toBeInTheDocument();
  });
});

describe("SupportChatWidget — historial del cliente", () => {
  it("responde con la consulta real del cliente que coincide", async () => {
    fetchConsultasMock.mockResolvedValue([diag("d1", "Celular usado")]);
    const user = userEvent.setup();
    renderWidget();
    await abrirYEsperarCarga(user);

    await user.type(screen.getByPlaceholderText("Escribí tu pregunta..."), "cual es el estado de mi celular");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Encontré esta consulta tuya:")).toBeInTheDocument();
    expect(screen.getByText("Celular usado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Celular usado/ })).toHaveAttribute("href", "/consulta/d1");
  });
});

describe("SupportChatWidget — pedir asesor", () => {
  it("escribir 'asesor' ofrece el botón para solicitarlo, y al confirmarlo llama al servicio", async () => {
    const user = userEvent.setup();
    renderWidget();
    await abrirYEsperarCarga(user);

    await user.type(screen.getByPlaceholderText("Escribí tu pregunta..."), "quiero un asesor");
    await user.keyboard("{Enter}");

    const boton = await screen.findByRole("button", { name: "Solicitar asesor personal" });
    await user.click(boton);

    await waitFor(() => expect(crearSolicitudMock).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(/Ya tenés una solicitud de asesor pendiente/)
    ).toBeInTheDocument();
  });

  it("si ya había una solicitud pendiente al abrir el chat, no vuelve a ofrecer el botón", async () => {
    fetchPendienteMock.mockResolvedValue({
      id: "s0",
      user_id: "u1",
      mensaje: null,
      estado: "pendiente",
      created_at: "",
      atendida_por: null,
      atendida_at: null,
    });
    const user = userEvent.setup();
    renderWidget();
    await abrirYEsperarCarga(user);

    await user.type(screen.getByPlaceholderText("Escribí tu pregunta..."), "necesito un asesor");
    await user.keyboard("{Enter}");

    expect(await screen.findByText(/Ya tenés una solicitud de asesor pendiente/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Solicitar asesor personal" })).not.toBeInTheDocument();
  });

  it("después de dos preguntas sin respuesta, ofrece proactivamente un asesor", async () => {
    const user = userEvent.setup();
    renderWidget();
    await abrirYEsperarCarga(user);

    const input = screen.getByPlaceholderText("Escribí tu pregunta...");
    await user.type(input, "asdasd sin sentido uno");
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("button", { name: "Solicitar asesor personal" })).not.toBeInTheDocument();

    await user.type(input, "asdasd sin sentido dos");
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("button", { name: "Solicitar asesor personal" })).toBeInTheDocument();
  });
});
