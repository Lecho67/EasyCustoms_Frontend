import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionKickedModal } from "./SessionKickedModal";

const navigate = vi.fn();
const descartarAvisoSesion = vi.fn();
let sesionDesplazada = false;

vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ sesionDesplazada, descartarAvisoSesion }),
}));

beforeEach(() => {
  navigate.mockReset();
  descartarAvisoSesion.mockReset();
  sesionDesplazada = false;
});

describe("SessionKickedModal", () => {
  it("no muestra nada mientras la sesión no fue desplazada", () => {
    render(<SessionKickedModal />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("explica que la sesión se cerró por iniciar sesión en otro dispositivo", () => {
    sesionDesplazada = true;

    render(<SessionKickedModal />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Tu sesión se cerró")).toBeInTheDocument();
    expect(screen.getByText(/otro dispositivo o navegador/)).toBeInTheDocument();
  });

  it("'Iniciar sesión de nuevo' descarta el aviso y lleva a /login", async () => {
    sesionDesplazada = true;
    const user = userEvent.setup();

    render(<SessionKickedModal />);
    await user.click(screen.getByRole("button", { name: "Iniciar sesión de nuevo" }));

    expect(descartarAvisoSesion).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/login");
  });

  it("'Entendido' solo descarta el aviso, sin navegar", async () => {
    sesionDesplazada = true;
    const user = userEvent.setup();

    render(<SessionKickedModal />);
    await user.click(screen.getByRole("button", { name: "Entendido" }));

    expect(descartarAvisoSesion).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });
});
