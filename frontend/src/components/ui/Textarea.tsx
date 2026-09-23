import { forwardRef, useId, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    const errorId = `${textareaId}-error`;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="text-xs font-medium text-slate-500 mb-1 block">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          // text-base explícito: con menos de 16px iOS hace zoom al enfocar.
          className={`w-full rounded-xl border p-4 text-base focus:outline-none focus:ring-2 focus:ring-cobalt focus:border-transparent resize-none ${
            error ? "border-red-400" : "border-slate-300"
          } ${className}`}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="text-xs text-red-600 mt-1">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
