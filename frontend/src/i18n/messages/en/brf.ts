import type { Messages } from "../types";

/**
 * The housing association ("bostadsrättsförening", BRF) chapter of the report. Same keys as ../sv/brf.ts;
 * translate the values only.
 *
 * A reviewer at Köpanalys records the key figures from the association's annual report; this file holds every
 * sentence written about them. Numbers, kronor and percentages are written by the code in the reader's language
 * and handed in as {value}, {amount}, {year} and so on. The benchmark texts (what counts as "low" or "high")
 * contain figures written in the text itself: write them the way your readers write numbers.
 * What the reviewer wrote by hand (the comment, planned renovations, the date a fee change takes effect) is
 * shown as the reviewer wrote it, in Swedish.
 */
const brf: Messages["brf"] = {
  /** How amounts are written in these texts.   is a space that keeps the number and the unit on one line. */
  format: {
    kr: "SEK {value}",
    krPerSqm: "SEK {value}/m²",
    percent: "{value}%",
    /** {sign} is "+" or "−" (or nothing). */
    signedKr: "{sign}SEK {value}",
  },

  /** The chapter itself, as the page shows it. */
  analysis: {
    notApplicable: "The home does not belong to a housing association, so there are no association finances to review.",
    awaiting: {
      title: "The housing association analysis is being reviewed by our experts",
      overdue: "The review is taking a little longer than promised — the analysis will be published here as soon as it is ready.",
      dueBy: "Ready by {due} at the latest",
      within24: "Ready within 24 hours of the order",
      /** {association} is "Brf Exempelgården's" (the name with 's) or "the association's" when the name is not known. */
      body: "The association's finances are the part of a home purchase that is hardest to judge on your own, so this part is not simply read automatically. One of Köpanalys' experts goes through {association} annual report, checks every key figure and explains what the numbers mean for you — before the analysis is shown here. The other parts of the report are finished and can be read right away.",
      /** The association's name with the ending that makes it possessive ("Brf Exempelgården" -> "Brf Exempelgården's"). */
      associationNamed: "{name}'s",
      associationUnnamed: "the association's",
      received: "We have received the association's annual report and are reviewing it now.",
      notReceived: "Do you have the association's latest annual report? Upload it below and the review will be quicker — otherwise we will find it ourselves.",
      includedTitle: "What you get in the housing association analysis",
      included: {
        figures:
          "The association's debt, savings and interest rate sensitivity — explained in plain language and compared with what is usually counted as low and high.",
        forYou: "What the association's finances mean for you in kronor: your share of the association's loans and how the fee is affected if interest rates rise.",
        plans: "Pipe replacement, planned maintenance, leasehold land and decided fee increases.",
        questions: "Questions to ask the association and the estate agent.",
      },
    },
    reviewed: "Reviewed by Köpanalys",
    /** {day} is the date it was published. */
    reviewedOn: "Reviewed by Köpanalys · {day}",
    basis: "Based on the annual report for {year}",
    updating: "A newer annual report is being reviewed right now.",
    updatingSoon: "The analysis will be updated as soon as the review is finished.",
    updatingDue: "The analysis will be updated by {due} at the latest.",
    strengths: "This looks good",
    concerns: "Worth a closer look",
    forYou: "What it means for you",
    keyFigures: "Key figures",
    loans: "The association's loans",
    association: "The association and its maintenance",
    /** {list} is the figures the annual report does not state. */
    missing: "The annual report does not state {list}.",
    expertComment: "Comment from the reviewer",
    /** {sources} is the sentence "sources" below. */
    note: "The key figures are taken from the association's annual report and checked by a reviewer at Köpanalys. The assessments compare each key figure with what is usually counted as low and high; they are not a rating of the association. {sources}",
    /** The upload box. */
    upload: {
      button: "Upload annual report",
      uploading: "Uploading…",
      reading: "We are reading the document — it can take up to a minute for a scanned report.",
      success: "Thank you! The annual report has been received and is being reviewed by Köpanalys.",
    },
  },

  /** The sentence for the summary and the risks chapter. {day} is the date, {due} the time it is due. */
  status: {
    notApplicable: "The home does not belong to a housing association, so there are no association finances to review.",
    overdue:
      "The housing association analysis is being reviewed by Köpanalys' experts. The review is taking a little longer than promised — the analysis will be published in the Housing association chapter as soon as it is ready.",
    dueBy: "The housing association analysis is being reviewed by Köpanalys' experts before it is shown, and will be published in the Housing association chapter by {due} at the latest.",
    within24: "The housing association analysis is being reviewed by Köpanalys' experts before it is shown, and will be published in the Housing association chapter within 24 hours.",
    published: "The housing association analysis has been reviewed by Köpanalys{day}. {counts}",
    publishedDay: " ({day})",
    countsNone: "None of the key figures lie outside the levels usually counted as normal.",
    countsFew: "The annual report contains few of the key figures that can be compared.",
    /** {list} is the first one or two points, written in lower case and joined with "and". */
    countsSome: "{count, plural, one {# point is} other {# points are}} worth a closer look, including {list}.",
  },

  /** The chapter's opening lines. */
  intro: {
    named: "The home belongs to {name}.",
    unnamed: "The association's name does not appear in the listing; it is checked when the annual report is reviewed.",
    /** {kept} is the name used, {source} the other source and {rejected} the name it gave. */
    conflict:
      "Please note: the data sources disagree about the association's name. We have used \"{kept}\", while another source ({source}) gave \"{rejected}\" — check the name against the association's bylaws.",
  },

  /** A time: "Friday 3 October at 14:30". {date} and {time} are written by the code. */
  dueTime: "{date} at {time}",

  /** Where the benchmarks come from; the date they were checked is part of the text. */
  sources:
    "Guideline values: SBAB, HSB and Handelsbanken. Averages: Nabo's analysis of the annual reports of 2,250 associations for 2023. Definitions: the Swedish Accounting Standards Board (BFNAR 2023:1). The figures were checked in October 2026.",

  /** The mandatory key figures, as named in "The annual report does not state ...". Lower case. */
  keyFigureNames: {
    annualFeePerSqm: "annual fee per m²",
    debtPerSqmBr: "debt per m² of tenant-owned floor area",
    debtPerSqmTotal: "debt per m²",
    savingsPerSqm: "savings per m²",
    interestSensitivityPct: "interest rate sensitivity",
    energyCostPerSqm: "energy cost per m²",
    feeShareOfRevenuePct: "the annual fees' share of operating income",
  },

  /** What each figure is called, how it is judged, what it means and what is usual. */
  signals: {
    debt: {
      label: "Debt per m²",
      labelTotal: "Debt per m² (total area)",
      low: "Low debt",
      normal: "Normal debt",
      high: "High debt",
      veryHigh: "Very high debt",
      meaning:
        "The association's loans spread over each square metre. In practice the loans are paid by the members through the fee, so the higher the debt, the more the fee is affected by interest rates.",
      meaningNewBuilding:
        "In newer associations a higher debt is common because the property has recently been financed — read it together with the savings and the fee.",
      benchmark: "Under SEK 5,000/m² is usually counted as low, over SEK 10,000/m² as high and over SEK 15,000/m² as very high. The average was SEK 7,117/m² in 2023.",
    },
    savings: {
      label: "Savings per m²",
      negative: "Negative savings",
      low: "Low savings",
      moderate: "Moderate savings",
      good: "Good savings",
      meaning:
        "How much money the association has left per square metre and year for maintenance and loan repayments — the year's result adjusted for depreciation and planned maintenance. Low savings can mean that future maintenance has to be paid for with new loans or a higher fee.",
      benchmark:
        "Over SEK 200/m² is usually counted as good savings and under SEK 120–130/m² as low. The average was SEK 123/m² in 2023, and just under one association in five had negative savings.",
    },
    interestSensitivity: {
      label: "Interest rate sensitivity",
      low: "Low interest rate sensitivity",
      normal: "Normal interest rate sensitivity",
      high: "High interest rate sensitivity",
      veryHigh: "Very high interest rate sensitivity",
      /** {value} is a percentage. */
      meaning: "If the interest rate on the association's loans rises by one percentage point, the annual fees may have to be raised by around {value}.",
      benchmark: "Under 5–6% is usually counted as low and over 10% as high. The average was around 10% in 2023.",
    },
    fee: {
      label: "Annual fee per m²",
      low: "Low fee level",
      normal: "Normal fee level",
      high: "High fee level",
      veryHigh: "Very high fee level",
      meaning:
        "The members' combined annual fees per square metre of tenant-owned floor area. The level depends on what the fee includes, for example heating, water, electricity and broadband.",
      meaningLow: "A low fee is good for your wallet but can also mean that the association is saving too little — compare it with the savings.",
      benchmark: "SEK 500–850/m² per year is common; over SEK 1,000/m² is usually counted as high. The average was SEK 690/m² in 2023.",
    },
    energy: {
      label: "Energy cost per m²",
      low: "Low energy cost",
      normal: "Normal energy cost",
      high: "High energy cost",
      veryHigh: "Very high energy cost",
      meaning: "The association's costs for heating, electricity and water per square metre. High energy costs feed through to the fee when energy prices rise.",
      benchmark: "Around SEK 200/m² is normal in a block of flats; over SEK 250/m² is usually counted as high. The average was SEK 203/m² in 2023.",
    },
    feeShare: {
      label: "Fees' share of income",
      mostly: "Mainly financed by the fees",
      other: "Also has other income",
      dependent: "Heavily dependent on other income",
      meaning:
        "How large a share of the association's income comes from the members' annual fees. The rest comes from, for example, rent for commercial premises, rental flats and parking — such income keeps the fee down but can fall if a tenant moves out.",
      benchmark: "On average, 77% of associations' income came from annual fees in 2023.",
    },
    equity: {
      label: "Equity ratio",
      low: "Low equity ratio",
      moderate: "Moderate equity ratio",
      high: "High equity ratio",
      meaning:
        "How large a share of the association's assets is financed with equity. The equity ratio says less about a housing association than about a company, because it is affected by how the property was bought and depreciated — read it together with debt and savings.",
    },
    totalDebt: {
      label: "The association's loans",
      verdict: "Interest-bearing debt",
      meaning: "The association's total loans from banks and other credit institutions at the year end.",
    },
    averageRate: {
      label: "Average interest rate",
      verdict: "Average rate on the loans",
      meaning:
        "The average interest rate on the association's loans at the year end. When loans with a lower rate are renegotiated at a higher rate, the association's costs rise.",
    },
    renegotiation: {
      label: "Loans renegotiated within a year",
      soon: "A large share is renegotiated soon",
      share: "Share with a short fixed term",
      summary: "{value} of the loans are renegotiated within a year",
      meaning:
        "The part of the loans whose interest rate is reset or which fall due within twelve months. The larger the share, the faster a change in interest rates feeds through to the association's costs and the fee.",
    },
    genuine: {
      label: "Genuine association",
      yes: "Yes",
      yesVerdict: "Private housing company",
      yesSummary: "Genuine association (private housing company)",
      yesMeaning: "The association is a private housing company (a genuine association). The profit on a future sale is taxed at 22%.",
      no: "No",
      noVerdict: "Non-genuine association",
      noSummary: "Non-genuine association — higher tax on sale",
      noMeaning:
        "The association is not a private housing company (a non-genuine association). The profit on a future sale is then taxed at 25% instead of 22%, and the option to defer the tax is limited.",
    },
    land: {
      label: "The land",
      owned: "Freehold",
      ownedVerdict: "The association owns the land",
      ownedSummary: "The association owns the land",
      ownedMeaning: "The association owns the land the property stands on and pays no leasehold fee (tomträttsavgäld).",
      leasehold: "Leasehold",
      leaseholdVerdictYear: "The ground rent is renegotiated in {year}",
      leaseholdVerdict: "The association rents the land",
      leaseholdSummaryYear: "Leasehold — the ground rent is renegotiated in {year}",
      leaseholdSummary: "Leasehold — the association rents the land",
      leaseholdMeaning:
        "The association does not own the land but pays a leasehold fee (tomträttsavgäld) to the municipality. The fee is renegotiated at regular intervals and can then rise sharply, which feeds through to the monthly fee.",
      leaseholdMeaningYear: "The next renegotiation is in {year}.",
    },
    maintenancePlan: {
      label: "Maintenance plan",
      yes: "In place",
      yesVerdict: "Current maintenance plan",
      yesSummary: "A current maintenance plan exists",
      yesMeaning: "The association has a current plan for when the larger works on the property need to be done and what they are estimated to cost.",
      no: "Missing",
      noVerdict: "No current maintenance plan",
      noSummary: "No current maintenance plan",
      noMeaning: "The association states that it does not have a current maintenance plan, so it is harder to know when larger works will come and what they will cost.",
    },
    pipes: {
      label: "Pipe replacement",
      planned: "Planned for {year}",
      plannedVerdict: "Pipe replacement planned",
      plannedSummary: "Pipe replacement planned for {year}",
      plannedMeaning:
        "Replacing the pipes is one of the biggest jobs in a block of flats. It can mean a higher fee or new loans, and that bathrooms and kitchens cannot be used for a period.",
      done: "Carried out in {year}",
      doneVerdict: "Pipes replaced",
      doneSummary: "Pipe replacement carried out in {year}",
      doneMeaning: "The pipes in the property have been replaced, which is one of the largest and most expensive jobs in a block of flats.",
      unknown: "Not stated",
      unknownVerdict: "No pipe replacement stated",
      unknownSummary: "No pipe replacement stated in a building from {year}",
      unknownMeaning: "The building dates from {year}. Pipes usually need replacing after about 50 years, and the annual report does not show that a replacement has been done or planned.",
    },
    plannedRenovations: {
      label: "Planned maintenance",
      value: "See description",
      verdict: "Larger works planned",
      summary: "Larger maintenance works planned",
    },
    feeChange: {
      appliedLabel: "Fee change carried out",
      appliedUp: "The fee has been raised",
      appliedDown: "The fee has been lowered",
      /** {direction} is up or down; {value} the percentage; {from} the date it took effect. */
      appliedSummary: "The fee was {direction, select, up {raised} other {lowered}} by {value} from {from}",
      appliedMeaning:
        "According to the annual report, the fee was {direction, select, up {raised} other {lowered}} by {value} from {from}. The change is probably already included in the fee in the listing.",
      decidedLabel: "Decided fee change",
      decidedUp: "The fee is being raised",
      decidedDown: "The fee is being lowered",
      decidedSummary: "Decided fee {direction, select, up {increase} other {decrease}} of {value}",
      decidedSummaryFrom: "Decided fee {direction, select, up {increase} other {decrease}} of {value} from {from}",
      decidedMeaning: "The association has decided to {direction, select, up {raise} other {lower}} the fee by {value}.",
      decidedMeaningFrom: "The association has decided to {direction, select, up {raise} other {lower}} the fee by {value} from {from}.",
    },
    audit: {
      label: "The auditor's report",
      remark: "Qualification",
      remarkVerdict: "The auditor has made a remark",
      remarkSummary: "Remark in the auditor's report",
      remarkMeaning:
        "The auditor has made a remark or recommended against something in the auditor's report. That is unusual and means that something in the management or the accounts needs to be explained.",
      clean: "No remarks",
      cleanVerdict: "Clean auditor's report",
      cleanSummary: "Clean auditor's report",
      cleanMeaning: "The auditor has examined the accounts and the board's management without making any remark.",
    },
    size: {
      label: "Size of the association",
      apartments: "{count, plural, one {# tenant-owned flat} other {# tenant-owned flats}}",
      rentals: "{count, plural, one {# rental flat} other {# rental flats}}",
      commercial: "{count, plural, one {# commercial unit} other {# commercial units}}",
      smallVerdict: "Small association",
      verdict: "Size of the association",
      smallSummary: "Small association ({count} tenant-owned flats)",
      smallMeaning:
        "In a small association the costs of maintenance and unexpected expenses are shared between fewer households, so a single larger cost is more noticeable in the fee.",
      meaning:
        "The number of flats and commercial units in the association. The more households, the more share the costs of maintenance and unexpected expenses.",
      smallBenchmark: "Associations with fewer than ten flats are usually counted as small.",
    },
  },

  /** What it means for this home in kronor. {amount}, {fee}, {area} are written by the code. */
  impacts: {
    shareOfDebt: {
      label: "Your share of the association's loans",
      value: "around {amount}",
      explanation:
        "The association's loans are paid by the members through the fee. Based on the flat's living area ({area} m²), your share comes to roughly {amount} — on top of your own mortgage. The exact share depends on the flat's share ratio (andelstal).",
    },
    rateRise: {
      label: "If interest rates rise by 1 percentage point",
      value: "{amount}/month",
      explanation:
        "With the association's interest rate sensitivity of {sensitivity}, the fee may have to be raised by around {increase} a month (from {fee} to about {newFee}) if the interest rate on the association's loans rises by one percentage point.",
    },
    feeChange: {
      label: "Decided fee change",
      value: "{amount}/month",
      explanation: "The decided change of {value}{from} gives a fee of about {newFee} a month, compared with {fee} in the listing.",
      /** " from 1 January 2027": the date the reviewer wrote, with a space in front. */
      from: " from {date}",
    },
    ownFeeLevel: {
      label: "The flat's fee per m²",
      value: "{amount} per year",
      explanation: "The flat's fee corresponds to {own} per year, compared with the association's average of {average}.",
      higher: "That is clearly higher than the average, which may be due to the flat's share ratio (andelstal) or to the fee including more, for example electricity or broadband.",
    },
  },

  /** Questions for the board and the broker, made from the figures. */
  questions: {
    newerReport: "Is there a newer annual report than the one for {year}?",
    pipes: "When is the pipe replacement planned, and how is it to be financed — from savings, new loans or a higher fee?",
    leasehold: "When is the leasehold fee (tomträttsavgäld) next renegotiated, and what does the association expect it to end up at?",
    maintenancePlan: "Is there a current maintenance plan, and which larger works are planned over the next five years?",
    savings: "How will the association pay for future maintenance when its savings are low?",
    loans: "How large a share of the association's loans is to be renegotiated over the next year, and what interest rate is the board expecting?",
    genuine: "Is the association a private housing company (a genuine association)?",
    audit: "What was the auditor's remark about, and has the matter been put right?",
    missing: "The annual report does not state {list} — can the association provide the figures?",
    feeIncrease: "Are there decisions or plans for fee increases that do not show in the annual report?",
  },

  /** The month names the reviewer may have written a date with ("1 januari 2027"); used to read such a date. Do not translate this list. */
  sourceMonths: "januari,februari,mars,april,maj,juni,juli,augusti,september,oktober,november,december",
};

export default brf;
