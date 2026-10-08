import type { Messages } from "../types";

/** The sections of the start page. Same keys as ../sv/sections.ts; translate the values only. */
const sections: Messages["sections"] = {
  howItWorks: {
    eyebrow: "How it works",
    title: "From listing to decision basis in three steps",
    description:
      "We are on the buyer's side. We do not sell the home and we do not sell the price – we give you what is relevant for the purchase, gathered in one place.",
    steps: {
      find: {
        title: "Find a home",
        text: "Choose the home you are interested in and take a screenshot of the listing – wherever it is – or fill in the details yourself.",
      },
      analyse: {
        title: "We analyse the home",
        text: "We read the listing and gather data about the association, the area and the costs from several independent sources.",
      },
      report: {
        title: "Get a clear decision basis",
        text: "You get everything that is relevant for the purchase in one report, in plain language and with the sources stated.",
      },
    },
    note: "Most of it is ready in a few minutes.",
    more: "Read more about how it works",
  },

  areas: {
    eyebrow: "Areas",
    title: "Get to know the area before you place a bid",
    lead: "Enter an address and we show what is around it and how the area is developing.",
    cta: "Area analysis, SEK {price, number}",
    explore: "Explore the map",
    panelTitle: "This is what the area analysis shows",
    topics: {
      services: { title: "Services within 1 km", text: "Grocery shops, restaurants, parks and healthcare near the home." },
      schools: { title: "Schools nearby", text: "The schools around the address, from the National Agency for Education's register." },
      commuting: { title: "Commuting", text: "Travel time to the centre by car and public transport." },
      safety: { title: "Safety and community", text: "Statistics on safety and community data for the municipality." },
      development: { title: "How the area is developing", text: "How the population and prices in the area are developing." },
    },
  },

  knowledge: {
    eyebrow: "Knowledge",
    title: "Feel safer before your purchase",
    text: "Guides, insights and news about the housing market.",
  },

  contact: {
    eyebrow: "Contact",
    title: "Do you have a question?",
    text: "Do you have a question, a suggestion or anything else on your mind? Send a message and we will get back to you, or email us directly at <mail>{email}</mail>.",
    success: {
      title: "Message sent!",
      text: "Thank you for your message. We will get back to you as soon as we can.",
      again: "Send another message",
    },
    fields: {
      name: "Name",
      namePlaceholder: "Your name",
      email: "Email",
      emailPlaceholder: "name@example.com",
      message: "Message",
      messagePlaceholder: "Your message...",
    },
    submit: "Send message",
    sending: "Sending...",
    unavailable: "Contact through the form is not available right now — email us directly at <mail>{email}</mail> instead.",
  },

  problem: {
    eyebrow: "What is not in the listing",
    title: "I found the home. But is it a good purchase?",
    description: "The listing shows what the seller wants you to see. What decides whether the purchase holds up is rarely found there.",
    questions: {
      debt: "Does the association have too much debt per square metre?",
      pipes: "Is a pipe replacement or a fee increase on the way?",
      communication: "How accessible is the communication?",
      costs: "What does the purchase cost beyond the price?",
    },
    lagfart: {
      amount: "SEK {amount, number}",
      text: "in title registration fees (lagfart) for a house that costs SEK {millions} million. It is not in the listing.",
      footnote: "Title registration: {rate, number}% of the purchase price plus a fee of SEK {fee, number} (Lantmäteriet, the land registry).",
    },
  },

  info: {
    eyebrow: "Good to know",
    title: "Decide on facts – not gut feeling",
    description: "Three things that are hard to judge on your own, but that we shed light on with facts and comparisons.",
    cards: {
      costs: {
        title: "What does the purchase cost beyond the price?",
        description:
          "Title registration, mortgage deeds, the association's fees and coming fee increases are rarely in the listing – but they decide what the home actually costs you.",
        points: {
          debt: "Your share of the association's loans, in kronor",
          rate: "How the fee is affected if interest rates rise",
        },
      },
      brf: {
        title: "Why the housing association matters",
        description:
          "The association's finances affect your monthly cost more than most people think. High borrowing per square metre can mean sharp fee increases ahead.",
        points: {
          debt: "Debt, savings and interest rate sensitivity",
          plans: "Pipe replacement, ground rent and planned fee increases",
        },
      },
      infrastructure: {
        title: "Infrastructure affects the area",
        description:
          "New metro lines, commuter train stations and urban development projects can change an area long before they are finished.",
        points: {
          projects: "Planned projects near the home",
          travel: "Travel times to the centre by car and public transport",
        },
      },
    },
  },
};

export default sections;
