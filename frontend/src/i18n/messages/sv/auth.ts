/**
 * Signing in and creating an account (the window that opens from the header), and the page a visitor lands
 * on after clicking the link in the confirmation e-mail. Error messages that come from the sign-in service
 * itself (wrong password and so on) are shown as the service writes them and are not in these files.
 */
const auth = {
  close: "Stäng",
  /** The button for signing in with a Google account. Google's name stays. */
  google: "Fortsätt med Google",
  /** The word between the Google button and the e-mail form. */
  or: "eller",

  fields: {
    email: "E-postadress",
    /** Example text inside the empty field: an e-mail address that is clearly an example. */
    emailPlaceholder: "namn@exempel.se",
    password: "Lösenord",
    confirmPassword: "Bekräfta lösenord",
    firstName: "Förnamn",
    /** Example first name inside the empty field. */
    firstNamePlaceholder: "Anna",
    lastName: "Efternamn",
    /** Example surname inside the empty field. */
    lastNamePlaceholder: "Svensson",
    showPassword: "Visa lösenord",
    hidePassword: "Dölj lösenord",
  },

  login: {
    /** The window's name for screen readers. */
    dialogLabel: "Logga in",
    headline: "Välkommen tillbaka!",
    lead: "Logga in för att fortsätta till dina analyser.",
    /** On a phone the heading is on two lines. <accent>...</accent> is shown in green. */
    mobileLine1: "Välkommen tillbaka!",
    mobileLine2: "Logga in för att <accent>fortsätta.</accent>",
    mobileLead: "Få tillgång till analyser, bevakningar och personliga insikter.",
    remember: "Kom ihåg mig",
    forgotPassword: "Glömt lösenord?",
    submit: "Logga in",
    submitting: "Loggar in...",
    /** Shown when the account's e-mail address has not been confirmed yet. */
    resend: "Skicka bekräftelselänk igen",
    resending: "Skickar...",
    resent: "Ny bekräftelselänk skickad! Kolla din inkorg.",
    /** "Har du inget konto? Skapa konto" - the second part is a button. */
    switchPrompt: "Har du inget konto?",
    switchAction: "Skapa konto",
  },

  register: {
    dialogLabel: "Skapa konto",
    headline: "Skapa ditt konto",
    lead: "Det tar mindre än en minut att komma igång.",
    mobileLine1: "Skapa ditt konto",
    mobileLine2: "och kom igång <accent>direkt.</accent>",
    mobileLead: "Det tar mindre än en minut och du kan börja analysera direkt.",
    /** The checkbox. <terms>...</terms> links to the terms of use, <privacy>...</privacy> to the privacy policy. */
    agree: "Jag godkänner <terms>villkoren</terms> och <privacy>integritetspolicyn</privacy>",
    submit: "Skapa konto",
    submitting: "Skapar konto...",
    switchPrompt: "Har du redan ett konto?",
    switchAction: "Logga in",
    errors: {
      mustAgree: "Du måste godkänna villkoren för att skapa ett konto.",
      passwordMismatch: "Lösenorden matchar inte.",
    },
    /** Shown after the form is sent. {email} is the address the confirmation was sent to, shown in bold by <b>. */
    checkInbox: {
      title: "Kolla din inkorg!",
      text: "Vi har skickat ett bekräftelsemail till <b>{email}</b>. Klicka på länken i mejlet för att aktivera ditt konto.",
    },
  },

  /** Only on phones, at the bottom of the window. */
  trust: {
    title: "Säker och trygg inloggning",
    text: "Vi skyddar dina uppgifter med högsta säkerhet.",
  },

  /** The page shown after the link in the confirmation e-mail is clicked. */
  confirmed: {
    title: "E-postadressen är bekräftad!",
    /** {seconds} counts down from 5; the form of "sekund" follows the number. */
    text: "Ditt konto är nu aktiverat. Du skickas till startsidan om {seconds, plural, one {# sekund} other {# sekunder}}.",
    button: "Ta mig till startsidan",
  },
};

export default auth;
