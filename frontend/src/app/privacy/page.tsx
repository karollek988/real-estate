export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#111927]">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-white sm:text-[36px]">
          Integritetspolicy
        </h1>

        <p className="mt-6 text-[15px] leading-relaxed text-neutral-400">
          Senast uppdaterad: 14 augusti 2026
        </p>

        <div className="mt-10 flex flex-col gap-8 text-[15px] leading-relaxed text-neutral-200">
          <section>
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-white">
              1. Personuppgiftsansvarig
            </h2>
            <p>
              Köpanalys (org.nr 9811048793) är personuppgiftsansvarig för behandlingen
              av dina personuppgifter. Vid frågor om hur vi behandlar dina uppgifter,
              kontakta oss på{" "}
              <a
                href="mailto:info@kopanalys.se"
                className="text-green-400 underline underline-offset-4 transition hover:text-green-300"
              >
                info@kopanalys.se
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-white">
              2. Vilka uppgifter vi samlar in
            </h2>

            <h3 className="mb-2 text-[15px] font-semibold text-white">
              Nödvändiga uppgifter (krävs för tjänsten)
            </h3>
            <p>
              Dessa uppgifter samlas alltid in utan särskilt samtycke eftersom de är
              nödvändiga för att tillhandahålla tjänsten:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-300">
              <li>
                Inloggnings- och sessionsdata (hanteras av Supabase, vår
                autentiseringsleverantör)
              </li>
              <li>
                Kontouppgifter såsom e-postadress och, om du väljer att ange det, ditt
                namn
              </li>
              <li>
                Uppgifter som krävs för att generera och lagra de
                fastighetsanalysrapporter du begär (adresser, länkade annonser,
                sparade analysresultat)
              </li>
              <li>
                Innehåll du skickar till vår chattassistent, samt innehållet i
                dokument (till exempel besiktningsprotokoll eller BRF-årsredovisningar)
                du laddar upp för att få dem sammanfattade — se punkt 4 om hur detta
                behandlas av vår AI-leverantör.
              </li>
            </ul>

            <h3 className="mb-2 mt-5 text-[15px] font-semibold text-white">
              Marknadsföring & analys (kräver samtycke)
            </h3>
            <p>
              I dagsläget använder Köpanalys inga analys- eller
              marknadsföringsverktyg (till exempel besöksstatistik eller
              annonsspårning) — endast de nödvändiga sessionscookies som beskrivs
              ovan sätts. Cookie-bannerns val för &quot;Acceptera alla&quot; finns
              på plats i förberedande syfte: om vi i framtiden börjar samla in
              användningsstatistik eller marknadsförings-/lead-trackingdata kommer
              det endast att ske för besökare som aktivt samtyckt, och denna policy
              uppdateras då med vad som samlas in och varför.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-white">
              3. Rättslig grund
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-neutral-300">
              <li>
                <strong>Nödvändiga uppgifter:</strong> Behandlingen är nödvändig för
                att fullgöra avtalet med dig (art. 6.1 b GDPR) — det vill säga för att
                leverera den tjänst du registrerat dig för.
              </li>
              <li>
                <strong>Marknadsföring & analys:</strong> Behandlingen baseras på ditt
                samtycke (art. 6.1 a GDPR).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-white">
              4. Tredje parter / mottagare
            </h2>
            <p>
              Köpanalys delar inte dina personuppgifter med externa köpare. Vi anlitar
              dock databehandlare som agerar på våra instruktioner för att driva
              tjänsten:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-300">
              <li>
                <strong>Supabase</strong> — hosting, autentisering och databas
                (personuppgiftsbiträde)
              </li>
              <li>
                <strong>Stripe</strong> — betalningshantering
                (personuppgiftsbiträde)
              </li>
              <li>
                <strong>OpenAI</strong> (USA) — driver vår chattassistent och tolkar
                innehållet i uppladdade mäklardokument/BRF-årsredovisningar för att
                sammanfatta dem åt dig (personuppgiftsbiträde). Används aldrig för att
                sätta ett betyg eller en poäng på en bostad.
              </li>
              <li>
                <strong>Resend</strong> — leverans av transaktionsmejl (till exempel
                bekräftelse av din e-postadress och kontaktformulärssvar)
                (personuppgiftsbiträde)
              </li>
            </ul>
            <p className="mt-3 text-neutral-400">
              Samtliga biträden är avtalsbundna att följa gällande dataskyddslagstiftning
              och får endast behandla uppgifterna i enlighet med Köpanalys instruktioner.
              När ett biträde (till exempel OpenAI) är etablerat utanför EU/EES säkerställs
              överföringen genom EU-kommissionens standardavtalsklausuler (SCC) eller
              motsvarande skyddsåtgärder.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-white">
              5. Lagringstid
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-neutral-300">
              <li>
                <strong>Kontouppgifter</strong> sparas så länge ditt konto är aktivt
                samt en skälig tid efter avslut (upp till 12 månader) för att uppfylla
                bokförings- och rättsliga skyldigheter.
              </li>
              <li>
                <strong>Analysdata</strong> (adresser, sparade rapporter) sparas så
                länge ditt konto är aktivt, eller tills du aktivt raderar dem.
              </li>
              <li>
                <strong>Marknadsförings- och analysdata</strong> sparas i högst 24
                månader från insamlingstillfället, eller tills du återkallar ditt
                samtycke.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-white">
              6. Dina rättigheter
            </h2>
            <p>Du har följande rättigheter enligt GDPR:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-300">
              <li>Rätt till tillgång (registerutdrag)</li>
              <li>Rätt till rättelse av felaktiga uppgifter</li>
              <li>Rätt till radering (&quot;rätten att bli glömd&quot;)</li>
              <li>Rätt att invända mot behandling för direktmarknadsföring</li>
              <li>Rätt till dataportabilitet</li>
              <li>
                Rätt att klaga till tillsynsmyndigheten —{" "}
                <a
                  href="https://www.imy.se"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 underline underline-offset-4 transition hover:text-green-300"
                >
                  Integritetsskyddsmyndigheten (IMY)
                </a>
              </li>
            </ul>
            <p className="mt-3">
              För att utöva dina rättigheter, kontakta oss på{" "}
              <a
                href="mailto:info@kopanalys.se"
                className="text-green-400 underline underline-offset-4 transition hover:text-green-300"
              >
                info@kopanalys.se
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-white">
              7. Hur du återkallar samtycke
            </h2>
            <p>
              Om du tidigare har samtyckt till insamling av marknadsförings- och
              analysdata men ändrar dig, kan du när som helst återkalla ditt samtycke.
              Detta innebär att ingen ytterligare data i den kategorin samlas in från
              och med återkallandet. Redan insamlad data kan komma att fortsätta
              användas i avidentifierad eller aggregerad form.
            </p>
            <p className="mt-3">
              Så här återkallar du ditt samtycke:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-300">
              <li>
                Rensa din cookie-banners lagrade val genom att klicka på
                &quot;Cookie-inställningar&quot; längst ned på sidan och justera dina
                preferenser, eller
              </li>
              <li>
                Kontakta oss på{" "}
                <a
                  href="mailto:info@kopanalys.se"
                  className="text-green-400 underline underline-offset-4 transition hover:text-green-300"
                >
                  info@kopanalys.se
                </a>{" "}
                så hjälper vi dig.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-white">
              8. Kontakt
            </h2>
            <p>
              Har du frågor om denna integritetspolicy eller hur vi behandlar dina
              personuppgifter? Kontakta oss:
            </p>
            <p className="mt-2">
              Köpanalys<br />
              Org.nr: 9811048793<br />
              E-post:{" "}
              <a
                href="mailto:info@kopanalys.se"
                className="text-green-400 underline underline-offset-4 transition hover:text-green-300"
              >
                info@kopanalys.se
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
