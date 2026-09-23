import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Ícono/botón fijo a la derecha del input (ej. el toggle de PasswordInput). */
  endAdornment?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, endAdornment, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-slate-500 mb-1 block">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            // text-base explícito: con menos de 16px iOS hace zoom al enfocar.
            className={`w-full rounded-xl border p-3 text-base ${endAdornment ? "pr-11" : ""} focus:outline-none focus:ring-2 focus:ring-cobalt focus:border-transparent ${
              error ? "border-red-400" : "border-slate-300"
            } ${className}`}
            {...props}
          />
          {endAdornment && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">{endAdornment}</div>
          )}
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-xs text-red-600 mt-1">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
