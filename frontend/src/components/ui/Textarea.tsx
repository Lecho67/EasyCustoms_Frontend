import { forwardRef, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className = "", ...props }, ref) => {
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          // text-base explícito: con menos de 16px iOS hace zoom al enfocar.
          className={`w-full rounded-xl border p-4 text-base focus:outline-none focus:ring-2 focus:ring-cobalt focus:border-transparent resize-none ${
            error ? "border-red-400" : "border-slate-300"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
