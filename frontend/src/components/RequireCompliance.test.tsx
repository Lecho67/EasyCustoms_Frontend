import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RequireCompliance } from "./RequireCompliance";
import { useAuth } from "@/hooks/useAuth";
import type { Profile } from "@/types/database.types";

vi.mock("@/hooks/useAuth");
const mockUseAuth = vi.mocked(useAuth);

function fakeProfile(over: Partial<Profile> = {}): Profile {
  return {
    id: "u1",
    email: "cliente@test.test",
    full_name: null,
    locker_code: null,
    phone: null,
    role: "cliente",
    gestor_id: null,
    created_at: "",
    updated_at: "",
    document_type: null,
    document_number: null,
    kyc_status: "aprobado",
    kyc_document_path: null,
    kyc_rejection_reason: null,
    terms_accepted_at: "2024-01-01",
    habeas_data_accepted_at: "2024-01-01",
    notification_preferences: {
      paquete_recibido: false,
      aprobado_aduana: false,
      impuesto_pendiente: false,
      canal_whatsapp_sms: false,
    },
    address_street: null,
    address_city: null,
    address_department: null,
    address_postal_code: null,
    address_country: null,
    ...over,
  };
}

function renderWith(profile: Profile | null) {
  mockUseAuth.mockReturnValue({ profile } as ReturnType<typeof useAuth>);
  return render(
    <MemoryRouter>
      <RequireCompliance>
        <div>CONTENIDO CASILLERO</div>
      </RequireCompliance>
    </MemoryRouter>
  );
}

describe("RequireCompliance", () => {
  it("deja pasar con términos aceptados y KYC aprobado", () => {
    renderWith(fakeProfile());
    expect(screen.getByText("CONTENIDO CASILLERO")).toBeInTheDocument();
  });

  it("bloquea si faltan los términos", () => {
    renderWith(fakeProfile({ terms_accepted_at: null }));
    expect(screen.queryByText("CONTENIDO CASILLERO")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /aceptar los términos/i })
    ).toBeInTheDocument();
  });

  it("bloquea si el KYC no está iniciado", () => {
    renderWith(fakeProfile({ kyc_status: "no_iniciado" }));
    expect(screen.queryByText("CONTENIDO CASILLERO")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /verifica tu identidad/i })
    ).toBeInTheDocument();
  });

  it("bloquea con mensaje específico si el KYC fue rechazado", () => {
    renderWith(fakeProfile({ kyc_status: "rechazado" }));
    expect(
      screen.getByRole("heading", { name: /fue rechazada/i })
    ).toBeInTheDocument();
  });

  it("deja pasar en estado pendiente (el modo lectura lo maneja Locker)", () => {
    renderWith(fakeProfile({ kyc_status: "pendiente" }));
    expect(screen.getByText("CONTENIDO CASILLERO")).toBeInTheDocument();
  });

  it("no aplica a roles internos: un admin sin términos ni KYC pasa igual", () => {
    renderWith(
      fakeProfile({ role: "admin", terms_accepted_at: null, kyc_status: "no_iniciado" })
    );
    expect(screen.getByText("CONTENIDO CASILLERO")).toBeInTheDocument();
  });
});
