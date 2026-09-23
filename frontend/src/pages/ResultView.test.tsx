import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultView } from "./ResultView";
import { fetchConsultaById } from "@/lib/queryHistoryService";
import type { DiagnosticoEnvio } from "@/lib/types";

const navigate = vi.fn();
const getConsultaById = vi.fn();
const addConsulta = vi.fn();

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "q1" }),
  useNavigate: () => navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/lib/queryHistoryService", () => ({ fetchConsultaById: vi.fn() }));
vi.mock("@/store/useQueryStore", () => ({
  useQueryStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ getConsultaById, addConsulta }),
}));
vi.mock("@/components/verdict/VerdictCard", () => ({
  VerdictCard: () => <div>verdict-card</div>,
}));
vi.mock("@/components/verdict/NextStepsCard", () => ({ NextStepsCard: () => null }));
vi.mock("@/components/verdict/JustificationCard", () => ({ JustificationCard: () => null }));
vi.mock("@/components/verdict/DocumentChecklist", () => ({ DocumentChecklist: () => null }));
vi.mock("@/components/verdict/TaxBreakdownCard", () => ({ TaxBreakdownCard: () => null }));

const fetchMock = vi.mocked(fetchConsultaById);
const diag = { id: "q1", documentosRequeridos: [] } as unknown as DiagnosticoEnvio;

beforeEach(() => {
  navigate.mockReset();
  getConsultaById.mockReset();
  addConsulta.mockReset();
  fetchMock.mockReset();
});

describe("ResultView", () => {
  it("renderiza desde el store cuando la consulta está cacheada", () => {
    getConsultaById.mockReturnValue(diag);

    render(<ResultView />);

    expect(screen.getByText("verdict-card")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("busca por id cuando no está en el store y la renderiza", async () => {
    getConsultaById.mockReturnValue(undefined);
    fetchMock.mockResolvedValue(diag);

    render(<ResultView />);

    expect(await screen.findByText("verdict-card")).toBeInTheDocument();
    expect(addConsulta).toHaveBeenCalledWith(diag);
  });

  it("muestra 'No encontramos esta consulta' si el fetch no trae nada", async () => {
    getConsultaById.mockReturnValue(undefined);
    fetchMock.mockResolvedValue(null);

    render(<ResultView />);

    expect(await screen.findByText(/No encontramos esta consulta/i)).toBeInTheDocument();
  });

  it("los botones navegan al historial y a una nueva consulta", async () => {
    getConsultaById.mockReturnValue(diag);
    const user = userEvent.setup();

    render(<ResultView />);

    await user.click(screen.getByRole("button", { name: /ver historial/i }));
    expect(navigate).toHaveBeenCalledWith("/dashboard/historial");

    await user.click(screen.getByRole("button", { name: /nueva consulta/i }));
    expect(navigate).toHaveBeenCalledWith("/consulta/nueva");
  });
});
