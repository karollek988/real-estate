const inputClasses =
  "rounded-xl border border-white/10 bg-ka-ink/40 px-4 py-3 text-sm text-white placeholder:text-white/45 outline-none transition focus:border-ka-mint/60 focus:ring-4 focus:ring-ka-mint/10";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Short clarifying caption shown below the input, e.g. to disambiguate a field from a similarly-named one. */
  hint?: string;
}

export function Field({ label, id, required, hint, ...inputProps }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-white/80">
        {label}
        {required && <span className="ml-0.5 text-ka-coral-300">*</span>}
      </label>
      <input id={id} required={required} {...inputProps} className={inputClasses} />
      {hint && <p className="text-xs text-white/45">{hint}</p>}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  id: string;
  name?: string;
  /** A choice is its value alone, or a value (what is saved) with a label (what is shown). */
  options: readonly (string | { value: string; label: string })[];
  placeholder?: string;
  required?: boolean;
  /** Uncontrolled initial value (e.g. pre-filling from screenshot extraction). Ignored if `onChange` is passed. */
  defaultValue?: string | null;
  /** Pairs with `onChange` to make this a controlled select (needed when a parent must react to the choice). */
  value?: string;
  onChange?: (value: string) => void;
}

export function SelectField({
  label,
  id,
  name,
  options,
  placeholder,
  required,
  defaultValue,
  value,
  onChange,
}: SelectFieldProps) {
  const controlled = onChange !== undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-white/80">
        {label}
        {required && <span className="ml-0.5 text-ka-coral-300">*</span>}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        className={`${inputClasses} bg-ka-green-950`}
        {...(controlled
          ? { value: value ?? "", onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value) }
          : { defaultValue: defaultValue ?? "" })}
      >
        <option value="" disabled>
          {placeholder ?? "Select"}
        </option>
        {options.map((option) => {
          const { value: optionValue, label: optionLabel } = typeof option === "string" ? { value: option, label: option } : option;
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </div>
  );
}
