import type { Messages } from "../types";

/** The forms that start an analysis. Same keys as ../sv/forms.ts; translate the values only. */
const forms: Messages["forms"] = {
  screenshot: {
    dropTitle: "Upload screenshots of the listing",
    dropHint: "PNG, JPEG or WEBP · up to {maxFiles} images · max {maxMb} MB per image",
    removeFile: "Remove {name}",
    submit: "Read the images",
    submitting: "Reading the images...",
    manualInstead: "Enter the details manually instead",
    ocrDebug: "Show raw OCR text (temporary, for troubleshooting)",
    foundNotice: "We read {count, plural, one {# field} other {# fields}} from your screenshots — check that they are correct and fill in the rest.",
    nothingFoundNotice: "We could not read any details automatically from the images — fill in the form below.",
    errors: {
      fileType: "Only PNG, JPEG or WEBP images are supported.",
      fileSize: "Each image can be at most {maxMb} MB.",
      tooMany: "At most {maxFiles} images at a time.",
      generic: "Something went wrong. Please try again.",
    },
  },

  manual: {
    fields: {
      address: "Address",
      propertyType: "Type of home",
      propertyTypePlaceholder: "Choose type",
      livingArea: "Living area (m²)",
      rooms: "Number of rooms",
      askingPrice: "Asking price (SEK)",
      askingPriceHint: "The home's total price, not the price per square metre.",
      monthlyFee: "Monthly fee (SEK)",
      operatingCosts: "Running costs (SEK/month)",
      floor: "Floor",
      buildingYear: "Year built",
      energyClass: "Energy class",
      energyClassPlaceholder: "Choose class",
      condition: "Condition",
      conditionPlaceholder: "Choose condition",
      balcony: "Balcony",
      elevator: "Lift",
      parking: "Parking",
      choose: "Choose",
      broker: "Estate agent",
      agency: "Estate agency",
      description: "Description",
    },
    propertyTypes: {
      bostadsratt: "Tenant-owned flat (bostadsrätt)",
      aganderatt: "Freehold (äganderätt)",
      arrende: "Leasehold (arrende)",
      bostadsrattNyproduktion: "Tenant-owned flat (new build)",
    },
    conditions: {
      excellent: "Excellent",
      good: "Good",
      okay: "Fair",
      needsRenovation: "Needs renovation",
    },
    yes: "Yes",
    no: "No",
    includes: "Uses one Peace of Mind Package: housing association analysis, area analysis and hidden costs for this home.",
    submit: "Analyse home",
    submitting: "Analysing...",
    errors: {
      address: "Enter an address to analyse the home.",
      askingPrice: "Enter an asking price to analyse the home.",
      livingArea: "Enter the living area to analyse the home.",
      monthlyFee: "Enter the monthly fee to analyse the home.",
    },
  },

  area: {
    intro: "Enter an address and we will analyse the area around it: services, schools, commuting and safety. Costs SEK {price} and is taken from your Area analyses.",
    addressLabel: "Address and town",
    addressHint: "For example Storgatan 12, Stockholm",
    submit: "Analyse the area",
    submitting: "Analysing...",
    errors: {
      address: "Enter the address you want to analyse the area around.",
      needsCity: "Enter both the street address and the town, for example Storgatan 12, Stockholm.",
    },
  },

  submit: {
    fallback: "Something went wrong. Please try again.",
    unauthorized: "Sign in or create an account to continue.",
  },

  goToStore: "Go to the shop",
};

export default forms;
