const inputClasses =
  "rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-green-500/60 focus:ring-4 focus:ring-green-500/10";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Field({ label, id, ...inputProps }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-neutral-200">
        {label}
      </label>
      <input id={id} {...inputProps} className={inputClasses} />
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  id: string;
  name?: string;
  options: string[];
  placeholder?: string;
}

export function SelectField({ label, id, name, options, placeholder }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-neutral-200">
        {label}
      </label>
      <select id={id} name={name} defaultValue="" className={`${inputClasses} bg-[#0d1114]`}>
        <option value="" disabled>
          {placeholder ?? "Select"}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
