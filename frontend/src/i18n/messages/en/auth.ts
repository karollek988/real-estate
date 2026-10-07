import type { Messages } from "../types";

/** Signing in and creating an account. Same keys as ../sv/auth.ts; translate the values only. */
const auth: Messages["auth"] = {
  close: "Close",
  google: "Continue with Google",
  or: "or",

  fields: {
    email: "Email address",
    emailPlaceholder: "name@example.com",
    password: "Password",
    confirmPassword: "Confirm password",
    firstName: "First name",
    firstNamePlaceholder: "Anna",
    lastName: "Last name",
    lastNamePlaceholder: "Svensson",
    showPassword: "Show password",
    hidePassword: "Hide password",
  },

  login: {
    dialogLabel: "Sign in",
    headline: "Welcome back!",
    lead: "Sign in to continue to your analyses.",
    mobileLine1: "Welcome back!",
    mobileLine2: "Sign in to <accent>continue.</accent>",
    mobileLead: "Get access to analyses, saved searches and personal insights.",
    remember: "Remember me",
    forgotPassword: "Forgot your password?",
    submit: "Sign in",
    submitting: "Signing in...",
    resend: "Send the confirmation link again",
    resending: "Sending...",
    resent: "A new confirmation link has been sent! Check your inbox.",
    switchPrompt: "Don't have an account?",
    switchAction: "Create account",
  },

  register: {
    dialogLabel: "Create account",
    headline: "Create your account",
    lead: "It takes less than a minute to get started.",
    mobileLine1: "Create your account",
    mobileLine2: "and get started <accent>right away.</accent>",
    mobileLead: "It takes less than a minute and you can start analysing straight away.",
    agree: "I accept the <terms>terms of use</terms> and the <privacy>privacy policy</privacy>",
    submit: "Create account",
    submitting: "Creating account...",
    switchPrompt: "Already have an account?",
    switchAction: "Sign in",
    errors: {
      mustAgree: "You must accept the terms of use to create an account.",
      passwordMismatch: "The passwords do not match.",
    },
    checkInbox: {
      title: "Check your inbox!",
      text: "We have sent a confirmation email to <b>{email}</b>. Click the link in the email to activate your account.",
    },
  },

  trust: {
    title: "Safe and secure sign-in",
    text: "We protect your details with the highest level of security.",
  },

  confirmed: {
    title: "Your email address is confirmed!",
    text: "Your account is now active. You will be taken to the start page in {seconds, plural, one {# second} other {# seconds}}.",
    button: "Take me to the start page",
  },
};

export default auth;
