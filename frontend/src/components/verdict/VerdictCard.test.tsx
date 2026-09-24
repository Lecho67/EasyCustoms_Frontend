import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VerdictCard } from "./VerdictCard";
import type { DiagnosticoEnvio } from "@/lib/types";

function diagnostico(over: Partial<DiagnosticoEnvio["input"]> = {}): DiagnosticoEnvio {
  return {
    id: "d1",
    nivel: "verde",
    titulo: "Tu envío puede pasar sin problema",
    resumen: "Tu envío cumple con la normativa.",
    justificacion: "",
    fuenteNormativa: "",
    documentosRequeridos: [],
    accionesSugeridas: [],
    partidaArancelariaTentativa: "8517.70.00",
    desgloseImpuestos: null,
    deMinimis: null,
    createdAt: "2026-01-01T00:00:00Z",
    input: {
      paisDestino: "Colombia",
      descripcionItem: "Auriculares inalámbricos",
      ...over,
    },
  };
}

describe("VerdictCard", () => {
  it("muestra la descripción del ítem declarado", () => {
    render(<VerdictCard diagnostico={diagnostico()} />);
    expect(screen.getByText("Auriculares inalámbricos")).toBeInTheDocument();
  });

  it("le confirma al usuario la modalidad y el transporte que declaró", () => {
    render(
      <VerdictCard
        diagnostico={diagnostico({
          transportType: "air",
          shipmentModality: "personal_shipment_gift",
        })}
      />
    );
    expect(screen.getByText("Envío personal / regalo · Aéreo")).toBeInTheDocument();
  });

  it("no muestra el pill de régimen si la consulta es vieja y no tiene ese dato", () => {
    render(<VerdictCard diagnostico={diagnostico()} />);
    expect(screen.queryByText(/Aéreo|Marítimo|Terrestre|Mensajería/)).not.toBeInTheDocument();
  });
});
