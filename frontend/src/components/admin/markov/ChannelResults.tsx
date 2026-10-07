import { formatDecimal, formatInt } from "@/lib/admin/stats";
import { CHANNELS, CHANNEL_IDS } from "@/lib/markov/acquisition";
import { StackedBars } from "../stats/charts";
import type { Run } from "@/lib/markov/run";

const share = (fraction: number) => `${formatDecimal(fraction * 100)} %`;
const kronor = (value: number) => `${formatInt(value)} kr`;

/**
 * What the acquisition model did: visitors per month by channel, and the channels side by side - how many
 * visitors, how many of them ended up paying, and what the ads cost. Only shown when the visitors come from channels.
 */
export function ChannelResults({ run, months }: { run: Run; months: number }) {
  const { plan, attribution } = run;
  if (!plan || !attribution) return null;

  const labels = Array.from({ length: months }, (_, i) => `${i + 1} mån`);
  const everyone = plan.total.reduce((a, b) => a + b, 0);
  const rows = attribution.channels;
  const entries = rows.reduce((sum, row) => sum + row.premiumEntries, 0) + attribution.startPremiumEntries;
  const atEnd = rows.reduce((sum, row) => sum + row.premiumAtEnd, 0) + attribution.startPremiumAtEnd;
  const spend = rows.reduce((sum, row) => sum + row.spend, 0);
  const hasStart = attribution.startPremiumEntries >= 0.5 || attribution.startPremiumAtEnd >= 0.5;

  return (
    <>
      <section className="card card-full" aria-labelledby="m-visitors">
        <h3 id="m-visitors">Nya besökare per månad</h3>
        <p className="card-sub">Hur många som kommer in i “Besökt” varje månad, uppdelat på kanal.</p>
        <StackedBars
          labels={labels}
          series={CHANNEL_IDS.map((id) => ({ key: id, label: CHANNELS[id].label, values: plan.channels[id].slice(1) }))}
          valueLabel="besökare"
          ariaLabel={`Nya besökare per månad över ${months} månader: ${formatInt(plan.total[1])} i månad 1 och ${formatInt(plan.total[months])} i månad ${months}.`}
        />
        <ul className="legend is-inline">
          {CHANNEL_IDS.map((id) => (
            <li key={id}>
              <span className={`swatch series-${id}`} aria-hidden />
              {CHANNELS[id].label}
            </li>
          ))}
        </ul>
      </section>

      <section className="card card-full" aria-labelledby="m-channels-compared">
        <h3 id="m-channels-compared">Kanalerna jämförda</h3>
        <p className="card-sub">Vad varje kanal gav under de {months} månaderna.</p>
        <div className="markov-table-scroll">
          <table className="markov-table">
            <thead>
              <tr>
                <th scope="col">Kanal</th>
                <th scope="col">Besökare</th>
                <th scope="col">Andel</th>
                <th scope="col">Nya premium</th>
                <th scope="col">Per 1 000 besökare</th>
                <th scope="col">Premium vid slutet</th>
                <th scope="col">Annonskostnad</th>
                <th scope="col">Kostnad per ny premium</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    <span className={`swatch series-${row.id}`} aria-hidden />
                    {CHANNELS[row.id].label}
                  </th>
                  <td>{formatInt(row.visitors)}</td>
                  <td>{everyone > 0 ? share(row.visitors / everyone) : "–"}</td>
                  <td>{formatInt(row.premiumEntries)}</td>
                  <td>{row.visitors > 0 ? formatDecimal((row.premiumEntries / row.visitors) * 1000) : "–"}</td>
                  <td>{formatInt(row.premiumAtEnd)}</td>
                  <td>{row.spend > 0 ? kronor(row.spend) : "–"}</td>
                  <td>{row.spend > 0 && row.premiumEntries >= 0.5 ? kronor(row.spend / row.premiumEntries) : "–"}</td>
                </tr>
              ))}
              {hasStart && (
                <tr>
                  <th scope="row">Startläget</th>
                  <td>–</td>
                  <td>–</td>
                  <td>{formatInt(attribution.startPremiumEntries)}</td>
                  <td>–</td>
                  <td>{formatInt(attribution.startPremiumAtEnd)}</td>
                  <td>–</td>
                  <td>–</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Alla</th>
                <td>{formatInt(everyone)}</td>
                <td>{everyone > 0 ? share(1) : "–"}</td>
                <td>{formatInt(entries)}</td>
                <td>{everyone > 0 ? formatDecimal((entries / everyone) * 1000) : "–"}</td>
                <td>{formatInt(atEnd)}</td>
                <td>{spend > 0 ? kronor(spend) : "–"}</td>
                <td>{spend > 0 && entries >= 0.5 ? kronor(spend / entries) : "–"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="markov-note">
          Bara annonser har en kostnad i modellen än. De andra kanalerna kostar också (tid, innehåll, verktyg), men det kommer med kostnadsdelen. På sista raden är annonskostnaden delad på alla nya premiumkunder, oavsett kanal. Premium-siffrorna går att dela upp exakt på kanal eftersom modellen är linjär: dubbelt så många besökare ger dubbelt så många kunder, och grupperna påverkar inte varandra.
        </p>
      </section>
    </>
  );
}
