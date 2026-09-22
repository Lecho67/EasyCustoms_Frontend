import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface SelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function Select({ options, value, onChange, placeholder = "Selecciona..." }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
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
            className="w-full px-3 py-2 mb-2 text-base rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cobalt"
          />
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((option) => (
              <button
                type="button"
                key={option}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                  setSearch("");
                }}
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
