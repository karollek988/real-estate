/** The "Så fungerar det" window that opens next to the analysis form: four steps from screenshot to report. */
const onboarding = {
  /** The window's name for screen readers, and its heading. */
  title: "Så fungerar det",
  close: "Stäng",
  lead: "Fyra steg från skärmdump till färdigt beslutsunderlag.",
  steps: {
    account: {
      title: "Skapa ett gratis konto",
      description: "Registrera dig på några sekunder för att få tillgång till dina analyser.",
    },
    upload: {
      title: "Ladda upp skärmdumpar av annonsen",
      description:
        "Många bostadssajter blockerar numera automatiserad hämtning av deras sidor, så istället för en länk visar du oss annonsen direkt — en eller flera skärmdumpar fungerar överallt. Du kan även fylla i uppgifterna manuellt.",
    },
    check: {
      title: "Kontrollera uppgifterna",
      description: "Vi läser av de viktigaste uppgifterna åt dig — du granskar och rättar till innan du går vidare.",
    },
    report: {
      title: "Få ett samlat underlag",
      description:
        "Området, riskerna och frågorna inför visningen är klara på några minuter. Föreningens ekonomi granskas av våra experter och läggs till i rapporten inom 24 timmar.",
    },
  },
  duration: "Tar vanligtvis mindre än 60 sekunder",
  /** The green button at the bottom: closes the window and moves to the analysis form. */
  cta: "Jag vill testa",
};

export default onboarding;
