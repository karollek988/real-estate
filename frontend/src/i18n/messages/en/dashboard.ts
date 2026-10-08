import type { Messages } from "../types";

/** The signed-in area. Same keys as ../sv/dashboard.ts; translate the values only. */
const dashboard: Messages["dashboard"] = {
  nav: {
    overview: "Overview",
    inspection: "Viewing guide",
    settings: "Settings",
    coupons: "Coupons",
    purchases: "Purchases & balance",
  },

  overview: {
    greeting: "Hello {name}! 👋",
    nameFallback: "there",
    unnamedUser: "Köpanalys user",
    lead: "Here is an overview of your activity and your insights.",
    stats: {
      brf: "Housing association analyses",
      area: "Area analyses",
      hiddenCosts: "Hidden costs",
      total: "Analyses in total",
    },
    analyses: "Your analyses",
    empty: {
      title: "Create your first analysis",
      text: "You have no analyses yet. Analyse the area around an address, or get the whole picture of a home with the Peace of Mind Package.",
      action: "Create your first analysis",
    },
  },

  analysis: {
    brf: {
      published: "The housing association analysis is reviewed and ready",
      dueBy: "The housing association analysis is being reviewed by our experts — ready by {when} at the latest",
      pending: "The housing association analysis is being reviewed by our experts and will be published as soon as it is ready",
    },
    plan: {
      pending: "Waiting",
      failed: "Failed",
      full: "Peace of Mind Package",
      area: "Area analysis",
    },
    type: "Type of analysis",
    open: "Open analysis",
    status: {
      ready: "Ready",
      processing: "Processing",
      expired: "Expired",
    },
    continueInspection: "Continue to the viewing guide",
    uploadReport: "Upload the association's annual report",
    uploading: "Uploading...",
    uploadThanks: "Thank you! The annual report has been received and is being reviewed by Köpanalys.",
    delete: "Remove",
    deleting: "Removing...",
  },

  profile: {
    memberSince: "Member since",
    email: "Email",
    edit: "Edit profile",
  },
  quickActions: {
    title: "Quick access",
    newAnalysis: "Create new analysis",
  },
  storePromo: {
    title: "Need more analyses?",
    text: "Buy an Area analysis, the Peace of Mind Package for one home or a package for three.",
    cta: "See the packages",
  },
  inspectionBanner: {
    title: "Do you need help before your viewing?",
    text: "The viewing guide, which is included in the Peace of Mind Package, helps you understand the home's condition before you place a bid. Get a thorough review of risks and hidden defects.",
    cta: "To the viewing guide",
  },

  purchases: {
    title: "Purchases & balance",
    lead: "See how many analyses you have left and what is on the account. Buy an Area analysis or a Peace of Mind Package when you need more.",
    packages: "See the packages",
  },

  coupons: {
    title: "Coupons",
    lead: "Your discount codes. Enter a code when you buy a package.",
    kind: {
      trygghetspaket: "50% off a Peace of Mind Package",
      omradesanalys: "50% off an Area analysis",
    },
    status: {
      active: "Active",
      reserved: "Reserved",
      redeemed: "Used",
    },
    copy: "Copy code",
    reservedNote: "The code is reserved for a payment in progress.",
    redeemedNote: "The code has already been used.",
    empty: {
      title: "No discount codes right now",
      text: "You have no discount codes on your account. If we have given you a code, you can enter it directly when you buy a package.",
      action: "See the packages",
    },
  },

  settings: {
    title: "Settings",
    lead: "Manage your account and your details.",
    profile: {
      title: "Account details",
      lead: "Change your name or your email address. You need to confirm with your password.",
      name: "Name",
      namePlaceholder: "Your name",
      email: "Email",
      emailPlaceholder: "you@example.com",
      currentPassword: "Current password",
      passwordNote: "Required to change your name or email.",
      save: "Save changes",
      saving: "Saving...",
      saved: "Your details have been updated.",
      errors: {
        name: "The name cannot be empty.",
        email: "Enter a valid email address.",
        password: "Enter your current password to save the changes.",
        generic: "Something went wrong. Please try again.",
      },
    },
    delete: {
      title: "Delete account",
      text: "This permanently deletes your account, your decision analyses and saved homes. Shared housing association annual reports and shared market data are not affected.",
      button: "Delete account",
      confirm: "Type your email address ({email}) to confirm:",
      permanent: "Delete account permanently",
      deleting: "Deleting...",
      cancel: "Cancel",
      errors: {
        mismatch: "The email address does not match your account.",
        generic: "Something went wrong. Please try again.",
      },
    },
  },

  privacy: {
    title: "Privacy",
    lead: "A summary of what information Köpanalys has about you and how it is used. See our full <link>privacy policy</link> for more detail.",
    account: {
      title: "Your account details",
      name: "Name:",
      created: "Account created: {date}",
      note: "These details are stored so that we can provide the service and so that you can sign in and see your history.",
    },
    analyses: {
      title: "Your analyses",
      text: "When you request an analysis of a home, the request is linked to your account so that you can see your history under <link>My analyses</link>. The analysis data itself (assessments, market data, comparisons) is shared and cached between users — it is not personal to you. This means that other users who analyse the same home can see the same underlying data, but not that you in particular requested the analysis.",
      count: "You have made <b>{count}</b> {count, plural, one {analysis} other {analyses}} so far.",
    },
    never: {
      title: "What we do NOT do",
      text: "Köpanalys does not sell your information to third parties. Your analysis history, your email address and other account information are used only to run the service and, if you have consented, for our own marketing and product improvement. We never share or sell your personal data to external buyers.",
    },
    cookies: {
      title: "Cookie settings",
      text: "You can withdraw or change your consent to marketing and analytics cookies at any time.",
      button: "Change cookie settings",
    },
  },
};

export default dashboard;
