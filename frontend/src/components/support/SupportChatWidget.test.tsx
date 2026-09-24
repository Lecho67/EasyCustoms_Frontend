import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SupportChatWidget } from "./SupportChatWidget";
import { crearSolicitudAsesor, fetchMiSolicitudPendiente } from "@/lib/advisorRequestService";
import { enviarMensajeChat } from "@/lib/chatService";

vi.mock("@/lib/advisorRequestService", () => ({
  crearSolicitudAsesor: vi.fn(),
  fetchMiSolicitudPendiente: vi.fn(),
}));
vi.mock("@/lib/chatService", () => ({ enviarMensajeChat: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const crearSolicitudMock = vi.mocked(crearSolicitudAsesor);
const fetchPendienteMock = vi.mocked(fetchMiSolicitudPendiente);
const enviarMensajeChatMock = vi.mocked(enviarMensajeChat);

function renderWidget() {
  return render(<SupportChatWidget />);
}

async function abrir(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Abrir chat de ayuda" }));
}

beforeEach(() => {
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
  enviarMensajeChatMock.mockReset().mockResolvedValue("Respuesta del asistente.");
});

describe("SupportChatWidget — abrir/cerrar", () => {
  it("arranca cerrado y el botón lo abre con el mensaje de bienvenida", async () => {
    const user = userEvent.setup();
    renderWidget();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await abrir(user);

    expect(screen.getByRole("dialog", { name: "Chat de ayuda" })).toBeInTheDocument();
    expect(screen.getByText(/soy el asistente de Easy CUSTOMS/)).toBeInTheDocument();
  });

  it("Escape cierra el panel", async () => {
    const user = userEvent.setup();
    renderWidget();
    await abrir(user);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("SupportChatWidget — responde con Gemini", () => {
  it("envía el mensaje y muestra la respuesta del asistente", async () => {
    enviarMensajeChatMock.mockResolvedValue("Los envíos hasta USD 200 no pagan arancel.");
    const user = userEvent.setup();
    renderWidget();
    await abrir(user);

    await user.type(screen.getByPlaceholderText("Escribe tu pregunta..."), "cuanto puedo importar sin pagar");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Los envíos hasta USD 200 no pagan arancel.")).toBeInTheDocument();
    expect(enviarMensajeChatMock).toHaveBeenCalledWith("cuanto puedo importar sin pagar", expect.any(Array));
  });

  it("deshabilita el input mientras espera la respuesta", async () => {
    let resolver: (v: string) => void = () => {};
    enviarMensajeChatMock.mockReturnValue(new Promise((r) => { resolver = r; }));
    const user = userEvent.setup();
    renderWidget();
    await abrir(user);

    await user.type(screen.getByPlaceholderText("Escribe tu pregunta..."), "hola");
    await user.keyboard("{Enter}");

    expect(screen.getByPlaceholderText("Escribe tu pregunta...")).toBeDisabled();
    resolver("listo");
    await waitFor(() => expect(screen.getByPlaceholderText("Escribe tu pregunta...")).toBeEnabled());
  });

  it("si falla la llamada, muestra un mensaje de error y un toast", async () => {
    enviarMensajeChatMock.mockRejectedValue(new Error("timeout"));
    const user = userEvent.setup();
    renderWidget();
    await abrir(user);

    await user.type(screen.getByPlaceholderText("Escribe tu pregunta..."), "hola");
    await user.keyboard("{Enter}");

    expect(await screen.findByText(/No pude responder en este momento/)).toBeInTheDocument();
  });
});

describe("SupportChatWidget — solicitar asesor", () => {
  it("el botón de solicitar asesor llama al servicio y queda pendiente", async () => {
    const user = userEvent.setup();
    renderWidget();
    await abrir(user);

    const boton = screen.getByRole("button", { name: /Solicitar asesor/ });
    await user.click(boton);

    await waitFor(() => expect(crearSolicitudMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Ya tienes una solicitud de asesor pendiente/)).toBeInTheDocument();
  });

  it("si ya había una solicitud pendiente al abrir el chat, no ofrece el botón", async () => {
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
    await abrir(user);

    expect(await screen.findByText(/Ya tienes una solicitud de asesor pendiente/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Solicitar asesor/ })).not.toBeInTheDocument();
  });
});
