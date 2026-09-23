import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "./Select";

function setup() {
  const onChange = vi.fn();
  render(
    <Select options={["Colombia", "México", "España"]} value="" onChange={onChange} ariaLabel="País" />
  );
  return { onChange, trigger: screen.getByRole("button", { name: "País" }) };
}

describe("Select — accesibilidad y teclado", () => {
  it("aria-expanded refleja si el popover está abierto", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("Escape cierra el popover y devuelve el foco al trigger", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();

    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("click afuera cierra el popover (antes no existía ninguna forma de cerrar sin elegir)", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();

    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("elegir una opción llama a onChange, cierra el popover y devuelve el foco al trigger", async () => {
    const user = userEvent.setup();
    const { onChange, trigger } = setup();

    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "México" }));

    expect(onChange).toHaveBeenCalledWith("México");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("el buscador filtra las opciones", async () => {
    const user = userEvent.setup();
    const { trigger } = setup();

    await user.click(trigger);
    await user.type(screen.getByRole("textbox", { name: "Buscar opción" }), "méx");

    expect(screen.getByRole("option", { name: "México" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Colombia" })).not.toBeInTheDocument();
  });
});
