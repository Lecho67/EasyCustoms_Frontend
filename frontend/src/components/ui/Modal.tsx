import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      {/* Mobile: hoja a pantalla completa. Desktop (sm+): tarjeta centrada. */}
      <div
        ref={dialogRef}
        className="relative w-full overflow-y-auto bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow sm:max-h-[85vh] sm:max-w-lg sm:rounded-xl sm:border sm:border-slate-200 sm:pb-6"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 rounded p-2 text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}