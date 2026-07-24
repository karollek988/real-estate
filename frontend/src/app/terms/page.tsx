export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#111927]">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-white sm:text-[36px]">
          Villkor
        </h1>

        <ol className="mt-10 flex flex-col gap-8 text-[15px] leading-relaxed text-neutral-200 [counter-reset:section]">
          <li className="[counter-increment:section]">
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-white before:content-[counter(section)'.__']">
              Tjänstebeskrivning
            </h2>
            <p>
              Köpanalys är ett automatiserat analysverktyg som sammanställar offentlig och
              tredjepartsdata om bostäder för att ge dig en översiktlig bild av en fastighet
              eller bostadsrätt. Den information som presenteras i en analysrapport utgör
              <strong> inte</strong> finansiell rådgivning, en köprekommendation eller ett
              värderingsutlåtande. Köpanalys rapporterar vad tillgängliga data visar utan
              att fälla en slutgiltig dom eller rekommendera ett specifikt beslut. Du bör
              alltid göra din egen bedömning och, vid behov, rådgöra med en licensierad
              mäklare, jurist eller finansiell rådgivare innan du fattar ett
              bostadsköpsbeslut.
            </p>
          </li>

          <li className="[counter-increment:section]">
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-white before:content-[counter(section)'.__']">
              Konto och användning
            </h2>
            <p>
              För att använda Köpanalys måste du skapa ett konto. Du ansvarar för att de
              uppgifter du lämnar är korrekta och hålls uppdaterade. Kontot är personligt
              och du får inte dela dina inloggningsuppgifter med någon annan. Du får inte
              använda tjänsten för automatiserad dataskrapning, massanalys eller annan
              otillbörlig belastning av systemet. Köpanalys förbehåller sig rätten att
              begränsa eller stänga av konton som missbrukar tjänsten.
            </p>
          </li>

          <li className="[counter-increment:section]">
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-white before:content-[counter(section)'.__']">
              Analyser och krediter
            </h2>
            <p>
              Gratisanvändare får ett begränsat antal kostnadsfria analyser (3) per
              tidsperiod. Premium-användare köper analyskrediter via Stripe. När en analys
              har lösts ut och rapporten levererats betraktas köpet som slutfört i enlighet
              med reglerna för digitala varor.
            </p>
            <p className="mt-3">
              Svenska konsumenter har enligt lag rätt att ångra ett distansköp inom 14
              dagar (distansavtalslagen). För digitala tjänster som har börjat levereras
              med konsumentens uttryckliga samtycke och bekräftelse om att ångerrätten
              därmed förloras, upphör ångerrätten när leveransen påbörjats. Genom att
              begära och öppna en analysrapport bekräftar du att du förlorar din
              ångerrätt för just den analysen. Eventuella frågor om återbetalning hanteras
              från fall till fall inom ramen för gällande konsumentskyddslagstiftning.
            </p>
          </li>

          <li className="[counter-increment:section]">
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-white before:content-[counter(section)'.__']">
              Immateriella rättigheter
            </h2>
            <p>
              Köpanalys äger alla rättigheter till plattformen, analysverktygen och
              rapportformatet. När du köper eller erhåller en analysrapport får du en
              personlig, icke-exklusiv och icke-överlåtbar licens att använda rapporten
              för ditt eget bostadsköp. Du har inte rätt att vidareförmedla, publicera
              eller kommersiellt utnyttja rapporten utan Köpanalys uttryckliga
              medgivande.
            </p>
          </li>

          <li className="[counter-increment:section]">
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-white before:content-[counter(section)'.__']">
              Uppsägning
            </h2>
            <p>
              Köpanalys förbehåller sig rätten att när som helst stänga av eller säga upp
              ditt konto om du bryter mot dessa villkor eller på annat sätt använder
              tjänsten på ett sätt som kan skada Köpanalys, andra användare eller
              tredje part. Vid uppsägning upphör din tillgång till tjänsten och eventuella
              outnyttjade analyskrediter förverkas.
            </p>
          </li>

          <li className="[counter-increment:section]">
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-white before:content-[counter(section)'.__']">
              Tillämplig lag och tvister
            </h2>
            <p>
              Dessa villkor regleras av svensk lag. Tvister ska i första hand lösas genom
              förlikning. Konsumenttvister kan hänskjutas till Allmänna
              reklamationsnämnden (ARN). Som konsument har du även rätt att vända dig
              till ARN för medling innan du väcker talan i allmän domstol.
            </p>
          </li>

          <li className="[counter-increment:section]">
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-white before:content-[counter(section)'.__']">
              Kontakt
            </h2>
            <p>
              Har du frågor om dessa villkor? Kontakta oss på{" "}
              <a
                href="mailto:contact@kopanalys.se"
                className="text-green-400 underline underline-offset-4 transition hover:text-green-300"
              >
                contact@kopanalys.se
              </a>
              .
            </p>
          </li>

          <li className="[counter-increment:section]">
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-white before:content-[counter(section)'.__']">
              Ansvarsbegränsning
            </h2>
            <p className="text-xs text-neutral-500">
              Analysrapporter genereras genom automatiserad bearbetning av offentliga
              register och tredjepartsdatakällor. Köpanalys garanterar inte fullständigheten
              eller korrektheten i sådan underliggande data som Köpanalys inte själv
              producerar. Rapportens innehåll är inte en ersättning för en oberoende
              due diligence, en professionell besiktning eller licensierad finansiell
              eller juridisk rådgivning inför ett bostadsköp. I den utsträckning som
              tillåts enligt gällande lag är Köpanalys inte ansvarigt för beslut som
              fattas med stöd av en analysrapport eller för förluster som uppstår till
              följd av felaktigheter i tredjepartsdatakällor.
            </p>
          </li>
        </ol>
      </div>
    </main>
  );
}
