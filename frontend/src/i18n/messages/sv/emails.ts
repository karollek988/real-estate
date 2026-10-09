/**
 * The e-mails Köpanalys sends to customers: the account e-mails (confirm your address, reset your password ...)
 * and the one that says the housing association analysis is ready. They are written in the language the
 * customer's account was created in (the account remembers it), or the language they last used when ordering.
 *
 * What is shown to the team (the e-mails about new reviews) is in Swedish only and is not here.
 * Keep the texts short: an e-mail is read quickly, often on a phone.
 */
const emails = {
  /** The line at the bottom of every e-mail; the address is written after it. */
  footer: "Frågor? Skriv till",
  /** Under the button, followed by the address of the button as a link. */
  fallbackLink: "Om knappen inte fungerar, kopiera in den här länken i din webbläsare:",
  /** At the end of the account e-mails. */
  ignore: "Bad du inte om det här? Du kan ignorera det här mejlet.",

  signup: {
    subject: "Bekräfta ditt konto hos Köpanalys",
    preheader: "Bekräfta din e-postadress för att aktivera ditt Köpanalys-konto.",
    /** {name} is the customer's first name. */
    greetingNamed: "Hej {name}!",
    greeting: "Hej!",
    body: "Tack för att du skapat ett konto hos Köpanalys! Bekräfta din e-postadress för att komma igång.",
    button: "Bekräfta mitt konto",
  },

  /** The other account e-mails, by what the account system calls them. Each has a subject, a heading, a text and the button's words. */
  account: {
    recovery: {
      subject: "Återställ ditt lösenord — Köpanalys",
      heading: "Återställ ditt lösenord",
      body: "Vi har fått en begäran om att återställa lösenordet för ditt Köpanalys-konto. Klicka på knappen nedan för att välja ett nytt lösenord.",
      cta: "Återställ lösenord",
    },
    magiclink: {
      subject: "Din inloggningslänk — Köpanalys",
      heading: "Logga in på Köpanalys",
      body: "Klicka på knappen nedan för att logga in på ditt Köpanalys-konto.",
      cta: "Logga in",
    },
    email_change: {
      subject: "Bekräfta din nya e-postadress — Köpanalys",
      heading: "Bekräfta din nya e-postadress",
      body: "Klicka på knappen nedan för att bekräfta att den här e-postadressen ska kopplas till ditt Köpanalys-konto.",
      cta: "Bekräfta e-postadress",
    },
    reauthentication: {
      subject: "Bekräfta din identitet — Köpanalys",
      heading: "Bekräfta din identitet",
      body: "Vi behöver bekräfta att det är du innan vi fortsätter. Klicka på knappen nedan för att fortsätta.",
      cta: "Bekräfta",
    },
    invite: {
      subject: "Du har blivit inbjuden till Köpanalys",
      heading: "Du har blivit inbjuden",
      body: "Klicka på knappen nedan för att skapa ditt Köpanalys-konto.",
      cta: "Skapa konto",
    },
    /** For any other kind of account e-mail. */
    other: {
      subject: "Ett meddelande om ditt Köpanalys-konto",
      heading: "Ett meddelande om ditt konto",
      body: "Klicka på knappen nedan för att fortsätta.",
      cta: "Fortsätt",
    },
  },

  /** Sent when the reviewed housing association analysis has been published. {address} is the home's address. */
  /** Sent when a reviewer releases a customer's report for the first time. {address} is the home's address. */
  reportReady: {
    subject: "Din rapport för {address} är klar",
    preheader: "Rapporten är granskad av Köpanalys och finns nu att läsa.",
    heading: "Din rapport är klar",
    intro: "En person på Köpanalys har granskat rapporten för {address}.",
    body: "Öppna rapporten med knappen nedan. Du hittar den också under Mitt konto.",
    cta: "Öppna rapporten",
  },
  brfReady: {
    subject: "Din BRF-analys för {address} är klar",
    preheader: "Föreningens ekonomi är granskad och finns nu i din rapport.",
    heading: "Din BRF-analys är klar",
    intro: "Våra experter har granskat föreningens årsredovisning för {address}.",
    body: "I rapportens kapitel Bostadsrättsförening ser du nu föreningens nyckeltal förklarade i klartext, vad de betyder för dig i kronor och vilka frågor som är bra att ställa inför visningen.",
    cta: "Öppna rapporten",
  },
};

export default emails;
