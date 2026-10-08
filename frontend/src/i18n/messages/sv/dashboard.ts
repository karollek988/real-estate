/**
 * The signed-in area ("Mitt konto"): the menu, the overview with the customer's analyses, the purchases and
 * balance page, discount codes, settings and the privacy summary. (The viewing guide, "Visningsguide", is
 * in inspection.ts; the store in buy.ts; the balance box in balance.ts.)
 *
 * <link>...</link> is a link, <b>...</b> bold text; {name}, {date}, {count} and {email} are filled in by the code.
 */
const dashboard = {
  /** The tabs under the header. */
  nav: {
    overview: "Översikt",
    inspection: "Visningsguide",
    settings: "Inställningar",
    coupons: "Kuponger",
    purchases: "Köp & saldo",
  },

  overview: {
    /** {name} is the customer's first name. */
    greeting: "Hej {name}! 👋",
    /** Used in the greeting when the customer has no name. */
    nameFallback: "there",
    /** Used as the customer's name when the account has none. */
    unnamedUser: "Köpanalys-användare",
    lead: "Här är en översikt av din aktivitet och dina insikter.",
    stats: {
      brf: "BRF-analyser",
      area: "Områdesanalyser",
      hiddenCosts: "Dolda kostnader",
      total: "Analyser totalt",
    },
    analyses: "Dina analyser",
    empty: {
      title: "Skapa din första analys",
      text: "Du har inga analyser än. Analysera området runt en adress, eller ta fram hela bilden av en bostad med Trygghetspaketet.",
      action: "Skapa din första analys",
    },
  },

  /** One of the customer's analyses in the list. */
  analysis: {
    /** The line about the housing association review. {when} is the time it is due, written out. */
    brf: {
      published: "BRF-analysen är granskad och klar",
      dueBy: "BRF-analysen granskas av våra experter — klar senast {when}",
      pending: "BRF-analysen granskas av våra experter och publiceras så snart den är klar",
    },
    /** The name of the kind of analysis, or a note while it is not finished. */
    plan: {
      pending: "Väntar",
      failed: "Misslyckades",
      full: "Trygghetspaket",
      area: "Områdesanalys",
    },
    type: "Analystyp",
    open: "Öppna analys",
    status: {
      ready: "Ready",
      processing: "Processing",
      expired: "Expired",
    },
    continueInspection: "Fortsätt till visningsguiden",
    uploadReport: "Ladda upp föreningens årsredovisning",
    uploading: "Laddar upp...",
    uploadThanks: "Tack! Årsredovisningen är mottagen och granskas av Köpanalys.",
    delete: "Ta bort",
    deleting: "Tar bort...",
  },

  profile: {
    memberSince: "Medlem sedan",
    email: "E-post",
    edit: "Redigera profil",
  },
  quickActions: {
    title: "Snabbåtkomst",
    newAnalysis: "Skapa ny analys",
  },
  storePromo: {
    title: "Behöver du fler analyser?",
    text: "Köp en Områdesanalys, Trygghetspaketet för en bostad eller ett paket för tre.",
    cta: "Se paketen",
  },
  inspectionBanner: {
    title: "Behöver du hjälp inför din visning?",
    text: "Visningsguiden, som ingår i Trygghetspaketet, hjälper dig att förstå bostadens skick innan du lägger bud. Få en grundlig genomgång av risker och dolda fel.",
    cta: "Till visningsguiden",
  },

  purchases: {
    title: "Köp & saldo",
    lead: "Se hur många analyser du har kvar och vad som finns på kontot. Köp en Områdesanalys eller ett Trygghetspaket när du behöver fler.",
    packages: "Se paketen",
  },

  coupons: {
    title: "Kuponger",
    lead: "Dina rabattkoder. Skriv in en kod när du köper ett paket.",
    kind: {
      trygghetspaket: "50% rabatt på ett Trygghetspaket",
      omradesanalys: "50% rabatt på en Områdesanalys",
    },
    status: {
      active: "Aktiv",
      reserved: "Reserverad",
      redeemed: "Använd",
    },
    copy: "Kopiera kod",
    reservedNote: "Koden är reserverad för en pågående betalning.",
    redeemedNote: "Koden har redan använts.",
    empty: {
      title: "Inga rabattkoder just nu",
      text: "Du har inga rabattkoder på kontot. Har du fått en kod av oss kan du skriva in den direkt när du köper ett paket.",
      action: "Se paketen",
    },
  },

  settings: {
    title: "Inställningar",
    lead: "Hantera ditt konto och dina uppgifter.",
    profile: {
      title: "Kontouppgifter",
      lead: "Ändra ditt namn eller din e-postadress. Du behöver bekräfta med ditt lösenord.",
      name: "Namn",
      namePlaceholder: "Ditt namn",
      email: "E-post",
      /** An example e-mail address. */
      emailPlaceholder: "din@epost.se",
      currentPassword: "Nuvarande lösenord",
      passwordNote: "Krävs för att ändra namn eller e-post.",
      save: "Spara ändringar",
      saving: "Sparar...",
      saved: "Dina uppgifter har uppdaterats.",
      errors: {
        name: "Namnet får inte vara tomt.",
        email: "Ange en giltig e-postadress.",
        password: "Ange ditt nuvarande lösenord för att spara ändringarna.",
        generic: "Något gick fel. Försök igen.",
      },
    },
    delete: {
      title: "Radera konto",
      text: "Detta tar permanent bort ditt konto, dina beslutsanalyser och sparade bostäder. Delade BRF-årsredovisningar och delad marknadsdata påverkas inte.",
      button: "Radera konto",
      /** {email} is the account's address. */
      confirm: "Skriv din e-postadress ({email}) för att bekräfta:",
      permanent: "Radera konto permanent",
      deleting: "Raderar...",
      cancel: "Avbryt",
      errors: {
        mismatch: "E-postadressen stämmer inte överens med ditt konto.",
        generic: "Något gick fel. Försök igen.",
      },
    },
  },

  privacy: {
    title: "Sekretess",
    /** <link> goes to the full privacy policy. */
    lead: "En sammanfattning av vilka uppgifter Köpanalys har om dig och hur de används. Se vår fullständiga <link>integritetspolicy</link> för mer detaljer.",
    account: {
      title: "Dina kontouppgifter",
      name: "Namn:",
      created: "Konto skapat: {date}",
      note: "Dessa uppgifter lagras för att kunna tillhandahålla tjänsten och för att du ska kunna logga in och se din historik.",
    },
    analyses: {
      title: "Dina analyser",
      /** <link> goes to the overview ("Mina analyser" is the name of that page in the menu). */
      text: "När du begär en analys av en bostad kopplas den begäran till ditt konto så att du kan se din historik på <link>Mina analyser</link>. Själva analysdata (bedömningar, marknadsdata, jämförelser) delas och cachas mellan användare — den är inte personlig för dig. Det innebär att andra användare som analyserar samma bostad kan se samma underliggande data, men inte att just du har begärt analysen.",
      count: "Du har gjort <b>{count}</b> {count, plural, one {analys} other {analyser}} hittills.",
    },
    never: {
      title: "Vad vi INTE gör",
      text: "Köpanalys säljer inte dina uppgifter till tredje part. Din analyshistorik, din e-postadress och övrig kontoinformation används endast för att driva tjänsten och, om du samtyckt, för vår egen marknadsföring och produktförbättring. Vi delar eller säljer aldrig dina personuppgifter till externa köpare.",
    },
    cookies: {
      title: "Cookie-inställningar",
      text: "Du kan när som helst återkalla eller ändra ditt samtycke för marknadsförings- och analyscookies.",
      button: "Ändra cookie-inställningar",
    },
  },
};

export default dashboard;
