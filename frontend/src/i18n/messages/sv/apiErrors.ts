/**
 * What the site's server answers when something goes wrong and the visitor is told about it: "too many
 * requests", "that file is too large", "sign in to continue" ... These texts are shown in the page next to the
 * button that was pressed. The language is the one of the page the request came from.
 *
 * Messages meant for developers (a request without a body, a webhook that fails its signature check) are not
 * here: they are not shown to visitors and stay in English in the code.
 * Some texts below are in English in the Swedish file too - that is how they have always been shown; they
 * are kept as they were.
 */
const apiErrors = {
  /** The request needs a signed-in visitor. */
  signIn: "Sign in to continue.",

  analyses: {
    rateLimited: "För många analysförfrågningar från din uppkoppling – försök igen om en stund.",
    /** The Area analysis needs a street address. */
    addressRequired: "Ange adressen du vill analysera området runt.",
    addressNeedsCity: "Ange både gatuadress och ort, till exempel Storgatan 12, Stockholm.",
    booliNeedsAddress:
      "We recognized that Booli link, but the listing page itself can't be read automatically — enter the property's address manually and we'll pull matching price, fee and area data from Booli for you.",
    /** {provider} is the name of the listing site, such as "Booli". */
    unsupportedProvider: "We don't support {provider} links yet — enter the details manually and we'll analyze the property.",
    notAListing: "That doesn't look like a property listing we can read. If you have an address, enter the details manually.",
    invalidUrl: "We couldn't read that link. Double check it's a full listing URL, or enter the address manually.",
    unreadableListing: "We couldn't read that Hemnet link. Double check it's a listing URL, or enter the address manually.",
    /** {labels} is a list of what is missing, such as "utgångspris, boarea" (see essentialFields). */
    insufficientManualData: "Fyll i följande för att kunna analysera bostaden: {labels}.",
    noCredit: {
      full: "Du har inget Trygghetspaket kvar. Köp ett för att analysera en bostad.",
      /** {price} is the price in kronor. */
      area: "Du har ingen Områdesanalys kvar. Köp en för {price} kr för att analysera ett område.",
    },
    failed: "Something went wrong while analyzing the property. Please try again.",
    /** Shown by the "Update analysis" button of the report. */
    updateFailed: "Something went wrong while updating the analysis. Please try again.",
    loadFailed: "Could not load the analysis.",
    loadHistoryFailed: "Could not load the analysis history.",
    notFound: "No analysis with that id.",
    notFoundCompleted: "No completed analysis with that id.",
    pdfRateLimited: "Vänta en liten stund innan du laddar ner fler PDF:er.",
    pdfFailed: "Could not generate the PDF report.",
  },

  /** What a listing needs in order to be analysed; written in the sentence insufficientManualData. */
  essentialFields: {
    asking_price_sek: "utgångspris",
    monthly_fee_sek: "månadsavgift",
    living_area_m2: "boarea",
  },

  inspections: {
    packageRequired: "Kräver Trygghetspaketet för den här bostaden.",
    guideIncluded: "Visningsguiden ingår i Trygghetspaketet för den här bostaden.",
    analysisIncomplete: "Analysen är inte klar än.",
    documentSaveFailed: "Kunde inte spara dokumentet. Försök igen.",
    photoSaveFailed: "Kunde inte spara fotot. Försök igen.",
    documentTypeInvalid: "Only PDF or image files are supported.",
    photoTypeInvalid: "Only image files are supported.",
  },

  screenshots: {
    rateLimited: "För många uppladdningar från din uppkoppling – försök igen om en stund.",
    atLeastOne: "Ladda upp minst en skärmdump.",
    /** {max} is how many pictures at most. */
    tooMany: "Max {max} bilder åt gången.",
    invalidType: "Endast PNG-, JPEG- eller WEBP-bilder stöds.",
    tooLarge: "Varje bild får vara max 8 MB.",
    notConnected: "Bildläsning är inte tillgänglig just nu — fyll i uppgifterna manuellt istället.",
    readFailed: "Kunde inte läsa bilderna just nu. Försök igen eller fyll i uppgifterna manuellt.",
    noText: "Kunde inte hitta någon text i bilderna. Prova en tydligare skärmdump eller fyll i uppgifterna manuellt.",
  },

  profile: {
    currentPasswordRequired: "Ange ditt nuvarande lösenord.",
    invalidName: "Ogiltigt namn.",
    invalidEmail: "Ogiltig e-postadress.",
    enterValidEmail: "Ange en giltig e-postadress.",
    nameEmpty: "Namnet får inte vara tomt.",
    noEmailOnAccount: "Kontot saknar en registrerad e-postadress.",
    wrongPassword: "Fel lösenord. Försök igen.",
    failed: "Något gick fel. Försök igen.",
    deleteFailed: "Could not delete your account. Please try again.",
    loadFailed: "Could not load your profile.",
    notFound: "No profile found for this account.",
    analysesLoadFailed: "Could not load your analyses.",
    analysisNotFound: "No analysis with that id in your profile.",
    analysisDeleteFailed: "Could not delete the analysis.",
    discountCodesLoadFailed: "Kunde inte hämta dina rabattkoder.",
  },

  /** The annual report of a housing association that a customer uploads. */
  brfReport: {
    invalidType: "Ladda upp en PDF, ett Word-dokument (.docx) eller en bild av årsredovisningen.",
    tooLarge: "Filen är för stor (max 20 MB).",
    uploadNotFound: "Kunde inte hitta den uppladdade filen. Försök ladda upp den igen.",
    receiveFailed: "Kunde inte ta emot årsredovisningen. Försök igen.",
    prepareFailed: "Could not prepare the upload. Please try again.",
  },

  stripe: {
    rateLimited: "För många försök – vänta en liten stund och försök igen.",
    invalidDiscount: "Ogiltig eller redan använd rabattkod.",
    checkoutFailed: "Kunde inte starta betalningen. Försök igen om en stund.",
  },

  chat: {
    unavailable: "Chatten är inte tillgänglig just nu – kontakta oss på kontakt@kopanalys.se istället.",
    rateLimited: "För många meddelanden – vänta en liten stund och försök igen.",
  },

  /** The map's translation of what visitors wrote in a listing. */
  translate: {
    rateLimited: "För många översättningar – vänta en liten stund och försök igen.",
    invalid: "Texten kunde inte översättas.",
  },

  contact: {
    unavailable: "Kontakt via formulär är inte tillgänglig just nu — mejla oss direkt på kontakt@kopanalys.se istället.",
    rateLimited: "För många meddelanden skickade – försök igen senare eller mejla kontakt@kopanalys.se.",
  },
};

export default apiErrors;
