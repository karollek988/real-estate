import type { Messages } from "../types";

/** The frequently asked questions. Same keys as ../sv/faq.ts; translate the values only. The chat assistant answers from these texts. */
const faq: Messages["faq"] = {
  eyebrow: "FAQ",
  title: "Frequently asked questions",
  description: "This is what most people wonder about before they create their first analysis.",
  contact: "Can't find the answer? Contact us",
  showAll: "Show all questions ({count})",

  items: {
    "vad-ar-kopanalys": {
      question: "What is Köpanalys?",
      answer:
        "Köpanalys is an independent review of the home you want to buy. The report gathers everything that matters for a home purchase in one place: the housing association's finances in plain language, the area, possible risks and the questions to ask the estate agent and the association. We do not sell the home and we do not sell the price – we give you the information so that you know what you are buying.",
    },
    "hur-fungerar-det": {
      question: "How does a home analysis work?",
      answer:
        "You upload one or more screenshots of the listing – from any property site – or fill in the details yourself. We read the key details and you check them. Then we collect data about the area, the association and the costs from several sources and put everything together in one report. The area section and the other automatic parts are ready in a few minutes; the association's finances are reviewed by a person and added within 24 hours.",
    },
    datakallor: {
      question: "What data do you use?",
      answer:
        "The association's finances come from the association's own annual report. Area and market data are collected from sources including Booli, Statistics Sweden (SCB), the Riksbank, SMHI, the Swedish Transport Administration, the National Agency for Education, the Police and Kolada, plus Lantmäteriet through geocoding and OpenStreetMap. Every source is listed in the report.",
    },
    "hur-saker": {
      question: "How reliable is the analysis?",
      answer:
        "Every piece of information in the report comes from a source that we state, and the association's key figures are checked by a person against the annual report before they are shown. The report still does not replace a survey or your own review of the association's documents – see it as the basis for your own questions.",
    },
    pris: {
      question: "What does an analysis cost? How do I pay?",
      answer:
        "An Area analysis costs SEK {areaPrice, number}. The Peace of Mind Package – the complete analysis of a home with a housing association analysis, area analysis and hidden costs – costs SEK {packagePrice, number} per home. If you want to analyse three homes, the package for three homes costs SEK {bundlePrice, number} (SEK {perHome, number} per home). All prices are one-off payments including VAT, and you pay by card through Stripe. We have no subscriptions.",
    },
    "vilka-bostader": {
      question: "Can I analyse any home?",
      answer:
        "You can analyse homes in Sweden: flats (tenant-owned, bostadsrätt), villas, terraced houses, semi-detached houses, linked houses and holiday homes. You add the home by uploading screenshots of the listing or by filling in the details yourself. The housing association analysis applies to homes that belong to a housing association.",
    },
    "vad-ingar": {
      question: "What is included in the report?",
      answer:
        "The Peace of Mind Package is the complete analysis of a home: the housing association analysis (reviewed by our experts within 24 hours), the area analysis, the property information, possible risks, the area's outlook, questions for the viewing and the viewing guide. The housing cost calculation is launching soon. Anyone who buys a full analysis always gets access to the whole report.",
    },
    "hur-lang-tid": {
      question: "How long does the analysis take?",
      answer:
        "The Area analysis and the automatic parts of the Peace of Mind Package are usually ready within a couple of minutes. The housing association analysis is reviewed by a person and is ready within 24 hours – you get an email when it has been published in your report.",
    },
    "innan-visning": {
      question: "Can I use Köpanalys before a viewing?",
      answer:
        "Yes, that is when the report is most useful. It contains the questions to ask the estate agent and the association, and the Peace of Mind Package includes a viewing guide with what you should look for on site.",
    },
    "maklare-besiktning": {
      question: "Is Köpanalys a replacement for an estate agent or a surveyor?",
      answer:
        "No. The estate agent is hired by the seller, and a survey examines the condition of the house on site – Köpanalys does not do that. We gather and explain what is hard to see for yourself: the association's finances, the area and the costs. See the report as a complement to the survey and to your questions to the estate agent.",
    },
    "vem-granskar-brf": {
      question: "Who reviews the housing association analysis?",
      answer:
        "One of Köpanalys' experts. Our analysis engine reads the key figures in the association's annual report, and a person checks every figure against the annual report, fills in what is missing and writes a comment before the analysis is published in your report. The housing association analysis is ready within 24 hours of your purchase, and you get an email when it is ready. The other parts of the report – for example the area and the risks – are automatic and ready straight away.",
    },
    arsredovisning: {
      question: "Do I have to upload the association's annual report myself?",
      answer:
        "No. If you have it (you usually get it from the estate agent or the association) you can upload it in the report, and the review goes faster. Otherwise we will obtain it for you.",
    },
    "bra-eller-daliga-siffror": {
      question: "How do you know which figures are good or bad?",
      answer:
        "We compare each key figure with the levels that banks and housing organisations – including SBAB, HSB and Handelsbanken – tend to describe as low and high, and with the average among Swedish associations according to Nabo's analysis of 2,250 annual reports. The key figures are those that every housing association has had to report since 2023. They are comparisons, not a grade for the association.",
    },
    radgivning: {
      question: "Do you give purchase advice? Do you tell me whether to buy or not?",
      answer:
        'No. Köpanalys is not an adviser and gives no purchase recommendations. The report shows what the information says and what it means for you – it never classifies the home as a "good" or "bad" purchase. The decision is always yours.',
    },
    boendekalkyl: {
      question: "What is the housing cost calculation?",
      answer:
        "The housing cost calculation shows what the home really costs you: the fee, interest and amortisation every month, and one-off costs such as title registration (lagfart) and mortgage deeds. It is being finished and launches soon. Already now the housing association analysis shows costs that are easy to miss, for example your share of the association's loans and how the fee is affected if interest rates rise.",
    },
    omradesanalys: {
      question: "What is included in an Area analysis?",
      answer:
        "The Area analysis is a separate analysis of the area around an address: services, schools and commuting near the home, safety and community data, and how the population and prices develop. It is automatic and ready in a few minutes. You get a report about the area and nothing else – the association's finances and the risks are included in the Peace of Mind Package.",
    },
    "ingen-analys-kvar": {
      question: "What happens if I have no analyses left?",
      answer:
        "Then no analysis is run and nothing is deducted from you. Buy an Area analysis or a Peace of Mind Package and you can continue. If an analysis cannot be completed, for example because we cannot obtain enough information about an address, your analysis is returned to you automatically.",
    },
    ai: {
      question: "Is AI used in the analysis?",
      answer:
        'To a limited extent. The chat assistant is powered by an AI language model (OpenAI). The key figures in the annual report are read automatically by our analysis engine and then checked by a person at Köpanalys. No AI gives the home a grade or a score – Köpanalys does not judge whether a home is a "good" or "bad" purchase.',
    },
    sokhistorik: {
      question: "Do you save my search history and my analyses?",
      answer:
        "Yes – your analysis requests (which homes you have looked at and when) are saved on your account so that you can see your history on the dashboard. The analysis data behind them is shared and cached per home, not personal. You can read more about your data on the dashboard's Privacy page.",
    },
    pdf: {
      question: "Can I download the report as a PDF?",
      answer:
        'Yes – every finished report has a "Download PDF" button so that you can easily save or share it. The report can also be read in full directly in the browser on a computer or phone.',
    },
    "avsluta-konto": {
      question: "How do I cancel or close my account?",
      answer:
        "If you have an older subscription, you cancel it under Purchases & balance on the dashboard. To delete your account and all your saved details completely, contact us through the link below and we will help you.",
    },
  },
};

export default faq;
