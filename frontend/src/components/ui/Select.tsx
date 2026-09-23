import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface SelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Nombre accesible cuando no hay un <label> con htmlFor propio — este
   * trigger es un <button>, no un elemento "labelable" nativo, así que
   * <label for> no lo asocia de forma confiable entre lectores de pantalla. */
  ariaLabel?: string;
}

export function Select({ options, value, onChange, placeholder = "Selecciona...", ariaLabel }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function cerrar() {
    setOpen(false);
    setSearch("");
  }

  function elegir(option: string) {
    onChange(option);
    cerrar();
    // Sin esto el foco quedaba en el botón de la opción, que se desmonta
    // al cerrar el popover — el navegador lo manda a <body> y se pierde
    // el contexto. Igual que un <select> nativo, vuelve al control.
    triggerRef.current?.focus();
  }

  // Antes no existía ninguna forma de cerrar salvo elegir una opción — ni
  // click afuera ni Escape. No es solo un problema de accesibilidad: un
  // usuario de mouse tampoco podía cancelar.
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) cerrar();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        cerrar();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full text-left rounded-xl border border-slate-300 p-4 bg-white hover:border-cobalt transition-colors flex items-center justify-between"
      >
        <span className={value ? "text-slate-900 font-medium" : "text-slate-400"}>
          {value || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-10 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow p-2">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            aria-label="Buscar opción"
            className="w-full px-3 py-2 mb-2 text-base rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cobalt"
          />
          <div role="listbox" className="max-h-48 overflow-y-auto">
            {filtered.map((option) => (
              <button
                type="button"
                key={option}
                role="option"
                aria-selected={option === value}
                onClick={() => elegir(option)}
                className="flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-cobalt/10"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
