import type { Messages } from "../types";

/** What the site's server answers when something goes wrong and the visitor is told about it. Same keys as ../sv/apiErrors.ts; translate the values only. */
const apiErrors: Messages["apiErrors"] = {
  signIn: "Sign in to continue.",

  analyses: {
    rateLimited: "Too many analysis requests from your connection – please try again in a moment.",
    addressRequired: "Enter the address you want to analyse the area around.",
    addressNeedsCity: "Enter both the street address and the town, for example Storgatan 12, Stockholm.",
    booliNeedsAddress:
      "We recognised that Booli link, but the listing page itself can't be read automatically — enter the property's address manually and we'll pull matching price, fee and area data from Booli for you.",
    unsupportedProvider: "We don't support {provider} links yet — enter the details manually and we'll analyse the property.",
    notAListing: "That doesn't look like a property listing we can read. If you have an address, enter the details manually.",
    invalidUrl: "We couldn't read that link. Double check it's a full listing URL, or enter the address manually.",
    unreadableListing: "We couldn't read that Hemnet link. Double check it's a listing URL, or enter the address manually.",
    insufficientManualData: "Fill in the following so that we can analyse the home: {labels}.",
    noCredit: {
      full: "You have no Peace of Mind Package left. Buy one to analyse a home.",
      area: "You have no Area analysis left. Buy one for SEK {price} to analyse an area.",
    },
    failed: "Something went wrong while analysing the property. Please try again.",
    updateFailed: "Something went wrong while updating the analysis. Please try again.",
    loadFailed: "Could not load the analysis.",
    loadHistoryFailed: "Could not load the analysis history.",
    notFound: "No analysis with that id.",
    notFoundCompleted: "No completed analysis with that id.",
    pdfRateLimited: "Please wait a moment before downloading more PDFs.",
    pdfFailed: "Could not generate the PDF report.",
  },

  essentialFields: {
    asking_price_sek: "asking price",
    monthly_fee_sek: "monthly fee",
    living_area_m2: "living area",
  },

  inspections: {
    packageRequired: "Requires the Peace of Mind Package for this home.",
    guideIncluded: "The Viewing guide is included in the Peace of Mind Package for this home.",
    analysisIncomplete: "The analysis is not finished yet.",
    documentSaveFailed: "Could not save the document. Please try again.",
    photoSaveFailed: "Could not save the photo. Please try again.",
    documentTypeInvalid: "Only PDF or image files are supported.",
    photoTypeInvalid: "Only image files are supported.",
  },

  screenshots: {
    rateLimited: "Too many uploads from your connection – please try again in a moment.",
    atLeastOne: "Upload at least one screenshot.",
    tooMany: "At most {max} images at a time.",
    invalidType: "Only PNG, JPEG or WEBP images are supported.",
    tooLarge: "Each image can be at most 8 MB.",
    notConnected: "Reading images is not available right now — fill in the details manually instead.",
    readFailed: "Could not read the images right now. Try again or fill in the details manually.",
    noText: "Could not find any text in the images. Try a clearer screenshot or fill in the details manually.",
  },

  profile: {
    currentPasswordRequired: "Enter your current password.",
    invalidName: "Invalid name.",
    invalidEmail: "Invalid e-mail address.",
    enterValidEmail: "Enter a valid e-mail address.",
    nameEmpty: "The name cannot be empty.",
    noEmailOnAccount: "The account has no registered e-mail address.",
    wrongPassword: "Wrong password. Please try again.",
    failed: "Something went wrong. Please try again.",
    deleteFailed: "Could not delete your account. Please try again.",
    loadFailed: "Could not load your profile.",
    notFound: "No profile found for this account.",
    analysesLoadFailed: "Could not load your analyses.",
    analysisNotFound: "No analysis with that id in your profile.",
    analysisDeleteFailed: "Could not delete the analysis.",
    discountCodesLoadFailed: "Could not fetch your discount codes.",
  },

  brfReport: {
    invalidType: "Upload a PDF, a Word document (.docx) or a picture of the annual report.",
    tooLarge: "The file is too large (max 20 MB).",
    uploadNotFound: "Could not find the uploaded file. Please try uploading it again.",
    receiveFailed: "Could not receive the annual report. Please try again.",
    prepareFailed: "Could not prepare the upload. Please try again.",
  },

  stripe: {
    rateLimited: "Too many attempts – wait a moment and try again.",
    invalidDiscount: "Invalid or already used discount code.",
    checkoutFailed: "Could not start the payment. Please try again in a moment.",
  },

  chat: {
    unavailable: "The chat is not available right now – contact us at kontakt@kopanalys.se instead.",
    rateLimited: "Too many messages – wait a moment and try again.",
  },

  translate: {
    rateLimited: "Too many translations – wait a moment and try again.",
    invalid: "The text could not be translated.",
  },

  contact: {
    unavailable: "The contact form is not available right now — e-mail us directly at kontakt@kopanalys.se instead.",
    rateLimited: "Too many messages sent – try again later or e-mail kontakt@kopanalys.se.",
  },
};

export default apiErrors;
