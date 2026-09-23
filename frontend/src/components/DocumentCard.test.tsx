import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentCard } from "./DocumentCard";
import type { DocumentRecord } from "@/types/database.types";

function doc(over: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: "d1",
    user_id: "u1",
    file_name: "factura.pdf",
    file_path: "u1/factura.pdf",
    file_type: "application/pdf",
    related_pre_alert_id: null,
    created_at: "2026-01-01",
    status: "pendiente",
    reviewed_by: null,
    review_reason: null,
    reviewed_at: null,
    assigned_agent_id: null,
    ...over,
  };
}

describe("DocumentCard — estado", () => {
  it("pendiente: badge 'En revisión', sin bloque de motivo ni 'Volver a subir'", () => {
    render(<DocumentCard doc={doc()} onVer={vi.fn()} onEliminar={vi.fn()} />);

    expect(screen.getByText("En revisión")).toBeInTheDocument();
    expect(screen.queryByText(/motivo del rechazo/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Volver a subir")).not.toBeInTheDocument();
  });

  it("aprobado: badge 'Aprobado'", () => {
    render(<DocumentCard doc={doc({ status: "aprobado" })} onVer={vi.fn()} onEliminar={vi.fn()} />);

    expect(screen.getByText("Aprobado")).toBeInTheDocument();
  });

  it("rechazado: badge, motivo visible y 'Volver a subir'", () => {
    render(
      <DocumentCard
        doc={doc({ status: "rechazado", review_reason: "La factura no coincide con el envío." })}
        onVer={vi.fn()}
        onEliminar={vi.fn()}
      />
    );

    expect(screen.getByText("Rechazado")).toBeInTheDocument();
    expect(screen.getByText("La factura no coincide con el envío.")).toBeInTheDocument();
    expect(screen.getByText("Volver a subir").closest("label")).toHaveAttribute("for", "upload-doc");
  });

  it("rechazado sin motivo cargado: no muestra el bloque de motivo", () => {
    render(<DocumentCard doc={doc({ status: "rechazado" })} onVer={vi.fn()} onEliminar={vi.fn()} />);

    expect(screen.queryByText(/motivo del rechazo/i)).not.toBeInTheDocument();
  });

  it("modo lectura (sin onEliminar): no muestra 'Eliminar' ni 'Volver a subir', aunque esté rechazado", () => {
    render(<DocumentCard doc={doc({ status: "rechazado", review_reason: "Foto borrosa." })} onVer={vi.fn()} />);

    expect(screen.queryByText("Eliminar")).not.toBeInTheDocument();
    expect(screen.queryByText("Volver a subir")).not.toBeInTheDocument();
  });
});

describe("DocumentCard — acciones", () => {
  it("'Ver documento' llama a onVer con el documento", async () => {
    const user = userEvent.setup();
    const onVer = vi.fn();
    render(<DocumentCard doc={doc()} onVer={onVer} />);

    await user.click(screen.getByText("Ver documento"));

    expect(onVer).toHaveBeenCalledWith(doc());
  });

  it("'Eliminar' llama a onEliminar con el documento", async () => {
    const user = userEvent.setup();
    const onEliminar = vi.fn();
    render(<DocumentCard doc={doc()} onVer={vi.fn()} onEliminar={onEliminar} />);

    await user.click(screen.getByText("Eliminar"));

    expect(onEliminar).toHaveBeenCalledWith(doc());
  });
});
