import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchNotificaciones,
  marcarComoLeida,
  marcarTodasComoLeidas,
} from "@/lib/notificationService";
import type { NotificationRecord } from "@/types/database.types";

vi.mock("@/hooks/useAuth");
vi.mock("@/lib/notificationService", () => ({
  fetchNotificaciones: vi.fn(),
  marcarComoLeida: vi.fn().mockResolvedValue(undefined),
  marcarTodasComoLeidas: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase", () => {
  const canal = { on: vi.fn(), subscribe: vi.fn() };
  canal.on.mockReturnValue(canal);
  canal.subscribe.mockReturnValue(canal);
  return { supabase: { channel: vi.fn(() => canal), removeChannel: vi.fn() } };
});

const mockUseAuth = vi.mocked(useAuth);
const fetchMock = vi.mocked(fetchNotificaciones);

function noti(over: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: "n1",
    user_id: "u1",
    tipo: "paquete_recibido",
    titulo: "Paquete recibido en bodega",
    mensaje: "Tu paquete DHL llegó.",
    leida: false,
    created_at: new Date().toISOString(),
    ...over,
  };
}

function conUsuario() {
  mockUseAuth.mockReturnValue({ user: { id: "u1" } } as ReturnType<typeof useAuth>);
}

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue([]);
  mockUseAuth.mockReset();
});

describe("NotificationBell", () => {
  it("no renderiza nada sin sesión", () => {
    mockUseAuth.mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    const { container } = render(<NotificationBell />);
    expect(container).toBeEmptyDOMElement();
  });

  it("muestra el badge con la cantidad de no leídas", async () => {
    conUsuario();
    fetchMock.mockResolvedValue([noti({ id: "a" }), noti({ id: "b" }), noti({ id: "c", leida: true })]);

    render(<NotificationBell />);

    expect(await screen.findByText("2")).toBeInTheDocument();
  });

  it("abre el panel y lista las notificaciones", async () => {
    conUsuario();
    fetchMock.mockResolvedValue([noti()]);
    const user = userEvent.setup();

    render(<NotificationBell />);
    await screen.findByText("1");

    await user.click(screen.getByRole("button", { name: /notificaciones/i }));

    expect(screen.getByText("Paquete recibido en bodega")).toBeInTheDocument();
  });

  it("marca una notificación como leída al hacer clic", async () => {
    conUsuario();
    fetchMock.mockResolvedValue([noti()]);
    const user = userEvent.setup();

    render(<NotificationBell />);
    await screen.findByText("1");

    await user.click(screen.getByRole("button", { name: /notificaciones/i }));
    await user.click(screen.getByText("Paquete recibido en bodega"));

    expect(marcarComoLeida).toHaveBeenCalledWith("n1");
    await waitFor(() => expect(screen.queryByText("1")).not.toBeInTheDocument());
  });

  it("'Marcar todas como leídas' limpia el badge", async () => {
    conUsuario();
    fetchMock.mockResolvedValue([noti({ id: "a" }), noti({ id: "b" })]);
    const user = userEvent.setup();

    render(<NotificationBell />);
    await screen.findByText("2");

    await user.click(screen.getByRole("button", { name: /notificaciones/i }));
    await user.click(screen.getByText("Marcar todas como leídas"));

    expect(marcarTodasComoLeidas).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("2")).not.toBeInTheDocument());
  });

  it("muestra el estado vacío", async () => {
    conUsuario();
    fetchMock.mockResolvedValue([]);
    const user = userEvent.setup();

    render(<NotificationBell />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /notificaciones/i }));

    expect(screen.getByText("No tienes notificaciones.")).toBeInTheDocument();
  });

  it("el trigger expone aria-expanded y el panel tiene role=region", async () => {
    conUsuario();
    fetchMock.mockResolvedValue([]);
    const user = userEvent.setup();

    render(<NotificationBell />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const trigger = screen.getByRole("button", { name: /notificaciones/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Notificaciones" })).toBeInTheDocument();
  });

  it("Escape cierra el panel y devuelve el foco al trigger", async () => {
    conUsuario();
    fetchMock.mockResolvedValue([noti()]);
    const user = userEvent.setup();

    render(<NotificationBell />);
    await screen.findByText("1");

    const trigger = screen.getByRole("button", { name: /notificaciones/i });
    await user.click(trigger);
    expect(screen.getByRole("region", { name: "Notificaciones" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("region", { name: "Notificaciones" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
