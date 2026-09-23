import { describe, it, expect } from "vitest";
import { subirDocumento } from "./documentService";

function archivo(over: Partial<{ type: string; size: number; name: string }> = {}): File {
  const { type = "application/pdf", size = 1024, name = "factura.pdf" } = over;
  const file = new File([new Uint8Array(size)], name, { type });
  return file;
}

describe("subirDocumento — validación de tipo y tamaño", () => {
  it("rechaza un tipo de archivo no permitido antes de subir nada", async () => {
    await expect(subirDocumento(archivo({ type: "text/html" }))).rejects.toThrow(
      "Formato no permitido"
    );
  });

  it("rechaza un archivo que supera el tamaño máximo antes de subir nada", async () => {
    await expect(
      subirDocumento(archivo({ size: 11 * 1024 * 1024 }))
    ).rejects.toThrow("supera el tamaño máximo");
  });
});
