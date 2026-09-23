interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: () => void;
}

export function Checkbox({ label, checked, onChange }: CheckboxProps) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 rounded border-slate-300 text-cobalt focus:ring-cobalt"
      />
      <span className={checked ? "line-through text-slate-400" : ""}>{label}</span>
    </label>
  );
}
