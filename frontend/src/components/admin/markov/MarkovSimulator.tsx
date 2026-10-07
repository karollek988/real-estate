import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { change, formatDecimal, formatInt } from "@/lib/admin/stats";
import { seriesOf, sum, type Simulation } from "@/lib/markov/engine";
import { FIELD, effectiveFields, percentText, sameField, sameFields, type Fields } from "@/lib/markov/fields";
import type { AdminStatsResult } from "@/lib/admin/stats";
import { defaultsFor, purchaseMix, type MeasuredResult } from "@/lib/markov/measured";
import { MONTH_CHOICES, STATES, TRACKED_IDS, buildMatrix, edgeKey, edgesFrom, stayProbability, type MarkovParams, type StateId, type TrackedId } from "@/lib/markov/model";
import { LineChart, type LineSeries } from "../stats/charts";
import { Delta } from "../stats/StatsPanel";
import { AcquisitionModel } from "./AcquisitionModel";
import { ChannelResults } from "./ChannelResults";
import { Field, FieldsContext, useFields, type FieldsContextValue } from "./Field";
import { FinanceResults } from "./FinanceResults";
import { kr } from "./format";
import { LineSample } from "./LineSample";
import { RevenueModel } from "./RevenueModel";
import { StrategyPanel } from "./StrategyPanel";
import { StateDiagram, SelectedMoves } from "./StateDiagram";
import { COHORT_SIZE, averageVisitors, endPopulations, evaluate, sameLength, type Evaluated, type Run } from "@/lib/markov/run";
import { clearBaseline, clearFields, getServerSettings, getSettings, resetFields, saveBaseline, setField, subscribe } from "./store";

const percent = (fraction: number) => `${percentText(fraction)} %`;
/** 0.033 -> "3,3 %": a share with one decimal, since the interesting shares are small */
const share = (fraction: number) => `${formatDecimal(fraction * 100)} %`;
const months = (value: number) => `${formatDecimal(value)} månader`;

// How each state's line looks in the population chart: colour comes from the stylesheet, and the
// dash pattern makes lines of similar colour distinguishable without it.
const LINE_STYLE: Record<TrackedId, { dash?: string; heavy?: boolean }> = {
  visited: { dash: "2 5" },
  engaged: {},
  registered: { dash: "9 4" },
  premium: { heavy: true },
  inactive: { dash: "2 5" },
  churned: { dash: "9 4" },
  reactivated: { dash: "11 3 2 3" },
  bounced: { dash: "2 5" },
};

// Bounce and visited are the biggest numbers and are not what is being decided: they would flatten the others.
const SHOWN_AT_FIRST: readonly TrackedId[] = ["engaged", "registered", "premium", "inactive", "churned"];

// ── the page ─────────────────────────────────────────────────────────────────

export function MarkovSimulator({ measured, stats }: { measured: MeasuredResult; stats: AdminStatsResult }) {
  const { overrides, baseline, strategies, activeId } = useSyncExternalStore(subscribe, getSettings, getServerSettings);
  // every box starts from the example numbers, with what has been measured laid over them; what the
  // person has typed goes on top of that. A box typed to the same text as its starting text is not "typed".
  // (the package mix comes from the real purchases the statistics page has already read)
  const mix = useMemo(() => (stats.status === "ok" ? purchaseMix(stats.stats.days) : null), [stats]);
  const defaults = useMemo(() => defaultsFor(measured.status === "ok" ? measured.measured : null, mix), [measured, mix]);
  const fields = useMemo(() => effectiveFields(defaults.fields, overrides), [defaults, overrides]);
  const edit = useCallback((name: string, value: string) => (value === defaults.fields[name] ? clearFields([name]) : setField(name, value)), [defaults]);
  const context = useMemo<FieldsContextValue>(
    () => ({ fields, defaults: defaults.fields, overrides, measuredNames: defaults.measuredNames, baseline, edit, restore: clearFields }),
    [fields, defaults, overrides, baseline, edit]
  );
  const [selected, setSelected] = useState<StateId | null>("visited");
  const [shown, setShown] = useState<readonly TrackedId[]>(SHOWN_AT_FIRST);

  const now = useMemo(() => evaluate(fields), [fields]);
  const reference = useMemo(() => (baseline ? evaluate(baseline) : null), [baseline]);
  const referenceRun = reference?.run ?? null;
  const errorCount = Object.keys(now.errors).length;
  const hasChanges = baseline !== null && !sameFields(fields, baseline);
  const atEnd = now.run ? endPopulations(now.run.sim) : null;

  return (
    <FieldsContext.Provider value={context}>
    <div className="markov">
      <div className="stats-head">
        <div>
          <h2>Markov-simulator</h2>
          <p className="stats-sub">Testa olika scenarier inför marknadsföringsbeslut: vad händer med kunderna månad för månad?</p>
        </div>
      </div>

      <p className="stats-banner is-demo" role="note">
        <strong>Exempelsiffror.</strong> Sannolikheterna nedan är antaganden, inte mätningar: webbplatsen mäter ännu inte registrering, engagemang eller återkomst. Byt ut dem mot egna uppskattningar och jämför scenarier. Allt sparas bara i den här webbläsaren.
      </p>

      <Pipeline />

      <LiveBar now={now} errorCount={errorCount} referenceRun={referenceRun} />

      <StrategyPanel now={now} defaults={defaults} strategies={strategies} activeId={activeId} />

      <Settings now={now} hasChanges={hasChanges} />

      <AcquisitionModel now={now} measured={measured} defaults={defaults} />

      <section className="card markov-diagram-card" aria-labelledby="m-diagram">
        <h3 id="m-diagram">Kundens tillstånd</h3>
        <p className="card-sub">Nio tillstånd. Varje månad flyttar människor mellan dem, eller stannar.</p>
        <StateDiagram params={now.params} populations={atEnd} sourceLabel={sourceLabel(now)} selected={selected} onSelect={setSelected} />
        <SelectedMoves params={now.params} selected={selected} />
      </section>

      {now.run ? (
        <>
          <Results run={now.run} params={now.params} referenceRun={referenceRun} shown={shown} onToggle={(id) => setShown((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))} />
          <FinanceResults run={now.run} params={now.params} referenceRun={referenceRun} />
        </>
      ) : (
        <div className="stats-notice" role="status">
          <h2>Resultatet väntar</h2>
          <p>{errorCount === 1 ? "En ruta går inte att räkna med" : `${errorCount} rutor går inte att räkna med`}. Rätta de rödmarkerade rutorna här under, så räknas allt om direkt.</p>
        </div>
      )}

      <section className="markov-editor" aria-labelledby="m-editor">
        <div className="stats-head">
          <div>
            <h3 id="m-editor">Sannolikheter per månad</h3>
            <p className="stats-sub">Hur stor andel av människorna i ett tillstånd som går vidare till ett annat under en månad. Det som blir över stannar kvar.</p>
          </div>
        </div>
        <div className="markov-states">
          {TRACKED_IDS.map((id) => (
            <StateCard key={id} id={id} errors={now.errors} params={now.params} />
          ))}
        </div>
      </section>

      <RevenueModel now={now} defaults={defaults} />

      {now.run && <Tables run={now.run} params={now.params} />}
      <Explanation />
    </div>
    </FieldsContext.Provider>
  );
}

/** What the "S0" box in the diagram says: the monthly visitors, as a figure or - from channels - an average. */
function sourceLabel(now: Evaluated): string {
  if (now.params.acquisition.mode === "manual") return `${formatInt(now.params.newVisitors)} / mån`;
  return now.run ? `Ø ${formatInt(averageVisitors(now.run, now.params))} / mån` : "kanaler";
}

// ── how the model fits into the larger plan ──────────────────────────────────

const PIPELINE = [
  { name: "Marknadsstrategi", note: "Sparade strategier, jämförda sida vid sida", built: true },
  { name: "Förvärvsmodell", note: "Sökmotorer, annonser, sociala medier, AI-sökmotorer", built: true },
  { name: "Nya potentiella användare", note: "Summan av kanalerna, eller ett tal du skriver in", built: true },
  { name: "Markov-modell", note: "Den här sidan", built: true },
  { name: "Intäkter och kostnader", note: "Paketmix, moms, avgifter, fasta kostnader", built: true },
  { name: "Företagets nyckeltal", note: "Resultat, break-even, kostnad per köp, värde per besökare", built: true },
] as const;

function Pipeline() {
  return (
    <ol className="markov-pipeline" aria-label="Så hänger simulatorn ihop med resten av planen">
      {PIPELINE.map((step) => (
        <li key={step.name} className={step.built ? "is-built" : undefined}>
          <span className="markov-pipeline-name">{step.name}</span>
          <span className="markov-pipeline-note">{step.note}</span>
          <span className={step.built ? "markov-pipeline-tag is-built" : "markov-pipeline-tag"}>{step.built ? "Byggd" : "Kommer"}</span>
        </li>
      ))}
    </ol>
  );
}

// ── the headline numbers, kept in view while the boxes are edited ───────────

function LiveBar({ now, errorCount, referenceRun }: { now: Evaluated; errorCount: number; referenceRun: Run | null }) {
  if (!now.run) {
    return (
      <div className="markov-live is-error">
        <span>{errorCount === 1 ? "En ruta behöver rättas" : `${errorCount} rutor behöver rättas`}: resultatet räknas om så fort de går att läsa.</span>
      </div>
    );
  }
  const { run } = now;
  const premium = seriesOf(run.sim, "premium")[run.sim.months.length - 1];
  const compare = sameLength(run, referenceRun) && referenceRun ? change(premium, seriesOf(referenceRun.sim, "premium")[referenceRun.sim.months.length - 1]) : null;
  return (
    <div className="markov-live">
      <span className="markov-live-stat">
        <span className="markov-live-label">Premium efter {run.cohort.months} mån</span>
        <strong>{formatInt(premium)}</strong>
        {compare !== null && <Delta value={compare} />}
      </span>
      <span className="markov-live-stat">
        <span className="markov-live-label">Blir premium</span>
        <strong>{share(run.cohort.everPremium)}</strong>
      </span>
      <span className="markov-live-stat">
        <span className="markov-live-label">Resultat efter {run.cohort.months} mån</span>
        <strong>{kr(run.economy.totals.profit)}</strong>
        {referenceRun && sameLength(run, referenceRun) && <AmountChange now={run.economy.totals.profit} before={referenceRun.economy.totals.profit} />}
      </span>
      <span className="markov-live-stat is-optional">
        <span className="markov-live-label">{now.params.acquisition.mode === "channels" ? "Nya besökare / mån, snitt" : "Nya besökare / mån"}</span>
        <strong>{formatInt(averageVisitors(run, now.params))}</strong>
      </span>
    </div>
  );
}

/** "▲ 5 000 kr": the change in an amount that may be negative. */
function AmountChange({ now, before }: { now: number; before: number }) {
  const diff = now - before;
  if (Math.abs(diff) < 0.5) return <span className="delta is-flat">▬ oförändrat</span>;
  return diff > 0 ? <span className="delta is-up">▲ {kr(diff)}</span> : <span className="delta is-down">▼ {kr(-diff)}</span>;
}

// ── settings: the few numbers that are not chances ───────────────────────────

function Settings({ now, hasChanges }: { now: Evaluated; hasChanges: boolean }) {
  const { fields, baseline, edit } = useFields();
  const canSave = now.run !== null;
  return (
    <section className="card markov-settings" aria-labelledby="m-settings">
      <h3 id="m-settings">Grundinställningar</h3>
      <div className="markov-settings-grid">
        {now.params.acquisition.mode === "manual" ? (
          <Field name={FIELD.newVisitors} label="Nya besökare per månad" hint="Så många kommer in i “Besökt” varje månad. Eller välj “Från kanaler” i förvärvsmodellen här under, så räknas talet fram av kanalerna." unit="personer" error={now.errors[FIELD.newVisitors]} />
        ) : (
          <div className="markov-field">
            <span className="markov-field-name">Nya besökare per månad</span>
            <p className="markov-readout">
              {now.run?.plan ? `Från kanalerna: ${formatInt(now.run.plan.total[1])} i månad 1, ${formatInt(now.run.plan.total[now.params.months])} i månad ${now.params.months}` : "Väntar på att kanalernas rutor rättas"}
            </p>
            <span className="markov-field-hint">Räknas fram av förvärvsmodellen här under. Välj “Skriv in själv” där för att i stället skriva ett eget tal.</span>
          </div>
        )}
        <div className="markov-field">
          <span className="markov-field-name" id="m-months-label">
            Antal månader att räkna
          </span>
          <div className="range" role="group" aria-labelledby="m-months-label">
            {MONTH_CHOICES.map((count) => (
              <button key={count} type="button" aria-pressed={now.params.months === count} onClick={() => edit(FIELD.months, String(count))}>
                {count} mån
              </button>
            ))}
          </div>
          {baseline !== null && !sameField(FIELD.months, fields, baseline) && <span className="markov-was">utgångsläge: {baseline[FIELD.months]} mån</span>}
        </div>
      </div>

      <details className="markov-details">
        <summary>Startläge: människor som redan finns i tillstånden</summary>
        <p className="markov-note">Lämna på 0 för att börja från noll. Fyll i om du vill räkna framåt från en känd situation, till exempel hur många betalande kunder som redan finns.</p>
        <div className="markov-initial">
          {TRACKED_IDS.map((id) => (
            <Field key={id} name={FIELD.initial(id)} label={`${STATES[id].code} ${STATES[id].label}`} unit="personer" error={now.errors[FIELD.initial(id)]} />
          ))}
        </div>
      </details>

      <div className="markov-actions">
        <button type="button" className="markov-button is-primary" disabled={!canSave} onClick={() => saveBaseline(fields)}>
          {baseline ? "Spara om som utgångsläge" : "Spara som utgångsläge"}
        </button>
        {baseline && (
          <button type="button" className="markov-button" onClick={clearBaseline}>
            Ta bort utgångsläget
          </button>
        )}
        <button
          type="button"
          className="markov-button"
          onClick={() => {
            if (window.confirm("Återställa alla rutor till startvärdena (uppmätt där det finns, annars exempelvärden)? Dina ändringar går förlorade.")) resetFields();
          }}
        >
          Återställ allt
        </button>
      </div>
      <p className="markov-note">
        {baseline
          ? hasChanges
            ? "Ändrade rutor är markerade och visar vad de var i utgångsläget. Diagrammen och nyckeltalen jämför med det."
            : "Inga ändringar mot utgångsläget än. Ändra en ruta för att se skillnaden."
          : "Tips: spara först dina nuvarande siffror som utgångsläge, ändra sedan en ruta (till exempel hur många som registrerar sig) och se vad det gör."}
      </p>
    </section>
  );
}

// ── one state's moves out ───────────────────────────────────────────────────

function StateCard({ id, errors, params }: { id: TrackedId; errors: Record<string, string>; params: MarkovParams }) {
  const info = STATES[id];
  const rowError = errors[FIELD.row(id)];
  const stay = stayProbability(params.transitions, id);
  return (
    <section className={`markov-state series-${id}`} aria-labelledby={`m-state-${id}`}>
      <h4 id={`m-state-${id}`}>
        <span className="swatch" aria-hidden />
        {info.code} {info.label}
      </h4>
      <p className="markov-desc">{info.description}</p>
      {edgesFrom(id).map((edge) => {
        const name = FIELD.edge(edgeKey(edge.from, edge.to));
        return <Field key={name} name={name} label={`till ${STATES[edge.to].code} ${STATES[edge.to].label}`} hint={edge.hint} unit="%" error={errors[name]} />;
      })}
      {rowError ? (
        <p className="markov-error">{rowError}</p>
      ) : (
        <p className="markov-stay">
          Stannar kvar: <strong>{percent(Math.max(0, stay))}</strong>
        </p>
      )}
    </section>
  );
}

// ── results ──────────────────────────────────────────────────────────────────

function Metric({ label, value, note, delta }: { label: string; value: string; note?: ReactNode; delta?: number | null }) {
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {delta !== undefined && delta !== null && (
        <p className="kpi-delta">
          <Delta value={delta} /> <span>mot utgångsläget</span>
        </p>
      )}
      {note && <p className="kpi-note">{note}</p>}
    </div>
  );
}

function Results({ run, params, referenceRun, shown, onToggle }: { run: Run; params: MarkovParams; referenceRun: Run | null; shown: readonly TrackedId[]; onToggle: (id: TrackedId) => void }) {
  const { sim } = run;
  const last = sim.months.length - 1;
  const labels = sim.months.map((m) => `${m} mån`);
  const premium = seriesOf(sim, "premium");
  const entries = sum(sim.premiumEntries);
  const comparable = sameLength(run, referenceRun) && referenceRun !== null;
  const ref = comparable ? referenceRun : null;
  const refPremium = ref ? seriesOf(ref.sim, "premium")[ref.sim.months.length - 1] : null;
  const refEntries = ref ? sum(ref.sim.premiumEntries) : null;
  const refMonthsOff = referenceRun !== null && !comparable;

  const populationSeries: LineSeries[] = TRACKED_IDS.filter((id) => shown.includes(id)).map((id) => ({ key: id, label: `${STATES[id].label}`, values: seriesOf(sim, id), ...LINE_STYLE[id] }));

  const compareLines = (pick: (s: Simulation) => number[]): LineSeries[] => [
    { key: "run", label: "Nu", values: pick(sim), heavy: true },
    ...(referenceRun ? [{ key: "reference", label: "Utgångsläge", values: pick(referenceRun.sim).slice(0, sim.months.length), dash: "9 4" }] : []),
  ];

  const distribution = TRACKED_IDS.map((id) => ({ id, count: run.cohort.distribution[id] }));

  return (
    <section className="markov-results" aria-labelledby="m-results">
      <div className="stats-head">
        <div>
          <h3 id="m-results">Resultat efter {params.months} månader</h3>
          <p className="stats-sub">Förväntade antal människor, beräknade på de siffror som står i rutorna.</p>
        </div>
      </div>

      {refMonthsOff && referenceRun && (
        <p className="stats-banner" role="note">
          Utgångsläget räknades på {referenceRun.cohort.months} månader. Nyckeltalen jämförs först när du väljer lika många månader; diagrammen visar båda så långt de räcker.
        </p>
      )}

      <div className="kpis">
        <Metric
          label={`Premium efter ${params.months} mån`}
          value={formatInt(premium[last])}
          delta={refPremium !== null ? change(premium[last], refPremium) : null}
          note="Betalande kunder i tillståndet Premium vid slutet."
        />
        <Metric
          label="Nya premiumkunder"
          value={formatInt(entries)}
          delta={refEntries !== null ? change(entries, refEntries) : null}
          note="Hur många gånger någon blir premium under perioden, summerat."
        />
        <Metric
          label="Blir premium"
          value={share(run.cohort.everPremium)}
          delta={ref ? change(run.cohort.everPremium, ref.cohort.everPremium) : null}
          note={`Av nya besökare: andelen som är premium någon gång inom ${params.months} månader.`}
        />
        <Metric
          label="Tid till första premium"
          value={run.cohort.meanMonthsToPremium === null ? "–" : months(run.cohort.meanMonthsToPremium)}
          note={ref ? (ref.cohort.meanMonthsToPremium === null ? "Utgångsläge: ingen blir premium" : `Utgångsläge: ${months(ref.cohort.meanMonthsToPremium)}`) : "I snitt, för dem som blir premium."}
        />
      </div>

      <div className="stats-grid">
        <section className="card card-wide" aria-labelledby="m-population">
          <h3 id="m-population">Människor per tillstånd</h3>
          <p className="card-sub">Antal personer i varje tillstånd vid slutet av månaden. Välj vilka som ska visas.</p>
          <LineChart
            labels={labels}
            series={populationSeries}
            ariaLabel={`Antal personer per tillstånd över ${params.months} månader. Vid slutet: ${populationSeries.map((s) => `${s.label} ${formatInt(s.values[last])}`).join(", ") || "inga tillstånd valda"}.`}
          />
          <ul className="legend is-inline markov-chips" aria-label="Tillstånd i diagrammet">
            {TRACKED_IDS.map((id) => (
              <li key={id}>
                <button type="button" className={`markov-chip series-${id}`} aria-pressed={shown.includes(id)} onClick={() => onToggle(id)}>
                  <LineSample {...LINE_STYLE[id]} />
                  {STATES[id].label}
                  <span className="legend-count">{formatInt(seriesOf(sim, id)[last])}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card" aria-labelledby="m-cohort">
          <h3 id="m-cohort">Vad blir det av {formatInt(COHORT_SIZE)} nya besökare?</h3>
          <p className="card-sub">Där de befinner sig efter {params.months} månader, om inga fler kommer till.</p>
          <ul className="bars">
            {distribution.map(({ id, count }) => (
              <li key={id}>
                <div className="bars-row">
                  <span className="bars-label">{STATES[id].label}</span>
                  <span className="bars-count">
                    {formatInt(count)} <span className="bars-share">({share(count / COHORT_SIZE)})</span>
                  </span>
                </div>
                <div className="bars-track" aria-hidden>
                  <div className={`bars-fill series-${id}`} style={{ width: `${(count / COHORT_SIZE) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="markov-note">
            {run.cohort.meanMonthsToPremium === null
              ? "Ingen av dem blir premium med de här siffrorna."
              : `${formatInt(run.cohort.everPremium * COHORT_SIZE)} av ${formatInt(COHORT_SIZE)} blir premium någon gång, i snitt efter ${formatDecimal(run.cohort.meanMonthsToPremium)} månader. Räknat per besökare är det ${formatDecimal(run.cohort.premiumMonthsPerVisitor)} månader som premium.`}
          </p>
        </section>

        <section className="card card-wide" aria-labelledby="m-premium">
          <h3 id="m-premium">Premium över tid{referenceRun ? ": nu mot utgångsläget" : ""}</h3>
          <p className="card-sub">Betalande kunder vid slutet av varje månad.</p>
          <LineChart
            labels={labels}
            series={compareLines((s) => seriesOf(s, "premium"))}
            ariaLabel={`Premium-kunder över ${params.months} månader: ${formatInt(premium[last])} vid slutet${refPremium !== null ? `, utgångsläget ${formatInt(refPremium)}` : ""}.`}
          />
          <CompareLegend withReference={referenceRun !== null} />
        </section>

        <section className="card" aria-labelledby="m-entries">
          <h3 id="m-entries">Nya premiumkunder per månad</h3>
          <p className="card-sub">Hur många som blir premium varje månad.</p>
          <LineChart
            labels={labels}
            series={compareLines((s) => s.premiumEntries)}
            ariaLabel={`Nya premiumkunder per månad: ${formatInt(sim.premiumEntries[last])} den sista månaden, ${formatInt(entries)} totalt.`}
          />
          <CompareLegend withReference={referenceRun !== null} />
        </section>

        <ChannelResults run={run} months={params.months} />
      </div>
    </section>
  );
}

function CompareLegend({ withReference }: { withReference: boolean }) {
  return (
    <ul className="legend is-inline">
      <li className="series-run">
        <LineSample heavy />
        Nu
      </li>
      {withReference && (
        <li className="series-reference">
          <LineSample dash="9 4" />
          Utgångsläge
        </li>
      )}
    </ul>
  );
}

// ── the numbers behind the charts, and how it is counted ─────────────────────

function Tables({ run, params }: { run: Run; params: MarkovParams }) {
  const matrix = useMemo(() => buildMatrix(params.transitions), [params.transitions]);
  const { sim } = run;
  return (
    <section className="markov-tables" aria-label="Tabeller">
      <details className="markov-details card">
        <summary>Månad för månad</summary>
        <p className="markov-note">Antal personer i varje tillstånd vid slutet av månaden. Månad 0 är startläget.</p>
        <div className="markov-table-scroll">
          <table className="markov-table">
            <thead>
              <tr>
                <th scope="col">Månad</th>
                {TRACKED_IDS.map((id) => (
                  <th key={id} scope="col">
                    {STATES[id].label}
                  </th>
                ))}
                <th scope="col">Nya premium</th>
              </tr>
            </thead>
            <tbody>
              {sim.populations.map((row, t) => (
                <tr key={t}>
                  <th scope="row">{t}</th>
                  {row.map((value, i) => (
                    <td key={TRACKED_IDS[i]}>{formatInt(value)}</td>
                  ))}
                  <td>{formatInt(sim.premiumEntries[t])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="markov-details card">
        <summary>Övergångsmatrisen</summary>
        <p className="markov-note">Raden är var man är, kolumnen är var man är en månad senare, i procent. Varje rad blir 100 %: det som inte är en flytt är att stanna.</p>
        <div className="markov-table-scroll">
          <table className="markov-table is-matrix">
            <thead>
              <tr>
                <th scope="col">Från ↓ till →</th>
                {TRACKED_IDS.map((id) => (
                  <th key={id} scope="col">
                    {STATES[id].code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={TRACKED_IDS[i]}>
                  <th scope="row">
                    {STATES[TRACKED_IDS[i]].code} {STATES[TRACKED_IDS[i]].label}
                  </th>
                  {row.map((value, j) => (
                    <td key={TRACKED_IDS[j]} className={i === j ? "is-stay" : value > 0 ? "is-move" : undefined}>
                      {value > 0 ? percentText(value) : "–"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function Explanation() {
  return (
    <details className="markov-details card">
      <summary>Så räknar simulatorn</summary>
      <div className="markov-prose">
        <p>
          Varje person är i ett av nio tillstånd. En gång i månaden flyttar personen till ett annat tillstånd, eller stannar, med de sannolikheter du har angett. Det är en Markov-kedja: vart någon går beror bara på var personen är nu, inte på hur den kom dit.
        </p>
        <p>
          Simulatorn räknar förväntade antal människor, inte slumpade enskilda personer. Samma siffror ger därför alltid samma resultat, och ett decimaltal som “795,3 personer” är ett medelvärde, inte ett fel.
        </p>
        <p>
          Varje månad kommer de nya besökarna in i Besökt, och sedan flyttar alla enligt matrisen. Den som kommer i månad 3 kan alltså redan bli engagerad i månad 3. S0 “Aldrig besökt” är ingen grupp som räknas: den är källan som nya besökare kommer ur.
        </p>
        <p>
          Hur många de nya besökarna är kommer från förvärvsmodellen, eller från rutan “Nya besökare per månad” om du skriver in själv. Sökmotorer, sociala medier och AI-sökmotorer börjar på en nivå och växer med en procentsats varje månad, upp till ett tak. Annonser kostar en budget: varje besökare kostar mer ju mer som spenderas (kostnaden per besökare är den vid liten budget gånger 1 + budget ÷ “dubbel kostnad vid”), så fler kronor ger fler besökare men aldrig hur många som helst. Direkt och hänvisning är ett fast tal.
        </p>
        <p>
          Kvalitet säger hur ofta en besökare från kanalen börjar använda sidan jämfört med den vanliga besökaren: 1,4 betyder 40 % oftare. Det extra tas från dem som annars hade lämnat direkt, så andelen som över huvud taget bestämmer sig är oförändrad, och ingen kanal kan få fler att engagera sig än de som bestämmer sig. Kvaliteten gäller bara så länge en besökare är i Besökt; efter det är alla likadana.
        </p>
        <p>
          Premium betyder betalande kund. Webbplatsen säljer engångspaket och inte prenumeration, så “Premium” står just nu för att ha köpt. Hur intäkter följer av Premium bestäms när intäktsdelen byggs.
        </p>
        <p>
          “Vad blir det av 1 000 nya besökare?” följer en enda grupp och ingen annan, vilket visar hur lång vägen från besökare till kund är. “Blir premium” räknar en person som varit premium någon gång, även om personen sedan har lämnat.
        </p>
        <p>
          Varje gång någon går in i Premium räknas det som ett köp av ett av tre paket. Priserna står inklusive moms, så intäkten är priset delat med 1 + momsen. Av varje köp går en betalavgift (en procent av det kunden betalar plus ett fast belopp), och varje månad kostar annonserna och de fasta kostnaderna. Resultatet är intäkt minus de tre. Någon som blir kvar i Premium betalar inte igen; för att köpa igen måste personen lämna Premium och komma tillbaka, vilket modellen tillåter.
        </p>
        <p>
          Vad en analys kostar att ta fram, vad de andra kanalerna än annonser kostar, rabattkoder, återbetalningar och skatter ingår inte, så resultatet är för gott. Break-even är den månad då det ackumulerade resultatet är tillbaka på noll efter att ha varit under. Värdet av 1 000 besökare räknas på samma sätt som “Vad blir det av 1 000 nya besökare?” och gäller därför hela perioden från ankomsten.
        </p>
        <p>
          En strategi är ett namn på de rutor du har ändrat. Jämförelsen kör varje strategi över lika många månader som rutorna nu säger, med startvärdena (uppmätta där det finns) som grund för allt som inte ändrats.
        </p>
        <p>Ett utgångsläge är en sparad kopia av rutorna. Ändrade rutor markeras, och diagram och nyckeltal jämför med kopian. Allt sparas bara i den här webbläsaren.</p>
      </div>
    </details>
  );
}
