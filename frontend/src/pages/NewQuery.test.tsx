import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewQuery } from "./NewQuery";
import { evaluarEnvio } from "@/lib/api";
import { segundosEsperaConsulta } from "@/lib/esperaConsulta";
import type { DiagnosticoEnvio, WizardFormData } from "@/lib/types";

const navigate = vi.fn();
const addConsulta = vi.fn();

vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@/lib/api", () => ({ evaluarEnvio: vi.fn() }));
vi.mock("@/lib/esperaConsulta", () => ({ segundosEsperaConsulta: vi.fn() }));
vi.mock("@/store/useQueryStore", () => ({
  useQueryStore: (selector: (s: { addConsulta: typeof addConsulta }) => unknown) =>
    selector({ addConsulta }),
}));
vi.mock("@/components/ShipmentForm", () => ({
  ShipmentForm: ({
    onSubmit,
    esperaSegundos = 0,
  }: {
    onSubmit: (d: WizardFormData) => void;
    esperaSegundos?: number;
  }) => (
    <button
      disabled={esperaSegundos > 0}
      onClick={() => onSubmit({ descripcionItem: "algo" } as WizardFormData)}
    >
      enviar-wizard
    </button>
  ),
}));

const evaluarMock = vi.mocked(evaluarEnvio);
const esperaMock = vi.mocked(segundosEsperaConsulta);

beforeEach(() => {
  navigate.mockReset();
  addConsulta.mockReset();
  evaluarMock.mockReset();
  esperaMock.mockReset().mockResolvedValue(0);
});

describe("NewQuery", () => {
  it("con éxito: guarda el diagnóstico y navega a /consulta/:id", async () => {
    evaluarMock.mockResolvedValue({ id: "diag-1" } as DiagnosticoEnvio);
    const user = userEvent.setup();

    render(<NewQuery />);
    await user.click(screen.getByText("enviar-wizard"));

    await waitFor(() => expect(addConsulta).toHaveBeenCalledWith({ id: "diag-1" }));
    expect(navigate).toHaveBeenCalledWith("/consulta/diag-1");
  });

  it("con error: muestra el banner y no navega", async () => {
    evaluarMock.mockRejectedValue(new Error("motor caído"));
    const user = userEvent.setup();

    render(<NewQuery />);
    await user.click(screen.getByText("enviar-wizard"));

    expect(await screen.findByText(/motor caído/)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("mientras evalúa muestra el esqueleto de carga", async () => {
    let resolver: (d: DiagnosticoEnvio) => void = () => {};
    evaluarMock.mockReturnValue(new Promise((r) => { resolver = r; }));
    const user = userEvent.setup();

    render(<NewQuery />);
    await user.click(screen.getByText("enviar-wizard"));

    await waitFor(() => expect(screen.queryByText("enviar-wizard")).not.toBeInTheDocument());
    resolver({ id: "diag-2" } as DiagnosticoEnvio);
  });
});

describe("NewQuery — espera entre consultas", () => {
  it("al entrar con una espera vigente muestra la cuenta regresiva y deshabilita el envío", async () => {
    esperaMock.mockResolvedValue(20);

    render(<NewQuery />);

    expect(await screen.findByRole("status")).toHaveTextContent(/20 s/);
    expect(screen.getByText("enviar-wizard")).toBeDisabled();
  });

  it("si al enviar todavía hay espera, no evalúa y conserva el formulario (no lo desmonta)", async () => {
    // 0 al montar; el servidor dice que faltan 15 s recién al enviar
    esperaMock.mockResolvedValueOnce(0).mockResolvedValueOnce(15);
    const user = userEvent.setup();

    render(<NewQuery />);
    await user.click(screen.getByText("enviar-wizard"));

    expect(await screen.findByRole("status")).toHaveTextContent(/15 s/);
    expect(evaluarMock).not.toHaveBeenCalled();
    expect(screen.getByText("enviar-wizard")).toBeInTheDocument();
  });

  it("la cuenta regresiva baja de a un segundo hasta liberar el envío", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      esperaMock.mockResolvedValue(2);

      render(<NewQuery />);
      expect(await screen.findByRole("status")).toHaveTextContent(/2 s/);

      await vi.advanceTimersByTimeAsync(1000);
      expect(screen.getByRole("status")).toHaveTextContent(/1 s/);

      await vi.advanceTimersByTimeAsync(1000);
      await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
      expect(screen.getByText("enviar-wizard")).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
