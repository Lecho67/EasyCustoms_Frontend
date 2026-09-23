import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- Identidad Easy CUSTOMS ---
        // Cobalto: color dominante — fondos oscuros, encabezados sobre claro,
        // botones primarios y estructura. Es un color de texto válido.
        cobalt: {
          DEFAULT: "#0F2C59",
          600: "#1B4488",
          900: "#0A1F40",
        },
        // Cian: SOLO acento — highlights, líneas de movimiento, indicadores,
        // degradados. REGLA DURA: nunca en texto de cuerpo o descriptivo.
        cian: {
          DEFAULT: "#00A8E8",
          light: "#4FCBF2",
        },
        // Papel: fondos claros, superficies de tarjeta, texto claro sobre cobalto.
        papel: {
          DEFAULT: "#F8F9FA",
          tint: "#E8F9FA",
        },

        // Veredictos: exclusivos para estados de diagnóstico.
        // `text` auditado a WCAG AA (4.5:1) el 2026-09-23: los tonos
        // originales (emerald/amber/red-600) daban 3.07-4.41:1 sobre bg y
        // blanco — fallaban para texto normal. Se bajó un escalón (-700) en
        // los 3; `border`/`bg` quedan igual, no estaban en la auditoría.
        "verdict-green": { bg: "#ECFDF5", text: "#047857", border: "#059669" },
        "verdict-amber": { bg: "#FFFBEB", text: "#B45309", border: "#D97706" },
        "verdict-red": { bg: "#FEF2F2", text: "#B91C1C", border: "#DC2626" },
      },
      fontFamily: {
        sans: ["Jost", "Century Gothic", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Roboto Mono", "monospace"],
      },
      borderRadius: { xl: "0.75rem" },
    },
  },
  plugins: [],
} satisfies Config;
