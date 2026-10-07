import type { ReactNode } from "react";
import { formatDecimal, formatInt } from "@/lib/admin/stats";
import { CHANNELS } from "@/lib/markov/acquisition";
import type { MarkovParams } from "@/lib/markov/model";
import { sameLength, type Run } from "@/lib/markov/run";
import { LineChart, type LineSeries } from "../stats/charts";
import { kr, krDecimal, sharePercent } from "./format";
import { LineSample } from "./LineSample";

/** "▲ 5 000 kr mer": the change in an amount (which may be negative, so a percentage would mislead). */
function AmountDelta({ now, before }: { now: number; before: number }) {
  const diff = now - before;
  if (Math.abs(diff) < 0.5) return <span className="delta is-flat">▬ oförändrat</span>;
  return diff > 0 ? <span className="delta is-up">▲ {kr(diff)} mer</span> : <span className="delta is-down">▼ {kr(-diff)} mindre</span>;
}

function Money({ label, value, note, delta }: { label: string; value: string; note?: ReactNode; delta?: ReactNode }) {
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {delta && (
        <p className="kpi-delta">
          {delta} <span>mot utgångsläget</span>
        </p>
      )}
      {note && <p className="kpi-note">{note}</p>}
    </div>
  );
}

const breakEvenText = (breakEven: Run["economy"]["breakEven"], months: number) => (breakEven === "start" ? "Från första månaden" : breakEven === null ? `Inte inom ${months} mån` : `Månad ${breakEven}`);

/**
 * What the simulation comes to in money: revenue, costs and profit, when the company breaks even, what a purchase,
 * a visitor and a customer are worth, and how each channel pays. Everything is from lib/markov/finance.ts; the notes
 * say what is not counted.
 */
export function FinanceResults({ run, params, referenceRun }: { run: Run; params: MarkovParams; referenceRun: Run | null }) {
  const eco = run.economy;
  const k = run.kpis;
  const months = params.months;
  const labels = run.sim.months.map((m) => `${m} mån`);
  const comparable = sameLength(run, referenceRun) && referenceRun ? referenceRun : null;
  const ref = comparable?.economy ?? null;
  const per = eco.perPurchase;

  const monthly: LineSeries[] = [
    { key: "revenue", label: "Intäkt", values: eco.revenue },
    { key: "costs", label: "Kostnader", values: eco.costs, dash: "9 4" },
    { key: "profit", label: "Resultat", values: eco.profit, heavy: true },
  ];
  const cumulative: LineSeries[] = [
    { key: "run", label: "Nu", values: eco.cumulative, heavy: true },
    ...(referenceRun ? [{ key: "reference", label: "Utgångsläge", values: referenceRun.economy.cumulative.slice(0, run.sim.months.length), dash: "9 4" }] : []),
  ];
  const costShares = [
    { key: "ads", label: "Annonser", amount: eco.totals.adSpend },
    { key: "fees", label: "Betalavgifter", amount: eco.totals.fees },
    { key: "fixed", label: "Fasta kostnader", amount: eco.totals.fixed },
  ];
  const channels = run.channels;
  const contribution = channels ? channels.reduce((sum, c) => sum + c.contribution, 0) : 0;

  return (
    <section className="markov-results" aria-labelledby="m-finance">
      <div className="stats-head">
        <div>
          <h3 id="m-finance">Ekonomi efter {months} månader</h3>
          <p className="stats-sub">Intäkter utan moms, minus betalavgifter, annonser och fasta kostnader. Vad en analys kostar att ta fram ingår inte.</p>
        </div>
      </div>

      <div className="kpis">
        <Money
          label="Intäkt"
          value={kr(eco.totals.revenue)}
          delta={ref ? <AmountDelta now={eco.totals.revenue} before={ref.totals.revenue} /> : null}
          note={`${formatInt(eco.totals.purchases)} köp à ${krDecimal(per.revenue)} utan moms.`}
        />
        <Money
          label="Resultat"
          value={kr(eco.totals.profit)}
          delta={ref ? <AmountDelta now={eco.totals.profit} before={ref.totals.profit} /> : null}
          note={k.margin === null ? "Ingen intäkt än." : `${sharePercent(k.margin)} av intäkten. ${eco.firstProfitMonth === null ? "Ingen månad med vinst." : `Första vinstmånaden: ${eco.firstProfitMonth}.`}`}
        />
        <Money
          label="Break-even"
          value={breakEvenText(eco.breakEven, months)}
          note={eco.breakEven === "start" ? "Det ackumulerade resultatet är aldrig under noll." : eco.breakEven === null ? "Det ackumulerade resultatet når inte noll inom perioden." : "Månaden då det ackumulerade resultatet är tillbaka på noll."}
        />
        <Money
          label="Kostnad per nytt köp"
          value={k.costPerPurchase === null ? "–" : kr(k.costPerPurchase)}
          note={k.costPerPurchase === null ? "Inga köp." : `Annonser och fasta kostnader.${k.adCostPerPurchase === null ? "" : ` Annonserna ensamma: ${kr(k.adCostPerPurchase)}.`} Ett köp ger ${krDecimal(per.net)} efter avgift.`}
        />
        <Money label="Värde per 1 000 besökare" value={kr(k.valuePer1000)} note={`Vad 1 000 nya besökare ger på ${months} månader: intäkt efter betalavgifter, utan moms.`} />
        <Money
          label="Värde per betalande kund"
          value={k.valuePerCustomer === null ? "–" : kr(k.valuePerCustomer)}
          note={k.purchasesPerCustomer === null ? "Ingen blir kund." : `${formatDecimal(k.purchasesPerCustomer)} köp per betalande kund (den som köper igen räknas igen).`}
        />
      </div>

      <div className="stats-grid">
        <section className="card card-wide" aria-labelledby="m-money-month">
          <h3 id="m-money-month">Intäkter, kostnader och resultat per månad</h3>
          <p className="card-sub">Intäkten kommer den månad köpet görs. Kostnaderna är annonser, betalavgifter och fasta kostnader.</p>
          <LineChart
            labels={labels}
            series={monthly}
            ariaLabel={`Intäkt, kostnader och resultat per månad över ${months} månader: ${kr(eco.revenue[months])} i intäkt och ${kr(eco.profit[months])} i resultat den sista månaden.`}
          />
          <ul className="legend is-inline">
            <li className="series-revenue">
              <LineSample />
              Intäkt
            </li>
            <li className="series-costs">
              <LineSample dash="9 4" />
              Kostnader
            </li>
            <li className="series-profit">
              <LineSample heavy />
              Resultat
            </li>
          </ul>
        </section>

        <section className="card" aria-labelledby="m-costs">
          <h3 id="m-costs">Vad kostnaderna är</h3>
          <p className="card-sub">Totalt {kr(eco.totals.costs)} på {months} månader.</p>
          <ul className="bars">
            {costShares.map((cost) => (
              <li key={cost.key}>
                <div className="bars-row">
                  <span className="bars-label">{cost.label}</span>
                  <span className="bars-count">
                    {kr(cost.amount)} <span className="bars-share">({eco.totals.costs > 0 ? sharePercent(cost.amount / eco.totals.costs) : "0 %"})</span>
                  </span>
                </div>
                <div className="bars-track" aria-hidden>
                  <div className={`bars-fill series-${cost.key}`} style={{ width: `${eco.totals.costs > 0 ? (cost.amount / eco.totals.costs) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card card-wide" aria-labelledby="m-cumulative">
          <h3 id="m-cumulative">Ackumulerat resultat{referenceRun ? ": nu mot utgångsläget" : ""}</h3>
          <p className="card-sub">Resultatet adderat månad för månad. Där linjen går upp över noll har det hela tjänat in sig.</p>
          <LineChart
            labels={labels}
            series={cumulative}
            ariaLabel={`Ackumulerat resultat över ${months} månader: ${kr(eco.cumulative[months])} vid slutet. Break-even: ${breakEvenText(eco.breakEven, months)}.`}
          />
          <ul className="legend is-inline">
            <li className="series-run">
              <LineSample heavy />
              Nu
            </li>
            {referenceRun && (
              <li className="series-reference">
                <LineSample dash="9 4" />
                Utgångsläge
              </li>
            )}
          </ul>
        </section>

        <section className="card" aria-labelledby="m-purchase">
          <h3 id="m-purchase">Ett genomsnittligt köp</h3>
          <p className="card-sub">Så delas det som kunden betalar.</p>
          <ul className="legend markov-split">
            <li>
              <span className="legend-label">Betalt av kunden</span>
              <span className="legend-count">{krDecimal(per.paid)}</span>
            </li>
            <li>
              <span className="legend-label">Moms</span>
              <span className="legend-count">{krDecimal(per.paid - per.revenue)}</span>
            </li>
            <li>
              <span className="legend-label">Betalavgift</span>
              <span className="legend-count">{krDecimal(per.fee)}</span>
            </li>
            <li>
              <span className="legend-label">Kvar</span>
              <span className="legend-count">{krDecimal(per.net)}</span>
            </li>
          </ul>
        </section>

        {channels && (
          <section className="card card-full" aria-labelledby="m-channel-money">
            <h3 id="m-channel-money">Kanalernas ekonomi</h3>
            <p className="card-sub">Vad varje kanal gav och kostade på {months} månader. Fasta kostnader hör inte till någon kanal.</p>
            <div className="markov-table-scroll">
              <table className="markov-table">
                <thead>
                  <tr>
                    <th scope="col">Kanal</th>
                    <th scope="col">Nya köp</th>
                    <th scope="col">Intäkt</th>
                    <th scope="col">Betalavgifter</th>
                    <th scope="col">Annonser</th>
                    <th scope="col">Bidrag</th>
                    <th scope="col">Värde per 1 000 besökare</th>
                    <th scope="col">Annonskostnad per 1 000 besökare</th>
                    <th scope="col">Annonskostnad per köp</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((c) => (
                    <tr key={c.id}>
                      <th scope="row">
                        <span className={`swatch series-${c.id}`} aria-hidden />
                        {CHANNELS[c.id].label}
                      </th>
                      <td>{formatInt(c.purchases)}</td>
                      <td>{kr(c.revenue)}</td>
                      <td>{kr(c.fees)}</td>
                      <td>{c.adSpend > 0 ? kr(c.adSpend) : "–"}</td>
                      <td>{kr(c.contribution)}</td>
                      <td>{kr(c.valuePer1000)}</td>
                      <td>{c.costPer1000 === null ? "–" : kr(c.costPer1000)}</td>
                      <td>{c.adCostPerPurchase === null ? "–" : kr(c.adCostPerPurchase)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Bidrag, summa</th>
                    <td>{formatInt(eco.totals.purchases)}</td>
                    <td>{kr(eco.totals.revenue)}</td>
                    <td>{kr(eco.totals.fees)}</td>
                    <td>{eco.totals.adSpend > 0 ? kr(eco.totals.adSpend) : "–"}</td>
                    <td>{kr(contribution)}</td>
                    <td colSpan={3} />
                  </tr>
                  <tr>
                    <th scope="row">Fasta kostnader</th>
                    <td colSpan={4} />
                    <td>{kr(-eco.totals.fixed)}</td>
                    <td colSpan={3} />
                  </tr>
                  <tr>
                    <th scope="row">Resultat</th>
                    <td colSpan={4} />
                    <td>{kr(eco.totals.profit)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="markov-note">
              “Värde per 1 000 besökare” är vad 1 000 nya besökare från kanalen ger över {months} månader efter betalavgifter och utan moms; för annonser kan det jämföras direkt med vad 1 000 besökare kostar. Bara annonser har en kostnad i modellen: de andra kanalerna kostar också, så deras bidrag är för högt.
            </p>
          </section>
        )}
      </div>
    </section>
  );
}
