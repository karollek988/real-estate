import type { Messages } from "../types";

/**
 * The privacy policy and the terms of use. Same keys as ../sv/legal.ts; translate the values only.
 *
 * These are legal texts. The Swedish text is the one that applies; this translation is a help for readers who do
 * not read Swedish, and says so at the top of the pages (translationNotice).
 *
 * Tags inside the texts: <mail></mail> (the e-mail address, as a link), <b>…</b> (bold), <code>…</code> (a name
 * in code type), <imy>…</imy> (a link to the Swedish Authority for Privacy Protection), <br></br> (a line break).
 */
const legal: Messages["legal"] = {
  translationNotice: "This is a translation of the Swedish text. If the texts differ, the Swedish version applies.",

  privacy: {
    meta: {
      title: "Privacy policy",
      description: "How Köpanalys processes your personal data.",
    },
    title: "Privacy policy",
    updated: "Last updated: 8 October 2026",

    controller: {
      title: "Data controller",
      text: "Köpanalys (organisation number 9811048793) is the data controller for the processing of your personal data. If you have questions about how we process your data, contact us at <mail></mail>.",
    },

    data: {
      title: "What data we collect",
      necessary: {
        title: "Necessary data (required for the service)",
        intro: "This data is always collected without separate consent because it is necessary in order to provide the service:",
        session: "Sign-in and session data (handled by Supabase, our authentication provider)",
        account: "Account details such as your e-mail address and, if you choose to give it, your name",
        analyses:
          "Data needed to generate and store the property analysis reports you request (addresses, linked listings, saved analysis results)",
        chat: "Content you send to our chat assistant, and the content of documents (for example survey reports or housing association annual reports) you upload to have them summarised — see section 4 on how this is handled by our AI provider.",
        translation:
          "Text you write in a listing on the map. The listing is only saved in your browser, but when the page is shown in another language the text of the listing is sent to our own server to be translated automatically, and the translation is saved together with the original text so that it does not have to be translated again. It is not linked to your account or your IP address and is not sent to any external translation service.",
        language:
          "Your choice of language. If you choose a language yourself with the language picker, the choice is saved in a cookie, <code>NEXT_LOCALE</code>, which contains only the language code (for example \"en\"). It is kept for one year on your device, is only set once you make a choice, and is not used for analytics or marketing.",
      },
      stats: {
        title: "Visitor statistics (without cookies)",
        p1: "We count how many people visit the website and what kind of device they use — mobile, tablet or computer — in order to understand and improve the service. The counting is done by our own server, sets no cookies and stores nothing on your device. We do not save your IP address, your browser's full identification or which pages you look at.",
        p2: "So that the same visitor is not counted several times in a day, a one-time value is created from your IP address and browser identification together with today's date and a secret key that only our server knows. The value cannot be traced back to you and is different every day, so you cannot be followed from one day to the next. It is deleted after two days. What is kept long term is only totals per day and type of device. Visitors who have Do Not Track or Global Privacy Control switched on in their browser are not counted at all.",
      },
      marketing: {
        title: "Marketing & analytics (requires consent)",
        p1: "If you choose \"Accept all\" in the cookie banner, we set a single analytics cookie, <code>ka_src</code>. It contains only where you first came from, in the form of a channel and a source, for example \"search engine, Google\" or \"AI search engine, ChatGPT\" or \"direct\". It contains no ID, no address and no pages, and it is kept for 90 days on your device.",
        p2: "The purpose is to know how many new visitors come from search engines, AI search engines, social media and ads, so that we can judge which channels work. Your browser itself works out where you came from (from the page that linked here and any campaign tags in the address) and sends only the result to our server, never the linking address. The first time, when you accept, a new visitor is counted for that channel; as long as the cookie exists you are not counted again. What is saved is only totals per day, channel and source, which cannot be linked to you.",
        p3: "We also count, without a cookie and without any ID, how many people accept and how many decline in the banner, so that we can estimate how many new visitors we have in total. If you have Do Not Track or Global Privacy Control switched on, no cookie is set and nothing is counted. If you decline or change your mind via \"Cookie settings\" at the bottom of the page, the cookie is removed.",
        p4: "Beyond this, Köpanalys uses no analytics or marketing tools (for example ad tracking or third-party tools for user analytics). If we collect more in future, it will only be for visitors who have actively consented, and this policy will then be updated.",
      },
    },

    basis: {
      title: "Legal basis",
      necessary:
        "<b>Necessary data:</b> The processing is necessary to perform the contract with you (Article 6.1 b GDPR) — that is, to deliver the service you have registered for.",
      stats:
        "<b>Visitor statistics:</b> The processing is based on our legitimate interest in understanding how the website is used and improving it (Article 6.1 f GDPR). It is limited as far as possible: no cookie, nothing stored on your device, no IP address or page is saved, and the one-time value is deleted after two days.",
      marketing:
        "<b>Marketing & analytics</b> (the analytics cookie ka_src): The processing is based on your consent (Article 6.1 a GDPR). The counting of how many people accept and decline is done without a cookie and is based on our legitimate interest (Article 6.1 f), in the same way as the visitor statistics above.",
    },

    recipients: {
      title: "Third parties / recipients",
      intro:
        "Köpanalys does not share your personal data with external buyers. We do, however, use data processors who act on our instructions to run the service:",
      supabase: "<b>Supabase</b> — hosting, authentication and database (data processor)",
      stripe: "<b>Stripe</b> — payment handling (data processor)",
      openai:
        "<b>OpenAI</b> (USA) — runs our chat assistant and interprets the content of uploaded estate agent documents and housing association annual reports in order to summarise them for you (data processor). Never used to give a home a grade or a score.",
      resend:
        "<b>Resend</b> — delivery of transactional e-mails (for example confirmation of your e-mail address and replies to the contact form) (data processor)",
      safeguards:
        "All processors are bound by contract to follow applicable data protection law and may only process the data in accordance with Köpanalys' instructions. When a processor (for example OpenAI) is established outside the EU/EEA, the transfer is safeguarded by the European Commission's standard contractual clauses (SCC) or equivalent safeguards.",
    },

    retention: {
      title: "Retention period",
      accounts:
        "<b>Account details</b> are kept for as long as your account is active and for a reasonable time after it is closed (up to 12 months) to meet accounting and legal obligations.",
      analyses: "<b>Analysis data</b> (addresses, saved reports) is kept for as long as your account is active, or until you delete it yourself.",
      stats:
        "<b>Visitor statistics:</b> the one-time value used to count a visitor once a day is deleted after two days. The totals per day and type of device, which cannot be linked to any individual visitor, are kept until further notice.",
      cookie:
        "<b>The analytics cookie ka_src</b> is kept for 90 days on your device, or until you decline or withdraw your consent. The totals per day, channel and source, which cannot be linked to any individual visitor, are kept until further notice.",
      language: "<b>The language cookie NEXT_LOCALE</b> is kept for one year on your device, or until you clear it.",
      translation: "<b>Translated listing texts</b> (the original text and its translation) are kept until further notice and can be deleted on request: contact us.",
      other:
        "<b>Other marketing and analytics data</b>, if any is collected in future, is kept for at most 24 months from the time of collection, or until you withdraw your consent.",
    },

    rights: {
      title: "Your rights",
      intro: "You have the following rights under the GDPR:",
      access: "The right of access (a copy of your data)",
      rectification: "The right to rectification of incorrect data",
      erasure: "The right to erasure (\"the right to be forgotten\")",
      objection: "The right to object to processing for direct marketing",
      portability: "The right to data portability",
      complaint: "The right to lodge a complaint with the supervisory authority — <imy>the Swedish Authority for Privacy Protection (IMY)</imy>",
      exercise: "To exercise your rights, contact us at <mail></mail>.",
    },

    consent: {
      title: "How to withdraw consent",
      p1: "If you have previously consented to the collection of marketing and analytics data but change your mind, you can withdraw your consent at any time. This means that no further data in that category is collected from the moment of withdrawal. Data already collected may continue to be used in anonymised or aggregated form.",
      p2: "This is how you withdraw your consent:",
      viaBanner:
        "Clear the choice stored by the cookie banner by clicking \"Cookie settings\" at the bottom of the page and adjusting your preferences, or",
      viaMail: "Contact us at <mail></mail> and we will help you.",
    },

    contact: {
      title: "Contact",
      intro: "Do you have questions about this privacy policy or how we process your personal data? Contact us:",
      address: "Köpanalys<br></br>Organisation number: 9811048793<br></br>E-mail: <mail></mail>",
    },
  },

  terms: {
    meta: {
      title: "Terms of use",
      description: "The terms for using Köpanalys.",
    },
    title: "Terms",

    service: {
      title: "Description of the service",
      text: "Köpanalys is an automated analysis tool that compiles public and third-party data about homes to give you an overview of a property or tenant-owned flat. The information presented in an analysis report is <b>not</b> financial advice, a purchase recommendation or a valuation. Köpanalys reports what the available data shows without passing a final judgement or recommending a specific decision. You should always make your own assessment and, where necessary, consult a licensed estate agent, lawyer or financial adviser before you make a decision to buy a home.",
    },
    account: {
      title: "Account and use",
      text: "To use Köpanalys you must create an account. You are responsible for the details you give being correct and kept up to date. The account is personal and you must not share your sign-in details with anyone else. You must not use the service for automated data scraping, bulk analysis or any other improper load on the system. Köpanalys reserves the right to restrict or suspend accounts that misuse the service.",
    },
    credits: {
      title: "Analyses and credits",
      p1: "Analyses are bought as one-off purchases via Stripe: an Area analysis, a Peace of Mind Package for one home or a package for three homes. The purchase gives analyses on your account that you use when you request an analysis. Whoever creates a full analysis gets access to the whole report, and whoever creates an Area analysis gets a report on the area. If an analysis cannot be completed, it is returned to your account. Once an analysis has been used and the report delivered, the purchase is regarded as completed in accordance with the rules for digital goods.",
      p2: "Swedish consumers have a statutory right to withdraw from a distance purchase within 14 days (the Distance Contracts Act, distansavtalslagen). For digital services that have started to be delivered with the consumer's express consent and acknowledgement that the right of withdrawal is thereby lost, the right of withdrawal ends once delivery has begun. By requesting and opening an analysis report you confirm that you lose your right of withdrawal for that particular analysis. Any questions about refunds are handled case by case within the framework of applicable consumer protection law.",
    },
    ip: {
      title: "Intellectual property rights",
      text: "Köpanalys owns all rights to the platform, the analysis tools and the report format. When you buy or receive an analysis report you get a personal, non-exclusive and non-transferable licence to use the report for your own home purchase. You have no right to pass on, publish or commercially exploit the report without Köpanalys' express consent.",
    },
    termination: {
      title: "Termination",
      text: "Köpanalys reserves the right to suspend or terminate your account at any time if you breach these terms or otherwise use the service in a way that may harm Köpanalys, other users or third parties. On termination your access to the service ends and any unused analysis credits are forfeited.",
    },
    law: {
      title: "Governing law and disputes",
      text: "These terms are governed by Swedish law. Disputes are to be resolved primarily by settlement. Consumer disputes can be referred to the National Board for Consumer Disputes (Allmänna reklamationsnämnden, ARN). As a consumer you also have the right to turn to ARN for mediation before bringing an action in a general court.",
    },
    contact: {
      title: "Contact",
      text: "Do you have questions about these terms? Contact us at <mail></mail>.",
    },
    liability: {
      title: "Limitation of liability",
      text: "Analysis reports are generated through automated processing of public registers and third-party data sources. Köpanalys does not guarantee the completeness or accuracy of such underlying data that Köpanalys does not produce itself. The content of the report is not a substitute for independent due diligence, a professional survey or licensed financial or legal advice before a home purchase. To the extent permitted by applicable law, Köpanalys is not liable for decisions made on the basis of an analysis report or for losses arising from inaccuracies in third-party data sources.",
    },
  },
};

export default legal;
