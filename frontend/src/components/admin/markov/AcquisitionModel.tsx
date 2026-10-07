import { formatDecimal, formatInt } from "@/lib/admin/stats";
import { SOURCE_LABELS } from "@/lib/analytics/source";
import { CHANNELS, CHANNEL_IDS, adsRunning, adsVisitorsFor, type ChannelId } from "@/lib/markov/acquisition";
import { CHANNEL_PROPS, FIELD, sameField, type ChannelProp } from "@/lib/markov/fields";
import type { Defaults, MeasuredResult } from "@/lib/markov/measured";
import { Field, useFields, type Unit } from "./Field";
import type { Evaluated, Run } from "@/lib/markov/run";

/** Label, hint and unit of every channel box. */
const BOXES: Record<ChannelProp, { label: string; hint?: string; unit: Unit }> = {
  start: { label: "Besökare i månad 1", unit: "personer" },
  growth: { label: "Tillväxt per månad", hint: "Minus betyder att kanalen krymper.", unit: "%" },
  cap: { label: "Tak per månad", hint: "Så många kommer som mest. Tillväxten stannar här.", unit: "personer" },
  quality: { label: "Kvalitet", hint: "1 är en vanlig besökare. Över 1: fler börjar använda sidan. Under 1: färre.", unit: "×" },
  budget: { label: "Budget per månad", unit: "kr" },
  cpv: { label: "Kostnad per besökare", hint: "Vid en liten budget.", unit: "kr" },
  doubling: { label: "Dubbel kostnad vid", hint: "Budget där varje besökare kostar dubbelt. Ju mer du spenderar, desto dyrare blir nästa besökare.", unit: "kr" },
  from: { label: "Första månad", hint: "Annonserna körs från och med den här månaden.", unit: "mån" },
  to: { label: "Sista månad", unit: "mån" },
  visitors: { label: "Besökare per månad", unit: "personer" },
};

const percent = (fraction: number) => `${formatDecimal(fraction * 100)} %`;

/** A line under a channel's boxes saying what they add up to, from the plan. */
function readout(id: ChannelId, run: Run, now: Evaluated): string | null {
  const plan = run.plan;
  if (!plan) return null;
  const visitors = plan.channels[id];
  const total = visitors.reduce((a, b) => a + b, 0);
  const last = plan.months;
  if (id === "ads") {
    const ads = now.params.acquisition.ads;
    const running = Array.from({ length: last }, (_, i) => i + 1).some((month) => adsRunning(ads, month));
    if (!running) return "Inga annonser körs under perioden.";
    const bought = adsVisitorsFor(ads, ads.budget);
    return `${formatInt(bought)} besökare i månaden för ${formatInt(ads.budget)} kr: ${formatDecimal(ads.budget / bought)} kr per besökare. Totalt ${formatInt(total)} besökare.`;
  }
  return `Månad 1: ${formatInt(visitors[1])} · månad ${last}: ${formatInt(visitors[last])} · totalt ${formatInt(total)}`;
}

// ── what the site has measured ───────────────────────────────────────────────

function MeasuredPanel({ result, defaults }: { result: MeasuredResult; defaults: Defaults }) {
  if (result.status !== "ok") {
    return (
      <div className="markov-measured-panel is-missing" role="note">
        <h4>Uppmätt trafik</h4>
        {result.status === "unconfigured" && (
          <p>Databasen är inte inställd i den här miljön, så ingen uppmätt trafik kan hämtas. Exempelvärden används. (I utvecklingsläge visar <code>ADMIN_STATS_DEMO=1</code> exempeldata.)</p>
        )}
        {result.status === "missing_tables" && (
          <p>
            Tabellerna för trafikkällor finns inte i databasen än. Kör <code>supabase/migrations/20261007000000_acquisition_analytics.sql</code> (till exempel i Supabase SQL Editor): räkningen börjar när den är körd. Tills dess används exempelvärden.
          </p>
        )}
        {result.status === "error" && <p>Det gick inte att hämta den uppmätta trafiken: {result.message} Exempelvärden används.</p>}
      </div>
    );
  }

  const m = result.measured;
  const e = defaults.estimate;
  if (!e) return null;
  const monthly = CHANNEL_IDS.reduce((sum, id) => sum + e.perMonth[id], 0);

  return (
    <div className={`markov-measured-panel${e.usable ? "" : " is-missing"}`}>
      <h4>
        Uppmätt trafik
        {m.demo && <span className="markov-tag is-demo">demodata</span>}
      </h4>
      {m.demo && <p className="markov-note">Det här är exempeldata som bara finns i utvecklingsläge, inte dina riktiga besökare.</p>}
      {m.since === null ? (
        <p>Inga nya besökare är räknade än. Räkningen sker bara för besökare som godkänner cookies i bannern, och började när tabellerna skapades. Exempelvärden används tills det finns något att utgå från.</p>
      ) : (
        <>
          <p>
            {m.from} till {m.today} ({m.days} {m.days === 1 ? "dag" : "dagar"}): {formatInt(e.counted)} nya besökare godkände cookies och {formatInt(e.declined)} avböjde.
            {e.usable
              ? ` Uppskattningen räknar upp de godkända med ${formatDecimal(e.scale)} gånger, eftersom alla nya besökare är de som godkänt plus de som avböjt (och antar att de som avböjt kommer från samma håll). Det ger ungefär ${formatInt(monthly)} nya besökare i månaden.`
              : ` ${e.problem} Exempelvärden används tills det finns mer.`}
          </p>
          {e.thin && <p>Få mätpunkter än ({formatInt(e.counted)} besökare): siffrorna kan svänga mycket från vecka till vecka.</p>}
          <div className="markov-table-scroll">
            <table className="markov-table">
              <thead>
                <tr>
                  <th scope="col">Kanal</th>
                  <th scope="col">Nya besökare som godkänt</th>
                  <th scope="col">Andel</th>
                  <th scope="col">Uppskattat per månad</th>
                  <th scope="col">Största källa</th>
                </tr>
              </thead>
              <tbody>
                {CHANNEL_IDS.map((id) => (
                  <tr key={id}>
                    <th scope="row">
                      <span className={`swatch series-${id}`} aria-hidden />
                      {CHANNELS[id].label}
                    </th>
                    <td>{formatInt(m.arrivals[id])}</td>
                    <td>{e.counted > 0 ? percent(e.share[id]) : "–"}</td>
                    <td>{e.usable ? formatInt(e.perMonth[id]) : "–"}</td>
                    <td>{e.top[id] ? `${SOURCE_LABELS[e.top[id].source] ?? e.top[id].source} (${formatDecimal(e.top[id].share * 100)} %)` : "–"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Alla</th>
                  <td>{formatInt(e.counted)}</td>
                  <td>{e.counted > 0 ? percent(1) : "–"}</td>
                  <td>{e.usable ? formatInt(monthly) : "–"}</td>
                  <td>–</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="markov-note">
            {e.usable
              ? "Rutorna nedan som är märkta “uppmätt” börjar på de här siffrorna. Tillväxten börjar på 0 %: trafiken ligger kvar som nu, eftersom en utveckling över tid inte går att mäta än. Skriv över en ruta för att testa ett scenario."
              : "Rutorna nedan har exempelvärden."}{" "}
            Besökare som inte har valt i cookie-bannern, och de som har Do Not Track eller Global Privacy Control påslaget, räknas inte. Annonser syns bara om länkarna har kampanjtaggar (<code>utm_medium=cpc</code>) eller annonsnätverkets klick-id.
          </p>
        </>
      )}
    </div>
  );
}

// ── the model ────────────────────────────────────────────────────────────────

/**
 * The acquisition model: where the new visitors come from. A switch picks between the single typed number
 * and the five channels; the channels' boxes are always shown, but only used when the switch says so. They
 * start from what the site has measured (see MeasuredPanel), and any box can be typed over to test a scenario.
 */
export function AcquisitionModel({ now, measured, defaults }: { now: Evaluated; measured: MeasuredResult; defaults: Defaults }) {
  const { fields, overrides, baseline, edit, restore } = useFields();
  const manual = now.params.acquisition.mode === "manual";
  const run = now.run;
  const plan = run?.plan ?? null;
  const total = plan ? plan.total.reduce((a, b) => a + b, 0) : 0;
  const sourceChanged = baseline !== null && !sameField(FIELD.source, fields, baseline);
  const channelNames = CHANNEL_IDS.flatMap((id) => CHANNEL_PROPS[id].map((prop) => FIELD.channel(id, prop)));
  const typedChannels = channelNames.filter((name) => name in overrides);
  const measuredInUse = defaults.estimate?.usable === true;

  return (
    <section className="card markov-acq" aria-labelledby="m-acq">
      <div className="markov-acq-head">
        <div>
          <h3 id="m-acq">Förvärvsmodell</h3>
          <p className="card-sub">Var de nya besökarna kommer ifrån. Det är den här delen som fyller tillståndet “Besökt” varje månad.</p>
        </div>
        <div className="markov-acq-switch">
          <div className="range" role="group" aria-label="Varifrån kommer nya besökare?">
            <button type="button" aria-pressed={manual} onClick={() => edit(FIELD.source, "manual")}>
              Skriv in själv
            </button>
            <button type="button" aria-pressed={!manual} onClick={() => edit(FIELD.source, "channels")}>
              Från kanaler
            </button>
          </div>
          {sourceChanged && baseline && <span className="markov-was">utgångsläge: {baseline[FIELD.source] === "manual" ? "skriv in själv" : "från kanaler"}</span>}
        </div>
      </div>

      <MeasuredPanel result={measured} defaults={defaults} />

      <p className="markov-note">
        {manual
          ? `Just nu används rutan “Nya besökare per månad” (${formatInt(now.params.newVisitors)}) under Grundinställningar. Kanalerna här används inte förrän du väljer “Från kanaler”.`
          : plan
            ? `Kanalerna ger ${formatInt(plan.total[1])} besökare i månad 1 och ${formatInt(plan.total[plan.months])} i månad ${plan.months}: ${formatInt(total / plan.months)} i månaden i snitt, ${formatInt(total)} under hela perioden.`
            : "Rätta de rödmarkerade rutorna så räknas kanalerna ihop."}
      </p>

      {typedChannels.length > 0 && (
        <p className="markov-note">
          <button type="button" className="markov-button" onClick={() => restore(channelNames)}>
            {measuredInUse ? "Återställ kanalerna till uppmätt" : "Återställ kanalerna till exempelvärden"}
          </button>{" "}
          {typedChannels.length === 1 ? "En ruta" : `${typedChannels.length} rutor`} är ändrade av dig.
        </p>
      )}

      <div className={`markov-states markov-channels${manual ? " is-off" : ""}`}>
        {CHANNEL_IDS.map((id) => {
          const info = CHANNELS[id];
          const line = run ? readout(id, run, now) : null;
          return (
            <section key={id} className={`markov-state markov-channel series-${id}`} aria-labelledby={`m-channel-${id}`}>
              <h4 id={`m-channel-${id}`}>
                <span className="swatch" aria-hidden />
                {info.label}
              </h4>
              <p className="markov-desc">{info.description}</p>
              {CHANNEL_PROPS[id].map((prop) => {
                const name = FIELD.channel(id, prop);
                const box = BOXES[prop];
                return <Field key={name} name={name} label={box.label} hint={box.hint} unit={box.unit} error={now.errors[name]} />;
              })}
              {line && !manual && <p className="markov-stay">{line}</p>}
            </section>
          );
        })}
      </div>
      {manual && <p className="markov-note">Kanalernas siffror sparas ändå, så du kan förbereda dem innan du byter.</p>}
    </section>
  );
}
