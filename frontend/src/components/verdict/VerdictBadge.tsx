import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { NivelVeredicto } from "@/lib/types";

const config = {
  verde: { bg: "bg-verdict-green-bg", text: "text-verdict-green-text", Icon: CheckCircle2, label: "Apto" },
  amarillo: { bg: "bg-verdict-amber-bg", text: "text-verdict-amber-text", Icon: AlertTriangle, label: "Advertencia" },
  rojo: { bg: "bg-verdict-red-bg", text: "text-verdict-red-text", Icon: XCircle, label: "Bloqueado" },
};

export function VerdictBadge({ nivel }: { nivel: NivelVeredicto }) {
  const { bg, text, Icon, label } = config[nivel];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${bg} ${text}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {label}
    </span>
  );
}
