import { useMemo, useState } from "react";
import {
  DEVICE_LABELS,
  DEVICE_TYPES,
  PACKAGES,
  PACKAGE_KEYS,
  RANGES,
  change,
  formatDecimal,
  formatInt,
  formatPercent,
  shortDate,
  summarize,
  windowOf,
  type AdminStats,
  type AdminStatsResult,
  type DeviceType,
  type PackageKey,
  type RangeDays,
} from "@/lib/admin/stats";
import { AreaChart, Donut, StackedBars } from "./charts";

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** The statistics tab: either the numbers, or - when they can't be read - what is wrong and what to do. */
export function StatsPanel({ result }: { result: AdminStatsResult }) {
  if (result.status === "ok") return <StatsView stats={result.stats} />;
  return <StatsNotice result={result} />;
}

function StatsNotice({ result }: { result: Exclude<AdminStatsResult, { status: "ok" }> }) {
  return (
    <div className="stats-notice" role="status">
      <h2>Statistiken kan inte visas</h2>
      {result.status === "unconfigured" && (
        <>
          <p>Databasen är inte inställd i den här miljön: <code>NEXT_PUBLIC_SUPABASE_URL</code> eller <code>SUPABASE_SERVICE_ROLE_KEY</code> saknas.</p>
          <p>
            För att bara se hur sidan ser ut, starta utvecklingsservern med <code>ADMIN_STATS_DEMO=1</code>: då visas exempelsiffror, tydligt märkta som demodata.
          </p>
        </>
      )}
      {result.status === "missing_tables" && (
        <>
          <p>Tabellerna för besöksstatistik finns inte i databasen än.</p>
          <p>
            Kör <code>supabase/migrations/20261006000000_site_analytics.sql</code> (till exempel i Supabase SQL Editor). Besöken räknas från och med att den är körd.
          </p>
        </>
      )}
      {result.status === "error" && (
        <>
          <p>Det gick inte att hämta siffrorna.</p>
          <p className="stats-notice-detail">{result.message}</p>
        </>
      )}
    </div>
  );
}

// ── the numbers ──────────────────────────────────────────────────────────────

function StatsView({ stats }: { stats: AdminStats }) {
  const [range, setRange] = useState<RangeDays>(30);

  const current = useMemo(() => windowOf(stats.days, range), [stats.days, range]);
  const now = useMemo(() => summarize(current), [current]);
  const before = useMemo(() => summarize(windowOf(stats.days, range, range)), [stats.days, range]);

  const labels = current.map((d) => shortDate(d.day));
  // Days before the counting began are "not counted", not "no visitors": leave them off the visitor chart
  // instead of drawing a cliff. (Purchases do reach back further, so their chart keeps the whole period.)
  const counted = current.filter((d) => stats.trackingSince !== null && d.day >= stats.trackingSince);
  const visitorLabels = counted.map((d) => shortDate(d.day));
  const visitorsPerDay = counted.map((d) => sum(DEVICE_TYPES.map((t) => d.visitors[t])));
  const packageKeys = PACKAGE_KEYS.filter((key) => key !== "other" || now.byPackage.other.count > 0);
  const buyers = packageKeys.map((key) => ({ key, ...now.byPackage[key] }));
  const topPackage = [...buyers].sort((a, b) => b.count - a.count)[0];

  return (
    <div className="stats">
      {stats.demo && (
        <p className="stats-banner is-demo" role="note">
          <strong>Demodata.</strong> De här siffrorna är exempel som bara finns i utvecklingsläge, inte dina riktiga.
        </p>
      )}
      {!stats.demo && stats.trackingSince === null && (
        <p className="stats-banner" role="note">
          Inga besök är räknade än. Räkningen sker automatiskt på webbplatsen så fort sidor visas; köpen nedan kommer redan från köphistoriken.
        </p>
      )}

      <div className="stats-head">
        <div>
          <h2>Statistik</h2>
          <p className="stats-sub">
            {stats.trackingSince ? <>Besök räknade sedan {shortDate(stats.trackingSince)} · </> : null}
            uppdaterad {shortDate(stats.today)}
          </p>
        </div>
        <div className="range" role="group" aria-label="Period">
          {RANGES.map((days) => (
            <button key={days} type="button" aria-pressed={range === days} onClick={() => setRange(days)}>
              {days} dagar
            </button>
          ))}
        </div>
      </div>

      <div className="kpis">
        <Kpi
          label="Besökare"
          value={formatInt(now.visitors)}
          delta={change(now.visitors, before.visitors)}
          range={range}
          note="Unika besökare per dag, summerat: den som kommer tre dagar räknas tre gånger."
        />
        <Kpi
          label="Sidvisningar"
          value={formatInt(now.pageViews)}
          delta={change(now.pageViews, before.pageViews)}
          range={range}
          note={now.visitors > 0 ? `${formatDecimal(now.pageViews / now.visitors)} per besökare och dag` : undefined}
        />
        <Kpi
          label="Köp"
          value={formatInt(now.purchases)}
          delta={change(now.purchases, before.purchases)}
          range={range}
          note={now.purchasesPer100Visitors !== null ? `${formatDecimal(now.purchasesPer100Visitors)} köp per 100 besökare` : undefined}
        />
        <Kpi
          label="Intäkt, beräknad"
          value={`${formatInt(now.revenueSek)} kr`}
          delta={change(now.revenueSek, before.revenueSek)}
          range={range}
          note="Antal köp × dagens listpris, före rabattkoder."
        />
      </div>

      <div className="stats-grid">
        <section className="card card-wide" aria-labelledby="c-visitors">
          <h3 id="c-visitors">Besökare per dag</h3>
          {counted.length < current.length && stats.trackingSince !== null && (
            <p className="card-sub">{counted.length > 0 ? <>Räkningen började {shortDate(stats.trackingSince)}: dagarna före visas inte.</> : "Inga besök räknade under perioden."}</p>
          )}
          <AreaChart
            labels={visitorLabels}
            values={visitorsPerDay}
            seriesKey="visitors"
            valueLabel="besökare"
            ariaLabel={`Unika besökare per dag, senaste ${range} dagarna: totalt ${formatInt(now.visitors)}, högst ${formatInt(Math.max(0, ...visitorsPerDay))} en dag.`}
          />
        </section>

        <section className="card" aria-labelledby="c-devices">
          <h3 id="c-devices">Enheter</h3>
          <p className="card-sub">Vilken sorts enhet besökarna använder</p>
          <Donut
            slices={DEVICE_TYPES.map((type) => ({ key: type, label: DEVICE_LABELS[type], value: now.visitorsByDevice[type] }))}
            centerValue={formatInt(now.visitors)}
            centerLabel="besökare"
            ariaLabel={`Fördelning av besökare per enhet: ${DEVICE_TYPES.map((t) => `${DEVICE_LABELS[t]} ${share(now.visitorsByDevice[t], now.visitors)}`).join(", ")}.`}
          />
          <ul className="legend">
            {DEVICE_TYPES.map((type) => (
              <LegendRow key={type} seriesKey={type} label={DEVICE_LABELS[type]} count={now.visitorsByDevice[type]} total={now.visitors} />
            ))}
          </ul>
        </section>

        <section className="card card-wide" aria-labelledby="c-purchases">
          <h3 id="c-purchases">Köp per dag</h3>
          <p className="card-sub">Uppdelat på prispaket</p>
          <StackedBars
            labels={labels}
            series={packageKeys.map((key) => ({ key, label: PACKAGES[key].label, values: current.map((d) => d.purchases[key]) }))}
            valueLabel="köp"
            ariaLabel={`Köp per dag, senaste ${range} dagarna: totalt ${formatInt(now.purchases)}.`}
          />
          <ul className="legend is-inline">
            {packageKeys.map((key) => (
              <li key={key}>
                <span className={`swatch series-${key}`} aria-hidden />
                {PACKAGES[key].label}
              </li>
            ))}
          </ul>
        </section>

        <section className="card" aria-labelledby="c-packages">
          <h3 id="c-packages">Vilket prispaket väljs</h3>
          <p className="card-sub">
            {now.purchases > 0 && topPackage ? <>Mest valt: {PACKAGES[topPackage.key].label} ({share(topPackage.count, now.purchases)})</> : "Inga köp under perioden"}
          </p>
          <ul className="bars">
            {buyers.map((pack) => (
              <li key={pack.key}>
                <div className="bars-row">
                  <span className="bars-label">
                    {PACKAGES[pack.key].label}
                    {PACKAGES[pack.key].priceSek !== null && <span className="bars-price">{formatInt(PACKAGES[pack.key].priceSek ?? 0)}&nbsp;kr</span>}
                  </span>
                  <span className="bars-count">
                    {formatInt(pack.count)} <span className="bars-share">({share(pack.count, now.purchases)})</span>
                  </span>
                </div>
                <div className="bars-track" aria-hidden>
                  <div className={`bars-fill series-${pack.key}`} style={{ width: `${now.purchases > 0 ? (pack.count / now.purchases) * 100 : 0}%` }} />
                </div>
                {PACKAGES[pack.key].priceSek !== null && <p className="bars-revenue">{formatInt(pack.revenueSek)}&nbsp;kr beräknad intäkt</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="stats-foot">
        Besökare räknas på webbplatsen utan kakor och utan att spara IP-adress, webbläsare eller sidor: bara ett dagligt engångsvärde som raderas efter två dagar och summor per dag och enhet. Botar och besökare som skickar Do Not Track eller Global
        Privacy Control räknas inte. Köpen kommer från köphistoriken (<code>credit_purchases</code>), dagarna räknas i svensk tid.
      </p>
    </div>
  );
}

const share = (part: number, total: number) => (total > 0 ? formatPercent(part / total) : "0 %");

function Kpi({ label, value, delta, range, note }: { label: string; value: string; delta: number | null; range: RangeDays; note?: string }) {
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      <p className="kpi-delta">
        <Delta value={delta} />
        {delta !== null && <span> mot föregående {range} dagar</span>}
      </p>
      {note && <p className="kpi-note">{note}</p>}
    </div>
  );
}

/** The arrow and the words carry the direction; the colour only echoes it. */
function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="delta is-none">ingen jämförelse ännu</span>;
  const rounded = Math.round(Math.abs(value) * 100);
  if (rounded === 0) return <span className="delta is-flat">▬ oförändrat</span>;
  return value > 0 ? <span className="delta is-up">▲ {rounded}&nbsp;% fler</span> : <span className="delta is-down">▼ {rounded}&nbsp;% färre</span>;
}

function LegendRow({ seriesKey, label, count, total }: { seriesKey: DeviceType | PackageKey; label: string; count: number; total: number }) {
  return (
    <li>
      <span className={`swatch series-${seriesKey}`} aria-hidden />
      <span className="legend-label">{label}</span>
      <span className="legend-count">{formatInt(count)}</span>
      <span className="legend-share">{share(count, total)}</span>
    </li>
  );
}
