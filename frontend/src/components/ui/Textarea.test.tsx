import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Textarea } from "./Textarea";

describe("Textarea — accesibilidad del error", () => {
  it("sin error: aria-invalid es false y no hay aria-describedby", () => {
    render(<Textarea placeholder="Descripción" />);
    const textarea = screen.getByPlaceholderText("Descripción");
    expect(textarea).toHaveAttribute("aria-invalid", "false");
    expect(textarea).not.toHaveAttribute("aria-describedby");
  });

  it("con error: aria-invalid es true, aria-describedby apunta al mensaje, y el mensaje es una región viva", () => {
    render(<Textarea placeholder="Descripción" error="Describe el producto." />);
    const textarea = screen.getByPlaceholderText("Descripción");
    const mensaje = screen.getByRole("alert");

    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(mensaje).toHaveTextContent("Describe el producto.");
    expect(textarea.getAttribute("aria-describedby")).toBe(mensaje.id);
  });
});
