import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Locker from "./Locker";
import { useAuth } from "@/hooks/useAuth";
import { fetchMisPreAlertas } from "@/lib/preAlertService";
import type { PreAlert, Profile } from "@/types/database.types";

vi.mock("@/hooks/useAuth");
vi.mock("@/lib/preAlertService", () => ({
  fetchMisPreAlertas: vi.fn(),
  eliminarPreAlerta: vi.fn(),
}));
vi.mock("../components/PreAlertForm", () => ({
  PreAlertForm: () => <div>form-pre-alerta</div>,
}));

const mockUseAuth = vi.mocked(useAuth);
const fetchMock = vi.mocked(fetchMisPreAlertas);

function setProfile(over: Partial<Profile>) {
  mockUseAuth.mockReturnValue({
    profile: { kyc_status: "aprobado", locker_code: null, ...over } as Profile,
  } as unknown as ReturnType<typeof useAuth>);
}

function preAlert(over: Partial<PreAlert> = {}): PreAlert {
  return {
    id: "p1",
    user_id: "u1",
    tracking_number: "TRK1",
    carrier: "DHL",
    description: "un paquete",
    declared_value: 25,
    status: "pendiente",
    created_at: "",
    ...over,
  };
}

beforeEach(() => {
  mockUseAuth.mockReset();
  fetchMock.mockReset().mockResolvedValue([]);
});

describe("Locker — dirección del casillero", () => {
  it("muestra 'Suite <locker_code>' cuando el perfil lo tiene", async () => {
    setProfile({ locker_code: "BC-4821" });
    render(<Locker />);
    expect(await screen.findByText("Suite BC-4821")).toBeInTheDocument();
  });

  it("muestra el fallback cuando no hay locker_code", async () => {
    setProfile({ locker_code: null });
    render(<Locker />);
    expect(await screen.findByText("Suite pendiente de asignación")).toBeInTheDocument();
  });
});

describe("Locker — modo lectura por KYC", () => {
  it("con KYC pendiente: banner, botón de pre-alertar deshabilitado, sin editar/eliminar", async () => {
    setProfile({ kyc_status: "pendiente" });
    fetchMock.mockResolvedValue([preAlert()]);
    render(<Locker />);

    await screen.findByText("DHL — TRK1");
    expect(screen.getByText(/verificación de identidad está en revisión/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pre-alertar paquete/i })).toBeDisabled();
    expect(screen.queryByTitle("Editar")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Eliminar")).not.toBeInTheDocument();
  });

  it("con KYC aprobado: botón habilitado y acciones visibles", async () => {
    setProfile({ kyc_status: "aprobado" });
    fetchMock.mockResolvedValue([preAlert()]);
    render(<Locker />);

    await screen.findByText("DHL — TRK1");
    expect(screen.queryByText(/verificación de identidad está en revisión/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pre-alertar paquete/i })).toBeEnabled();
    expect(screen.getByTitle("Editar")).toBeInTheDocument();
    expect(screen.getByTitle("Eliminar")).toBeInTheDocument();
  });

  it("los botones de editar/eliminar tienen un nombre accesible por pre-alerta, no solo el title", async () => {
    setProfile({ kyc_status: "aprobado" });
    fetchMock.mockResolvedValue([preAlert()]);
    render(<Locker />);

    await screen.findByText("DHL — TRK1");
    expect(screen.getByRole("button", { name: "Editar pre-alerta de DHL — TRK1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar pre-alerta de DHL — TRK1" })).toBeInTheDocument();
  });
});

describe("Locker — lista de pre-alertas", () => {
  it("muestra el estado vacío", async () => {
    setProfile({ kyc_status: "aprobado" });
    fetchMock.mockResolvedValue([]);
    render(<Locker />);
    expect(await screen.findByText(/Aún no tienes paquetes pre-alertados/i)).toBeInTheDocument();
  });
});
