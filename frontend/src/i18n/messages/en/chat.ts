import type { Messages } from "../types";

/** The chat assistant in the corner of every page. Same keys as ../sv/chat.ts; translate the values only. */
const chat: Messages["chat"] = {
  open: "Open chat",
  close: "Close chat",
  title: "Köpanalys Chat",
  greeting: "Hello! I am the Köpanalys assistant. How can I help you? Feel free to ask about our analyses, our prices or how the service works.",
  placeholder: "Type a question...",
  send: "Send message",
  unavailable: "The chat is not available right now – please contact us at {email} instead.",
};

export default chat;
