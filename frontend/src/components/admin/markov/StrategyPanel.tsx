import { useMemo, useState, type FormEvent } from "react";
import { formatInt } from "@/lib/admin/stats";
import type { Defaults } from "@/lib/markov/measured";
import { seriesOf } from "@/lib/markov/engine";
import { evaluate, averageVisitors, type Evaluated } from "@/lib/markov/run";
import { MAX_COMPARED, MAX_NAME_LENGTH, MAX_STRATEGIES, PRESETS, WORKING_ID, cleanName, fieldsForComparison, sameStrategy, type Strategy } from "@/lib/markov/strategies";
import { LineChart, type LineSeries } from "../stats/charts";
import { useFields } from "./Field";
import { kr, sharePercent } from "./format";
import { LineSample } from "./LineSample";
import { deleteStrategy, loadStrategy, renameStrategy, saveStrategy, updateStrategy } from "./store";

interface Item {
  id: string;
  name: string;
  description: string | null;
  overrides: Record<string, string>;
  preset: boolean;
}

const DASHES = [undefined, "9 4", "2 5", "11 3 2 3"] as const;

interface Column {
  id: string;
  label: string;
  evaluated: Evaluated;
}

/** One row of the comparison: how to read a number out of a run, how to show it, and which end of it is better. */
interface Row {
  label: string;
  value: (column: Column) => number | null;
  show: (value: number) => string;
  better?: "high" | "low";
}

const ROWS: Row[] = [
  { label: "Nya besökare per månad (snitt)", value: (c) => (c.evaluated.run ? averageVisitors(c.evaluated.run, c.evaluated.params) : null), show: formatInt },
  { label: "Premium vid slutet", value: (c) => (c.evaluated.run ? seriesOf(c.evaluated.run.sim, "premium").at(-1) ?? null : null), show: formatInt, better: "high" },
  { label: "Nya köp", value: (c) => c.evaluated.run?.economy.totals.purchases ?? null, show: formatInt, better: "high" },
  { label: "Intäkt", value: (c) => c.evaluated.run?.economy.totals.revenue ?? null, show: kr, better: "high" },
  { label: "Kostnader", value: (c) => c.evaluated.run?.economy.totals.costs ?? null, show: kr },
  { label: "Resultat", value: (c) => c.evaluated.run?.economy.totals.profit ?? null, show: kr, better: "high" },
  { label: "Kostnad per nytt köp", value: (c) => c.evaluated.run?.kpis.costPerPurchase ?? null, show: kr, better: "low" },
  { label: "Värde per 1 000 besökare", value: (c) => c.evaluated.run?.kpis.valuePer1000 ?? null, show: kr, better: "high" },
];

function breakEvenOf(column: Column, months: number): string {
  const run = column.evaluated.run;
  if (!run) return "–";
  const be = run.economy.breakEven;
  return be === "start" ? "Från början" : be === null ? `Inte inom ${months} mån` : `Månad ${be}`;
}

/**
 * Marketing strategies: save the boxes as they are under a name, load one back, and put up to four side by side
 * with the company's numbers. A strategy is only the boxes that differ from the starting values (see
 * lib/markov/strategies.ts), and every column of the comparison is run over the same number of months.
 */
export function StrategyPanel({ now, defaults, strategies, activeId }: { now: Evaluated; defaults: Defaults; strategies: Strategy[]; activeId: string | null }) {
  const { overrides } = useFields();
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null);
  const [compared, setCompared] = useState<string[]>([]);
  const months = now.params.months;

  const items: Item[] = useMemo(
    () => [
      ...PRESETS.map((p): Item => ({ id: p.id, name: p.name, description: p.description, overrides: p.overrides, preset: true })),
      ...strategies.map((s): Item => ({ id: s.id, name: s.name, description: null, overrides: s.overrides, preset: false })),
    ],
    [strategies]
  );
  const active = items.find((item) => item.id === activeId) ?? null;
  // the boxes differ from what was loaded (or, with nothing loaded, from the starting values)
  const unsaved = active ? !sameStrategy(defaults.fields, active.overrides, overrides) : Object.keys(overrides).length > 0;
  const full = strategies.length >= MAX_STRATEGIES;
  const picked = compared.filter((id) => id === WORKING_ID || items.some((item) => item.id === id));

  // each saved strategy run over the same months as the boxes now say; the boxes themselves are already run
  const saved = useMemo(
    () => {
      const byId = new Map<string, Column>();
      for (const id of compared) {
        const item = items.find((candidate) => candidate.id === id);
        if (item) byId.set(id, { id, label: item.name, evaluated: evaluate(fieldsForComparison(defaults.fields, item.overrides, String(months))) });
      }
      return byId;
    },
    [compared, items, defaults, months]
  );
  const columns: Column[] = picked.flatMap((id) => {
    const column: Column | undefined = id === WORKING_ID ? { id, label: "Nuvarande rutor", evaluated: now } : saved.get(id);
    return column ? [column] : [];
  });

  function toggle(id: string) {
    setCompared((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.length < MAX_COMPARED ? [...list, id] : list));
  }

  function load(item: Item) {
    if (unsaved && !window.confirm(`Ladda “${item.name}”? Ändringarna i rutorna ersätts.`)) return;
    loadStrategy(item.overrides, item.id);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (saveStrategy(name, overrides) !== null) setName("");
  }

  const chart: LineSeries[] = columns.flatMap((column, i) => (column.evaluated.run ? [{ key: `s${i + 1}`, label: column.label, values: column.evaluated.run.economy.cumulative, dash: DASHES[i], heavy: i === 0 }] : []));
  const broken = columns.filter((column) => !column.evaluated.run);

  return (
    <section className="card markov-strategy" aria-labelledby="m-strategy">
      <h3 id="m-strategy">Marknadsstrategi</h3>
      <p className="card-sub">
        Spara det du ser som en strategi, ladda tillbaka den senare och jämför flera sida vid sida. En strategi sparar bara de rutor du har ändrat, så den fortsätter följa nya mätningar i resten.
      </p>
      <p className="markov-note markov-active">
        {active ? (
          <>
            Rutorna utgår från <strong>{active.name}</strong>
            {unsaved ? " och är ändrade." : "."}
          </>
        ) : unsaved ? (
          "Rutorna är ändrade och hör inte till någon sparad strategi."
        ) : (
          "Rutorna visar startvärdena: uppmätt där det finns, annars exempelvärden."
        )}
      </p>

      <ul className="markov-strategies">
        {items.map((item) => {
          const isActive = item.id === activeId;
          const isRenaming = renaming?.id === item.id;
          return (
            <li key={item.id} className={isActive ? "is-active" : undefined}>
              <label className="markov-pick">
                <input type="checkbox" checked={picked.includes(item.id)} disabled={!picked.includes(item.id) && picked.length >= MAX_COMPARED} onChange={() => toggle(item.id)} />
                <span>Jämför</span>
              </label>
              <div className="markov-strategy-name">
                {isRenaming ? (
                  <form
                    className="markov-rename"
                    onSubmit={(event) => {
                      event.preventDefault();
                      renameStrategy(item.id, renaming.text);
                      setRenaming(null);
                    }}
                  >
                    <input aria-label={`Nytt namn på ${item.name}`} value={renaming.text} maxLength={MAX_NAME_LENGTH} autoFocus onChange={(event) => setRenaming({ id: item.id, text: event.target.value })} />
                    <button type="submit" className="markov-button is-small" disabled={!cleanName(renaming.text)}>
                      Spara
                    </button>
                    <button type="button" className="markov-button is-small" onClick={() => setRenaming(null)}>
                      Avbryt
                    </button>
                  </form>
                ) : (
                  <>
                    <strong>{item.name}</strong>
                    {isActive && <span className="markov-tag">{unsaved ? "ändrad" : "aktiv"}</span>}
                    {item.preset && <span className="markov-tag is-quiet">förinställd</span>}
                    {item.description && <span className="markov-strategy-desc">{item.description}</span>}
                  </>
                )}
              </div>
              {!isRenaming && (
                <div className="markov-strategy-actions">
                  <button type="button" className="markov-button is-small" onClick={() => load(item)} aria-label={`Ladda ${item.name}`}>
                    Ladda
                  </button>
                  {!item.preset && (
                    <>
                      <button type="button" className="markov-button is-small" onClick={() => updateStrategy(item.id, overrides)} aria-label={`Spara rutorna i ${item.name}`} disabled={isActive && !unsaved}>
                        Uppdatera
                      </button>
                      <button type="button" className="markov-button is-small" onClick={() => setRenaming({ id: item.id, text: item.name })} aria-label={`Byt namn på ${item.name}`}>
                        Byt namn
                      </button>
                      <button
                        type="button"
                        className="markov-button is-small"
                        aria-label={`Ta bort ${item.name}`}
                        onClick={() => {
                          if (window.confirm(`Ta bort strategin “${item.name}”?`)) deleteStrategy(item.id);
                        }}
                      >
                        Ta bort
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
        <li className="markov-working">
          <label className="markov-pick">
            <input type="checkbox" checked={picked.includes(WORKING_ID)} disabled={!picked.includes(WORKING_ID) && picked.length >= MAX_COMPARED} onChange={() => toggle(WORKING_ID)} />
            <span>Jämför</span>
          </label>
          <div className="markov-strategy-name">
            <strong>Nuvarande rutor</strong>
            <span className="markov-strategy-desc">Det du ser just nu, med ändringarna.</span>
          </div>
        </li>
      </ul>

      <form className="markov-save-strategy" onSubmit={submit}>
        <label htmlFor="m-strategy-name">Spara nuvarande rutor som ny strategi</label>
        <div>
          <input id="m-strategy-name" value={name} maxLength={MAX_NAME_LENGTH} placeholder="Namn, till exempel “SEO och annonser”" autoComplete="off" onChange={(event) => setName(event.target.value)} />
          <button type="submit" className="markov-button is-primary" disabled={!cleanName(name) || full}>
            Spara strategi
          </button>
        </div>
        {full && <span className="markov-error">Det finns plats för {MAX_STRATEGIES} egna strategier. Ta bort en först.</span>}
      </form>

      {picked.length < 2 ? (
        <p className="markov-note">Kryssa i {picked.length === 0 ? "två till fyra" : "minst en till"} strategier ovan för att jämföra dem här, upp till {MAX_COMPARED}. Alla räknas över samma {months} månader.</p>
      ) : (
        <div className="markov-compare" aria-label="Jämförelse av strategier">
          <div className="markov-table-scroll">
            <table className="markov-table">
              <thead>
                <tr>
                  <th scope="col">Efter {months} månader</th>
                  {columns.map((column, i) => (
                    <th key={column.id} scope="col" className={`markov-compare-col series-s${i + 1}`}>
                      <span className="swatch" aria-hidden />
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const values = columns.map((column) => row.value(column));
                  const known = values.filter((v): v is number => v !== null);
                  const best = row.better && known.length >= 2 && Math.max(...known) !== Math.min(...known) ? (row.better === "high" ? Math.max(...known) : Math.min(...known)) : null;
                  return (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      {values.map((value, i) => (
                        <td key={columns[i].id} className={best !== null && value === best ? "is-best" : undefined}>
                          {value === null ? "–" : row.show(value)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr>
                  <th scope="row">Break-even</th>
                  {columns.map((column) => (
                    <td key={column.id}>{breakEvenOf(column, months)}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Marginal</th>
                  {columns.map((column) => (
                    <td key={column.id}>{column.evaluated.run?.kpis.margin == null ? "–" : sharePercent(column.evaluated.run.kpis.margin)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {broken.length > 0 && <p className="markov-error">{broken.map((column) => column.label).join(", ")} går inte att räkna: någon ruta i {broken.length === 1 ? "den" : "dem"} kan inte läsas. Ladda och rätta {broken.length === 1 ? "den" : "dem"}.</p>}
          <p className="markov-note">Fetstil är bäst i raden. Resultatet är före vad en analys kostar att ta fram och före de andra kanalernas kostnader.</p>

          {chart.length > 0 && (
            <>
              <h4 className="markov-compare-title">Ackumulerat resultat</h4>
              <LineChart labels={columns[0].evaluated.run?.sim.months.map((m) => `${m} mån`) ?? []} series={chart} ariaLabel={`Ackumulerat resultat över ${months} månader för ${chart.map((s) => `${s.label} (${kr(s.values[s.values.length - 1])})`).join(", ")}.`} />
              <ul className="legend is-inline">
                {columns.map((column, i) =>
                  column.evaluated.run ? (
                    <li key={column.id} className={`series-s${i + 1}`}>
                      <LineSample dash={DASHES[i]} heavy={i === 0} />
                      {column.label}
                    </li>
                  ) : null
                )}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

