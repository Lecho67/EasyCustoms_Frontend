import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NativeReportsView } from "./NativeReportsView";
import { useAuth } from "@/hooks/useAuth";
import { fetchVolumenMensual } from "@/lib/reportsService";
import type { PuntoVolumenMensual } from "@/lib/reportsService";

vi.mock("@/hooks/useAuth");
vi.mock("@/lib/reportsService", () => ({ fetchVolumenMensual: vi.fn() }));
vi.mock("@/lib/gestorService", () => ({ fetchClienteIdsDelGestor: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockUseAuth = vi.mocked(useAuth);
const fetchMock = vi.mocked(fetchVolumenMensual);
type AuthValue = ReturnType<typeof useAuth>;

const datos: PuntoVolumenMensual[] = [
  { mes: "2026-02", mesLabel: "feb 2026", aprobados: 10, retenidos: 2 },
  { mes: "2026-03", mesLabel: "mar 2026", aprobados: 7, retenidos: 5 },
];

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(datos);
  mockUseAuth.mockReset().mockReturnValue({
    user: { id: "u1" },
    profile: { role: "admin" },
  } as unknown as AuthValue);
});

describe("NativeReportsView — alternativa textual del gráfico", () => {
  it("el gráfico se oculta a lectores de pantalla (aria-hidden) porque el SVG de recharts no expone los datos", async () => {
    const { container } = render(<NativeReportsView />);
    await screen.findByRole("table");

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it("expone una tabla sr-only equivalente a los datos del gráfico", async () => {
    render(<NativeReportsView />);

    const tabla = await screen.findByRole("table");
    expect(tabla).toHaveAccessibleName(
      "Volumen mensual de envíos: aprobados vs. retenidos, últimos 6 meses"
    );

    const filas = within(tabla).getAllByRole("row");
    // encabezado + 2 filas de datos
    expect(filas).toHaveLength(3);

    const filaFeb = within(tabla).getByRole("row", { name: /feb 2026/ });
    expect(within(filaFeb).getByText("10")).toBeInTheDocument();
    expect(within(filaFeb).getByText("2")).toBeInTheDocument();

    const filaMar = within(tabla).getByRole("row", { name: /mar 2026/ });
    expect(within(filaMar).getByText("7")).toBeInTheDocument();
    expect(within(filaMar).getByText("5")).toBeInTheDocument();
  });
});
