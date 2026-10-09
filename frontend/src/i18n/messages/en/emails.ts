import type { Messages } from "../types";

/**
 * The e-mails Köpanalys sends to customers. Same keys as ../sv/emails.ts; translate the values only.
 * They are written in the language the customer's account was created in, or the language they last used when ordering.
 */
const emails: Messages["emails"] = {
  footer: "Questions? Write to",
  fallbackLink: "If the button does not work, copy this link into your browser:",
  ignore: "Did not ask for this? You can ignore this e-mail.",

  signup: {
    subject: "Confirm your Köpanalys account",
    preheader: "Confirm your e-mail address to activate your Köpanalys account.",
    greetingNamed: "Hello {name}!",
    greeting: "Hello!",
    body: "Thank you for creating an account with Köpanalys! Confirm your e-mail address to get started.",
    button: "Confirm my account",
  },

  account: {
    recovery: {
      subject: "Reset your password — Köpanalys",
      heading: "Reset your password",
      body: "We have received a request to reset the password for your Köpanalys account. Click the button below to choose a new password.",
      cta: "Reset password",
    },
    magiclink: {
      subject: "Your sign-in link — Köpanalys",
      heading: "Sign in to Köpanalys",
      body: "Click the button below to sign in to your Köpanalys account.",
      cta: "Sign in",
    },
    email_change: {
      subject: "Confirm your new e-mail address — Köpanalys",
      heading: "Confirm your new e-mail address",
      body: "Click the button below to confirm that this e-mail address should be linked to your Köpanalys account.",
      cta: "Confirm e-mail address",
    },
    reauthentication: {
      subject: "Confirm your identity — Köpanalys",
      heading: "Confirm your identity",
      body: "We need to confirm that it is you before we continue. Click the button below to continue.",
      cta: "Confirm",
    },
    invite: {
      subject: "You have been invited to Köpanalys",
      heading: "You have been invited",
      body: "Click the button below to create your Köpanalys account.",
      cta: "Create account",
    },
    other: {
      subject: "A message about your Köpanalys account",
      heading: "A message about your account",
      body: "Click the button below to continue.",
      cta: "Continue",
    },
  },

  reportReady: {
    subject: "Your report for {address} is ready",
    preheader: "The report has been reviewed by Köpanalys and is ready to read.",
    heading: "Your report is ready",
    intro: "A person at Köpanalys has reviewed the report for {address}.",
    body: "Open the report with the button below. You can also find it under My account.",
    cta: "Open the report",
  },
  brfReady: {
    subject: "Your housing association analysis for {address} is ready",
    preheader: "The association's finances have been reviewed and are now in your report.",
    heading: "Your housing association analysis is ready",
    intro: "Our experts have reviewed the association's annual report for {address}.",
    body: "In the Housing association chapter of the report you can now see the association's key figures explained in plain language, what they mean for you in kronor and which questions are good to ask before the viewing.",
    cta: "Open the report",
  },
};

export default emails;
