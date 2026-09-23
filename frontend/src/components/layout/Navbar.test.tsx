import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Navbar } from "./Navbar";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth");
vi.mock("@/components/layout/NotificationBell", () => ({
  NotificationBell: () => null,
}));

const mockUseAuth = vi.mocked(useAuth);
type AuthValue = ReturnType<typeof useAuth>;

function renderNavbar() {
  mockUseAuth.mockReturnValue({
    user: { id: "u1" } as AuthValue["user"],
    session: null,
    profile: { role: "admin", full_name: "Ana Admin" } as AuthValue["profile"],
    loading: false,
    profileError: null,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
    sesionDesplazada: false,
    descartarAvisoSesion: vi.fn(),
  } as AuthValue);

  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  );
}

describe("Navbar — desplegables de escritorio", () => {
  it("'Paneles' expone aria-expanded, Escape lo cierra y devuelve el foco al botón", async () => {
    const user = userEvent.setup();
    renderNavbar();

    const boton = screen.getByRole("button", { name: "Paneles" });
    expect(boton).toHaveAttribute("aria-expanded", "false");

    await user.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("navbar-paneles-menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("navbar-paneles-menu")).not.toBeInTheDocument();
    expect(boton).toHaveFocus();
  });

  it("'Mi Perfil' expone aria-expanded, Escape lo cierra y devuelve el foco al botón", async () => {
    const user = userEvent.setup();
    renderNavbar();

    const boton = screen.getByRole("button", { name: /Mi Perfil/ });
    expect(boton).toHaveAttribute("aria-expanded", "false");

    await user.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("navbar-perfil-menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("navbar-perfil-menu")).not.toBeInTheDocument();
    expect(boton).toHaveFocus();
  });

  it("abrir 'Mi Perfil' cierra 'Paneles' si estaba abierto", async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole("button", { name: "Paneles" }));
    expect(document.getElementById("navbar-paneles-menu")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Mi Perfil/ }));
    expect(document.getElementById("navbar-paneles-menu")).not.toBeInTheDocument();
    expect(document.getElementById("navbar-perfil-menu")).toBeInTheDocument();
  });
});
