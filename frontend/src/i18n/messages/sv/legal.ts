/**
 * The privacy policy and the terms of use (the pages /privacy and /terms).
 *
 * These are legal texts. The Swedish text is the one that applies; a translation is a help for readers who do
 * not read Swedish, and says so at the top of the page (translationNotice). When you translate, keep the meaning
 * exactly: do not add, leave out or soften anything, and keep the names of laws, authorities and companies.
 * If the Swedish text changes, change `updated` in it, and update the translations.
 *
 * Tags inside the texts (write them as they are, around the words they apply to):
 *   <mail></mail>    the e-mail address of Köpanalys, as a link
 *   <b>…</b>         bold
 *   <code>…</code>   a name written in code type, such as a cookie's name
 *   <imy>…</imy>     a link to the website of the Swedish Authority for Privacy Protection (IMY)
 *   <br></br>        a line break
 */
const legal = {
  /** Shown at the top of both pages in every language except Swedish. */
  translationNotice: "Detta är en översättning av den svenska texten. Om texterna skiljer sig åt är det den svenska versionen som gäller.",

  privacy: {
    meta: {
      title: "Integritetspolicy",
      description: "Så behandlar Köpanalys dina personuppgifter.",
    },
    title: "Integritetspolicy",
    updated: "Senast uppdaterad: 8 oktober 2026",

    controller: {
      title: "Personuppgiftsansvarig",
      text: "Köpanalys (org.nr 9811048793) är personuppgiftsansvarig för behandlingen av dina personuppgifter. Vid frågor om hur vi behandlar dina uppgifter, kontakta oss på <mail></mail>.",
    },

    data: {
      title: "Vilka uppgifter vi samlar in",
      necessary: {
        title: "Nödvändiga uppgifter (krävs för tjänsten)",
        intro: "Dessa uppgifter samlas alltid in utan särskilt samtycke eftersom de är nödvändiga för att tillhandahålla tjänsten:",
        session: "Inloggnings- och sessionsdata (hanteras av Supabase, vår autentiseringsleverantör)",
        account: "Kontouppgifter såsom e-postadress och, om du väljer att ange det, ditt namn",
        analyses:
          "Uppgifter som krävs för att generera och lagra de fastighetsanalysrapporter du begär (adresser, länkade annonser, sparade analysresultat)",
        chat: "Innehåll du skickar till vår chattassistent, samt innehållet i dokument (till exempel besiktningsprotokoll eller BRF-årsredovisningar) du laddar upp för att få dem sammanfattade — se punkt 4 om hur detta behandlas av vår AI-leverantör.",
        /** What a visitor writes in a listing on the map is translated when it is shown in another language (src/lib/translate). */
        translation:
          "Text du skriver i en annons på kartan. Annonsen sparas bara i din webbläsare, men när sidan visas på ett annat språk skickas annonsens text till vår egen server för att översättas automatiskt, och översättningen sparas tillsammans med originaltexten så att den inte behöver översättas om. Den kopplas inte till ditt konto eller din IP-adress och skickas inte till någon extern översättningstjänst.",
        /** The cookie of the language picker (src/components/LanguageSwitcher.tsx); it lives for 365 days. */
        language:
          "Ditt språkval. Om du själv väljer språk med språkväljaren sparas valet i en cookie, <code>NEXT_LOCALE</code>, som bara innehåller språkkoden (till exempel \"en\"). Den sparas i ett år på din enhet, sätts först när du gör ett val och används inte för analys eller marknadsföring.",
      },
      stats: {
        title: "Besöksstatistik (utan cookies)",
        p1: "Vi räknar hur många som besöker webbplatsen och vilken sorts enhet de använder — mobil, surfplatta eller dator — för att förstå och förbättra tjänsten. Räkningen görs av vår egen server, sätter inga cookies och lagrar ingenting på din enhet. Vi sparar varken din IP-adress, din webbläsares fullständiga beteckning eller vilka sidor du tittar på.",
        p2: "För att samma besökare inte ska räknas flera gånger under en dag skapas ett engångsvärde av din IP-adress och webbläsarbeteckning tillsammans med dagens datum och en hemlig nyckel som bara vår server känner till. Värdet kan inte räknas tillbaka till dig och är ett annat varje dag, så att du inte kan följas från en dag till nästa. Det raderas efter två dygn. Det som sparas långsiktigt är bara summor per dag och enhetstyp. Besökare som har Do Not Track eller Global Privacy Control påslaget i sin webbläsare räknas inte alls.",
      },
      marketing: {
        title: "Marknadsföring & analys (kräver samtycke)",
        p1: "Om du väljer \"Acceptera alla\" i cookie-bannern sätter vi en enda analyscookie, <code>ka_src</code>. Den innehåller bara var du först kom ifrån, i form av en kanal och en källa, till exempel \"sökmotor, Google\" eller \"AI-sökmotor, ChatGPT\" eller \"direkt\". Den innehåller inget id, ingen adress och inga sidor, och den sparas i 90 dagar på din enhet.",
        p2: "Syftet är att veta hur många nya besökare som kommer från sökmotorer, AI-sökmotorer, sociala medier och annonser, så att vi kan bedöma vilka kanaler som fungerar. Din webbläsare avgör själv var du kom ifrån (utifrån sidan som länkade hit och eventuella kampanjtaggar i adressen) och skickar bara svaret till vår server, aldrig den länkande adressen. Första gången, när du godkänner, räknas en ny besökare för den kanalen; så länge cookien finns räknas du inte igen. Det som sparas är bara summor per dag, kanal och källa, som inte kan kopplas till dig.",
        p3: "Vi räknar också, utan cookie och utan något id, hur många som godkänner och hur många som avböjer i bannern, för att kunna uppskatta hur många nya besökare vi har totalt. Har du Do Not Track eller Global Privacy Control påslaget sätts ingen cookie och inget räknas. Avböjer du eller ändrar dig via \"Cookie-inställningar\" längst ned på sidan tas cookien bort.",
        p4: "Utöver detta använder Köpanalys inga analys- eller marknadsföringsverktyg (till exempel annonsspårning eller tredjepartsverktyg för användaranalys). Om vi i framtiden samlar in mer kommer det endast att ske för besökare som aktivt samtyckt, och denna policy uppdateras då.",
      },
    },

    basis: {
      title: "Rättslig grund",
      necessary:
        "<b>Nödvändiga uppgifter:</b> Behandlingen är nödvändig för att fullgöra avtalet med dig (art. 6.1 b GDPR) — det vill säga för att leverera den tjänst du registrerat dig för.",
      stats:
        "<b>Besöksstatistik:</b> Behandlingen baseras på vårt berättigade intresse av att förstå hur webbplatsen används och förbättra den (art. 6.1 f GDPR). Den är begränsad så långt det går: ingen cookie, inget lagrat på din enhet, ingen IP-adress eller sida sparas, och engångsvärdet raderas efter två dygn.",
      marketing:
        "<b>Marknadsföring & analys</b> (analyscookien ka_src): Behandlingen baseras på ditt samtycke (art. 6.1 a GDPR). Räkningen av hur många som godkänner och avböjer görs utan cookie och baseras på vårt berättigade intresse (art. 6.1 f), på samma sätt som besöksstatistiken ovan.",
    },

    recipients: {
      title: "Tredje parter / mottagare",
      intro:
        "Köpanalys delar inte dina personuppgifter med externa köpare. Vi anlitar dock databehandlare som agerar på våra instruktioner för att driva tjänsten:",
      supabase: "<b>Supabase</b> — hosting, autentisering och databas (personuppgiftsbiträde)",
      stripe: "<b>Stripe</b> — betalningshantering (personuppgiftsbiträde)",
      openai:
        "<b>OpenAI</b> (USA) — driver vår chattassistent och tolkar innehållet i uppladdade mäklardokument/BRF-årsredovisningar för att sammanfatta dem åt dig (personuppgiftsbiträde). Används aldrig för att sätta ett betyg eller en poäng på en bostad.",
      resend:
        "<b>Resend</b> — leverans av transaktionsmejl (till exempel bekräftelse av din e-postadress och kontaktformulärssvar) (personuppgiftsbiträde)",
      safeguards:
        "Samtliga biträden är avtalsbundna att följa gällande dataskyddslagstiftning och får endast behandla uppgifterna i enlighet med Köpanalys instruktioner. När ett biträde (till exempel OpenAI) är etablerat utanför EU/EES säkerställs överföringen genom EU-kommissionens standardavtalsklausuler (SCC) eller motsvarande skyddsåtgärder.",
    },

    retention: {
      title: "Lagringstid",
      accounts:
        "<b>Kontouppgifter</b> sparas så länge ditt konto är aktivt samt en skälig tid efter avslut (upp till 12 månader) för att uppfylla bokförings- och rättsliga skyldigheter.",
      analyses: "<b>Analysdata</b> (adresser, sparade rapporter) sparas så länge ditt konto är aktivt, eller tills du aktivt raderar dem.",
      stats:
        "<b>Besöksstatistik:</b> engångsvärdet som används för att räkna en besökare en gång per dag raderas efter två dygn. Summorna per dag och enhetstyp, som inte kan kopplas till någon enskild besökare, sparas tills vidare.",
      cookie:
        "<b>Analyscookien ka_src</b> sparas i 90 dagar på din enhet, eller tills du avböjer eller återkallar ditt samtycke. Summorna per dag, kanal och källa, som inte kan kopplas till någon enskild besökare, sparas tills vidare.",
      language: "<b>Språkcookien NEXT_LOCALE</b> sparas i ett år på din enhet, eller tills du rensar den.",
      translation: "<b>Översatta annonstexter</b> (originaltexten och dess översättning) sparas tills vidare och kan raderas på begäran: kontakta oss.",
      other:
        "<b>Annan marknadsförings- och analysdata</b>, om sådan i framtiden samlas in, sparas i högst 24 månader från insamlingstillfället, eller tills du återkallar ditt samtycke.",
    },

    rights: {
      title: "Dina rättigheter",
      intro: "Du har följande rättigheter enligt GDPR:",
      access: "Rätt till tillgång (registerutdrag)",
      rectification: "Rätt till rättelse av felaktiga uppgifter",
      erasure: "Rätt till radering (\"rätten att bli glömd\")",
      objection: "Rätt att invända mot behandling för direktmarknadsföring",
      portability: "Rätt till dataportabilitet",
      complaint: "Rätt att klaga till tillsynsmyndigheten — <imy>Integritetsskyddsmyndigheten (IMY)</imy>",
      exercise: "För att utöva dina rättigheter, kontakta oss på <mail></mail>.",
    },

    consent: {
      title: "Hur du återkallar samtycke",
      p1: "Om du tidigare har samtyckt till insamling av marknadsförings- och analysdata men ändrar dig, kan du när som helst återkalla ditt samtycke. Detta innebär att ingen ytterligare data i den kategorin samlas in från och med återkallandet. Redan insamlad data kan komma att fortsätta användas i avidentifierad eller aggregerad form.",
      p2: "Så här återkallar du ditt samtycke:",
      viaBanner:
        "Rensa din cookie-banners lagrade val genom att klicka på \"Cookie-inställningar\" längst ned på sidan och justera dina preferenser, eller",
      viaMail: "Kontakta oss på <mail></mail> så hjälper vi dig.",
    },

    contact: {
      title: "Kontakt",
      intro: "Har du frågor om denna integritetspolicy eller hur vi behandlar dina personuppgifter? Kontakta oss:",
      address: "Köpanalys<br></br>Org.nr: 9811048793<br></br>E-post: <mail></mail>",
    },
  },

  terms: {
    meta: {
      title: "Användarvillkor",
      description: "Villkoren för att använda Köpanalys.",
    },
    title: "Villkor",

    service: {
      title: "Tjänstebeskrivning",
      text: "Köpanalys är ett automatiserat analysverktyg som sammanställer offentlig och tredjepartsdata om bostäder för att ge dig en översiktlig bild av en fastighet eller bostadsrätt. Den information som presenteras i en analysrapport utgör <b>inte</b> finansiell rådgivning, en köprekommendation eller ett värderingsutlåtande. Köpanalys rapporterar vad tillgängliga data visar utan att fälla en slutgiltig dom eller rekommendera ett specifikt beslut. Du bör alltid göra din egen bedömning och, vid behov, rådgöra med en licensierad mäklare, jurist eller finansiell rådgivare innan du fattar ett bostadsköpsbeslut.",
    },
    account: {
      title: "Konto och användning",
      text: "För att använda Köpanalys måste du skapa ett konto. Du ansvarar för att de uppgifter du lämnar är korrekta och hålls uppdaterade. Kontot är personligt och du får inte dela dina inloggningsuppgifter med någon annan. Du får inte använda tjänsten för automatiserad dataskrapning, massanalys eller annan otillbörlig belastning av systemet. Köpanalys förbehåller sig rätten att begränsa eller stänga av konton som missbrukar tjänsten.",
    },
    credits: {
      title: "Analyser och krediter",
      p1: "Analyser köps som engångsköp via Stripe: en Områdesanalys, ett Trygghetspaket för en bostad eller ett paket för tre bostäder. Köpet ger analyser på ditt konto som du löser ut när du begär en analys. Den som skapar en hel analys får tillgång till hela rapporten, och den som skapar en Områdesanalys får en rapport om området. Går en analys inte att slutföra återförs den till ditt konto. När en analys har lösts ut och rapporten levererats betraktas köpet som slutfört i enlighet med reglerna för digitala varor.",
      p2: "Svenska konsumenter har enligt lag rätt att ångra ett distansköp inom 14 dagar (distansavtalslagen). För digitala tjänster som har börjat levereras med konsumentens uttryckliga samtycke och bekräftelse om att ångerrätten därmed förloras, upphör ångerrätten när leveransen påbörjats. Genom att begära och öppna en analysrapport bekräftar du att du förlorar din ångerrätt för just den analysen. Eventuella frågor om återbetalning hanteras från fall till fall inom ramen för gällande konsumentskyddslagstiftning.",
    },
    ip: {
      title: "Immateriella rättigheter",
      text: "Köpanalys äger alla rättigheter till plattformen, analysverktygen och rapportformatet. När du köper eller erhåller en analysrapport får du en personlig, icke-exklusiv och icke-överlåtbar licens att använda rapporten för ditt eget bostadsköp. Du har inte rätt att vidareförmedla, publicera eller kommersiellt utnyttja rapporten utan Köpanalys uttryckliga medgivande.",
    },
    termination: {
      title: "Uppsägning",
      text: "Köpanalys förbehåller sig rätten att när som helst stänga av eller säga upp ditt konto om du bryter mot dessa villkor eller på annat sätt använder tjänsten på ett sätt som kan skada Köpanalys, andra användare eller tredje part. Vid uppsägning upphör din tillgång till tjänsten och eventuella outnyttjade analyskrediter förverkas.",
    },
    law: {
      title: "Tillämplig lag och tvister",
      text: "Dessa villkor regleras av svensk lag. Tvister ska i första hand lösas genom förlikning. Konsumenttvister kan hänskjutas till Allmänna reklamationsnämnden (ARN). Som konsument har du även rätt att vända dig till ARN för medling innan du väcker talan i allmän domstol.",
    },
    contact: {
      title: "Kontakt",
      text: "Har du frågor om dessa villkor? Kontakta oss på <mail></mail>.",
    },
    liability: {
      title: "Ansvarsbegränsning",
      text: "Analysrapporter genereras genom automatiserad bearbetning av offentliga register och tredjepartsdatakällor. Köpanalys garanterar inte fullständigheten eller korrektheten i sådan underliggande data som Köpanalys inte själv producerar. Rapportens innehåll är inte en ersättning för en oberoende due diligence, en professionell besiktning eller licensierad finansiell eller juridisk rådgivning inför ett bostadsköp. I den utsträckning som tillåts enligt gällande lag är Köpanalys inte ansvarigt för beslut som fattas med stöd av en analysrapport eller för förluster som uppstår till följd av felaktigheter i tredjepartsdatakällor.",
    },
  },
};

export default legal;
