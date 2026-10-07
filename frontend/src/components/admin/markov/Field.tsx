import { createContext, useContext } from "react";
import { sameField, type Fields } from "@/lib/markov/fields";

export type Unit = "%" | "personer" | "kr" | "×" | "mån";

/** Everything a number box needs to know about the boxes as a whole. */
export interface FieldsContextValue {
  /** every box's text now: the starting text, with what has been typed in over it */
  fields: Fields;
  /** every box's starting text: measured where there is measurement, the example otherwise */
  defaults: Fields;
  /** the boxes that have been typed in */
  overrides: Fields;
  /** the boxes whose starting text is measured */
  measuredNames: ReadonlySet<string>;
  /** every box as it was when the baseline was saved, or null */
  baseline: Fields | null;
  /** the person typed `value` in the box `name` */
  edit: (name: string, value: string) => void;
  /** these boxes go back to their starting text */
  restore: (names: readonly string[]) => void;
}

export const FieldsContext = createContext<FieldsContextValue | null>(null);

export function useFields(): FieldsContextValue {
  const value = useContext(FieldsContext);
  if (!value) throw new Error("useFields must be used inside the simulator");
  return value;
}

const withUnit = (value: string, unit: Unit) => (unit === "%" ? `${value} %` : `${value} ${unit}`);

/**
 * A number box: its label, the text typed so far, and what it has been compared with: a box with a measured
 * starting value says so, and says what it was when it has been typed over; against a saved baseline it says
 * what it was then. `error` is what is wrong with it, if anything.
 */
export function Field({ name, label, hint, unit, error }: { name: string; label: string; hint?: string; unit: Unit; error?: string }) {
  const { fields, defaults, overrides, measuredNames, baseline, edit, restore } = useFields();
  const id = `markov-${name.replace(/[^a-z0-9]+/gi, "-")}`;
  const changed = baseline !== null && !sameField(name, fields, baseline);
  const measured = measuredNames.has(name);
  const typedOver = name in overrides;
  return (
    <div className={`markov-field${error ? " has-error" : ""}${changed ? " is-changed" : ""}${typedOver ? " is-typed" : ""}`}>
      <label htmlFor={id}>
        <span className="markov-field-name">
          {label}
          {measured && !typedOver && <span className="markov-tag">uppmätt</span>}
        </span>
        {hint && <span className="markov-field-hint">{hint}</span>}
      </label>
      <span className="markov-input">
        <input
          id={id}
          value={fields[name] ?? ""}
          onChange={(event) => edit(name, event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span className="markov-unit">{unit}</span>
      </span>
      {measured && typedOver && (
        <span className="markov-measured">
          uppmätt: {withUnit(defaults[name], unit)}{" "}
          <button type="button" className="markov-link" onClick={() => restore([name])}>
            Återställ
          </button>
        </span>
      )}
      {changed && baseline && <span className="markov-was">utgångsläge: {withUnit(baseline[name], unit)}</span>}
      {error && (
        <span id={`${id}-error`} className="markov-error">
          {error}
        </span>
      )}
    </div>
  );
}
