import { formatInt } from "@/lib/admin/stats";
import { FIELD } from "@/lib/markov/fields";
import { PACKAGE_IDS, PACKAGE_LABELS, purchaseEconomics } from "@/lib/markov/finance";
import type { Defaults } from "@/lib/markov/measured";
import type { Evaluated } from "@/lib/markov/run";
import { Field } from "./Field";
import { kr, krDecimal, sharePercent } from "./format";

/**
 * Revenue and costs: what a purchase brings in and what is paid out. The package mix starts from the real
 * purchases (the ledger the statistics page reads) when there are enough; everything else is an example number
 * to replace. See lib/markov/finance.ts for exactly what is counted and what is left out.
 */
export function RevenueModel({ now, defaults }: { now: Evaluated; defaults: Defaults }) {
  const mix = defaults.mix;
  const f = now.params.finance;
  const ready = now.run !== null;
  const per = purchaseEconomics(f);
  const firstMonth = now.run?.sim.premiumEntries[1];
  const months = now.params.months;
  const lastMonth = now.run?.sim.premiumEntries[months];

  return (
    <section className="card markov-revenue" aria-labelledby="m-revenue">
      <h3 id="m-revenue">Intäkter och kostnader</h3>
      <p className="card-sub">Varje gång någon blir Premium räknas det som ett köp av ett av paketen. Priserna står inklusive moms; intäkten är priset utan moms.</p>

      {mix && mix.usable && (
        <p className="markov-note">
          Uppmätt: {formatInt(mix.total)} köp de senaste {mix.days} dagarna (ungefär {formatInt(mix.perMonth)} i månaden), {PACKAGE_IDS.map((id) => `${sharePercent(mix.shares[id])} ${PACKAGE_LABELS[id]}`).join(", ")}. Andelarna nedan som är märkta “uppmätt” börjar på de siffrorna.
        </p>
      )}
      {mix && !mix.usable && <p className="markov-note">{mix.problem} Ett exempel på fördelning används tills det finns fler.</p>}
      {!mix && <p className="markov-note">Köphistoriken kunde inte läsas här, så ett exempel på fördelning används.</p>}

      <div className="markov-states markov-money">
        {PACKAGE_IDS.map((id) => (
          <section key={id} className={`markov-state series-${id}`} aria-labelledby={`m-package-${id}`}>
            <h4 id={`m-package-${id}`}>
              <span className="swatch" aria-hidden />
              {PACKAGE_LABELS[id]}
            </h4>
            <Field name={FIELD.price(id)} label="Pris" hint="Inklusive moms." unit="kr" error={now.errors[FIELD.price(id)]} />
            <Field name={FIELD.mix(id)} label="Andel av köpen" unit="%" error={now.errors[FIELD.mix(id)]} />
          </section>
        ))}
        <section className="markov-state series-run" aria-labelledby="m-payments">
          <h4 id="m-payments">
            <span className="swatch" aria-hidden />
            Moms och betalning
          </h4>
          <Field name={FIELD.vat} label="Moms" hint="Av priset utan moms." unit="%" error={now.errors[FIELD.vat]} />
          <Field name={FIELD.feePercent} label="Betalavgift" hint="Av det kunden betalar." unit="%" error={now.errors[FIELD.feePercent]} />
          <Field name={FIELD.feeFixed} label="Fast avgift per köp" unit="kr" error={now.errors[FIELD.feeFixed]} />
        </section>
        <section className="markov-state series-costs" aria-labelledby="m-fixed">
          <h4 id="m-fixed">
            <span className="swatch" aria-hidden />
            Fasta kostnader
          </h4>
          <Field name={FIELD.fixedCosts} label="Per månad" hint="Hosting, verktyg, bokföring och annat som betalas varje månad oavsett försäljning. Annonskostnaden kommer från förvärvsmodellen." unit="kr" error={now.errors[FIELD.fixedCosts]} />
        </section>
      </div>

      {now.errors[FIELD.mixRow] && <p className="markov-error">{now.errors[FIELD.mixRow]}</p>}

      {!now.errors[FIELD.mixRow] && (
        <p className="markov-readout">
          Ett genomsnittligt köp: {krDecimal(per.paid)} betalt, {krDecimal(per.revenue)} utan moms, {krDecimal(per.fee)} i betalavgift, {krDecimal(per.net)} kvar.
        </p>
      )}

      {ready && mix && mix.total > 0 && firstMonth !== undefined && lastMonth !== undefined && (
        <p className="markov-note">
          Jämfört med verkligheten: de riktiga köpen är ungefär {formatInt(mix.perMonth)} i månaden, och modellen räknar med {formatInt(firstMonth)} i månad 1 och {formatInt(lastMonth)} i månad {months}. Sannolikheterna längre ner är exempelsiffror: ligger modellen långt från verkligheten är det dem som behöver justeras.
        </p>
      )}

      <p className="markov-note">
        Inte med i beräkningen: vad en analys kostar att ta fram (AI och data), vad de andra kanalerna än annonser kostar (tid, innehåll, verktyg), rabattkoder, återbetalningar och skatter. Resultatet är alltså före allt det, och därmed för gott. De fasta kostnaderna ({kr(f.fixedMonthly)} i månaden) är ett exempel att byta ut.
        {mix && mix.other > 0 ? ` Köpen av äldre paket (${formatInt(mix.other)} st) ingår inte i fördelningen.` : ""}
      </p>
    </section>
  );
}
