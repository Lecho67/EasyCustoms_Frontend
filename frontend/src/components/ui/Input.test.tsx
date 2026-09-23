import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./Input";

describe("Input — accesibilidad del error", () => {
  it("sin error: aria-invalid es false y no hay aria-describedby", () => {
    render(<Input label="Correo" />);
    const input = screen.getByLabelText("Correo");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("con error: aria-invalid es true, aria-describedby apunta al mensaje, y el mensaje es una región viva", () => {
    render(<Input label="Correo" error="Correo inválido." />);
    const input = screen.getByLabelText("Correo");
    const mensaje = screen.getByRole("alert");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(mensaje).toHaveTextContent("Correo inválido.");
    expect(input.getAttribute("aria-describedby")).toBe(mensaje.id);
  });

  it("el label sigue asociado al input vía htmlFor/id (no se rompió con el cambio)", () => {
    render(<Input label="Nombre completo" error="Requerido." />);
    expect(screen.getByLabelText("Nombre completo")).toBeInTheDocument();
  });
});
