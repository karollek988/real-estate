import type { Messages } from "../types";

/** The page for an address that does not exist. Same keys as ../sv/notFound.ts; translate the values only. */
const notFound: Messages["notFound"] = {
  metaTitle: "Page not found",
  code: "Error 404",
  title: "This page does not exist",
  text: "The link may be misspelt, or the page may have moved. Here are a few ways forward.",
  home: "Go to the start page",
  createAnalysis: "Create analysis",
  contact: "Contact us",
};

export default notFound;
