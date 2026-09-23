import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  children: ReactNode;
}

const variantStyles = {
  primary:
    "bg-cobalt text-white hover:bg-cobalt-600 disabled:bg-slate-200 disabled:text-slate-400",
  secondary:
    "border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50",
  ghost: "text-slate-600 hover:text-slate-900",
};

export function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  return (
    <button
      // ring-cobalt, no ring-cian: cian da 2.70:1 contra fondos claros,
      // bajo el 3:1 mínimo para indicadores de foco (WCAG 1.4.11/2.4.11).
      // cobalt da 13.78:1.
      className={`px-6 py-3 rounded-xl font-medium transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-2 ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
