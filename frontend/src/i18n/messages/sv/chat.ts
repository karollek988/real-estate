/**
 * The chat assistant in the corner of every page. What the assistant answers is not written here: it answers
 * from the FAQ (messages/sv/faq.ts) in the language of the page the visitor is on.
 */
const chat = {
  /** The round button that opens the chat, and the same button when the chat is open. */
  open: "Öppna chat",
  close: "Stäng chat",
  /** The chat window's heading. */
  title: "Köpanalys Chat",
  /** The assistant's first message. */
  greeting: "Hej! Jag är Köpanalys assistent. Hur kan jag hjälpa dig? Fråga gärna om våra analyser, priser eller hur tjänsten fungerar.",
  placeholder: "Skriv en fråga...",
  /** The send button (an arrow): its name for screen readers. */
  send: "Skicka meddelande",
  /** Shown as the assistant's answer when the chat service does not respond. {email} is the contact address. */
  unavailable: "Chatten är inte tillgänglig just nu – kontakta oss på {email} istället.",
};

export default chat;
